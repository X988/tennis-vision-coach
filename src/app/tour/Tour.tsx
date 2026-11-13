import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackhandType, Handedness, Level } from '../../engines/profile';
import { useT } from '../i18n';
import { useStore } from '../store';
import { useVoice } from '../voice/context';
import { tourCue } from '../voice/narration';
import { PRIORITY } from '../voice/speaker';
import { TourContext } from './context';
import { STEP_ROUTES, TOUR_STEPS } from './steps';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** The part of an element that is actually visible (clipped by scrolling panels and the viewport). */
function visibleRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const out = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  for (let p = el.parentElement; p; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (st.overflowY === 'visible' && st.overflowX === 'visible') continue;
    const c = p.getBoundingClientRect();
    out.left = Math.max(out.left, c.left);
    out.top = Math.max(out.top, c.top);
    out.right = Math.min(out.right, c.right);
    out.bottom = Math.min(out.bottom, c.bottom);
  }
  out.left = Math.max(out.left, 0);
  out.top = Math.max(out.top, 0);
  out.right = Math.max(out.left, Math.min(out.right, window.innerWidth));
  out.bottom = Math.max(out.top, Math.min(out.bottom, window.innerHeight));
  return out;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { onboarding, setOnboarding } = useStore();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  const start = useCallback(() => {
    setOnboarding({ welcomeSeen: true });
    setIndex(0);
    setActive(true);
  }, [setOnboarding]);
  const stop = useCallback(
    (completed: boolean) => {
      setActive(false);
      if (completed) setOnboarding({ tourDone: true });
    },
    [setOnboarding],
  );
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(TOUR_STEPS.length - 1, i))), []);
  const api = useMemo(() => ({ active, index, start, stop, go }), [active, index, start, stop, go]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {!onboarding.welcomeSeen && !active && <Welcome onStart={start} onSkip={() => setOnboarding({ welcomeSeen: true })} />}
      {active && <TourOverlay index={index} go={go} stop={stop} />}
    </TourContext.Provider>
  );
}

function Seg<V extends string>({ value, options, onChange }: { value: V; options: { v: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="seg wrap">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'active' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** First launch: what the app is, the two profile answers that change everything, and the offer of a tour. */
function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const t = useT();
  const { profile, setProfile } = useStore();
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="modal">
        <h2 id="welcome-title">{t('welcome.title')}</h2>
        <p>{t('welcome.lead')}</p>
        <ol className="welcome-steps">
          <li>{t('welcome.s1')}</li>
          <li>{t('welcome.s2')}</li>
          <li>{t('welcome.s3')}</li>
        </ol>
        <div className="form">
          <label>{t('profile.handedness')}</label>
          <Seg<Handedness> value={profile.handedness} onChange={(handedness) => setProfile({ handedness })} options={(['right', 'left'] as const).map((v) => ({ v, label: t(`handedness.${v}`) }))} />
          <label>{t('profile.backhand')}</label>
          <Seg<BackhandType> value={profile.backhand} onChange={(backhand) => setProfile({ backhand })} options={(['two_handed', 'one_handed'] as const).map((v) => ({ v, label: t(`backhandType.${v}`) }))} />
          <label>{t('profile.level')}</label>
          <Seg<Level> value={profile.level} onChange={(level) => setProfile({ level })} options={(['beginner', 'intermediate', 'advanced'] as const).map((v) => ({ v, label: t(`level.${v}`) }))} />
        </div>
        <p className="muted small">{t('welcome.note')}</p>
        <div className="actions">
          <button className="primary" onClick={onStart}>
            {t('welcome.start')}
          </button>
          <button onClick={onSkip}>{t('welcome.skip')}</button>
        </div>
      </div>
    </div>
  );
}

const PAD = 6;

function TourOverlay({ index, go, stop }: { index: number; go: (i: number) => void; stop: (completed: boolean) => void }) {
  const t = useT();
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const [satisfied, setSatisfied] = useState(!step.until);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const voice = useVoice();

  // Read the step aloud; stop talking when the tour closes.
  useEffect(() => {
    voice.say(tourCue(t, step.id), { priority: PRIORITY.tour });
  }, [step.id, voice, t]);
  useEffect(() => () => voice.stop(), [voice.stop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to the step's screen.
  useEffect(() => {
    const route = STEP_ROUTES[index];
    if (window.location.hash !== route && !(route === '#/' && window.location.hash === '')) window.location.hash = route;
    scrolled.current = false;
    setBox(null);
    setSatisfied(!step.until);
  }, [index, step.until]);

  // Follow the highlighted element (it can move: scrolling, rotation, async screens).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = step.target ? findTarget(step.target) : null;
      if (el) {
        if (!scrolled.current) {
          scrolled.current = true;
          // Tall blocks start at the top of their panel; small controls are centred.
          el.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.45 ? 'start' : 'center', inline: 'nearest' });
        }
        const r = visibleRect(el);
        const next = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.right - r.left), h: Math.round(r.bottom - r.top) };
        setBox((p) => (p && p.x === next.x && p.y === next.y && p.w === next.w && p.h === next.h ? p : next));
      } else setBox((p) => (p ? null : p));
      if (step.until) {
        const ok = !!document.querySelector(step.until);
        setSatisfied((p) => (p === ok ? p : ok));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // When the learner has done what the step asked, move on by itself.
  useEffect(() => {
    if (!step.until || !satisfied) return;
    const id = window.setTimeout(() => go(index + 1), 500);
    return () => window.clearTimeout(id);
  }, [satisfied, step.until, index, go]);

  // Place the card next to the highlight, always inside the viewport.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const m = 10;
    if (!box) {
      setCardPos({ left: (vw - cw) / 2, top: (vh - ch) / 2 });
      return;
    }
    const below = box.y + box.h + PAD + m;
    const above = box.y - PAD - m - ch;
    let top: number;
    if (below + ch <= vh - m) top = below;
    else if (above >= m) top = above;
    else top = box.y + box.h / 2 < vh / 2 ? vh - ch - m : m; // large target: use the free half of the screen
    const left = Math.max(m, Math.min(vw - cw - m, box.x + box.w / 2 - cw / 2));
    setCardPos({ left, top });
  }, [box, index, satisfied]);

  const hole = box ? { x: box.x - PAD, y: box.y - PAD, w: box.w + PAD * 2, h: box.h + PAD * 2 } : null;
  const waiting = !!step.until && !satisfied;

  return (
    <div className="tour" aria-live="polite">
      {hole ? (
        <>
          <div className="tour-block" style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} />
          <div className="tour-block" style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} />
          <div className="tour-block" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div className="tour-block" style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          {/* When the step is only an explanation, the highlighted control itself is not clickable. */}
          <div className={`tour-ring ${waiting ? 'is-live' : ''}`} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      ) : (
        <div className="tour-block" style={{ inset: 0 }} />
      )}
      <div ref={card} className="tour-card" style={cardPos ? { left: cardPos.left, top: cardPos.top } : { left: -9999, top: 0 }}>
        <div className="tour-count">{t('tour.count', { n: index + 1, total: TOUR_STEPS.length })}</div>
        <h3>{t(`tour.${step.id}.title`)}</h3>
        <p>{t(`tour.${step.id}.text`)}</p>
        {waiting && <p className="tour-wait">{t('tour.waiting')}</p>}
        <div className="tour-actions">
          {index > 0 && <button onClick={() => go(index - 1)}>{t('tour.back')}</button>}
          {last ? (
            <button className="primary" onClick={() => stop(true)}>
              {t('tour.done')}
            </button>
          ) : (
            <button className={waiting ? '' : 'primary'} onClick={() => go(index + 1)}>
              {waiting ? t('tour.skipStep') : t('tour.next')}
            </button>
          )}
          {!last && (
            <button className="link tour-exit" onClick={() => stop(false)}>
              {t('tour.exit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
