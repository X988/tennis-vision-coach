import { useDeferredValue, useEffect, useState } from 'react';
import { LIBRARY } from '../../content/library';
import { COURT_HALF_LENGTH } from '../../engines/physics';
import { STANCES, ScenarioSpec, Stance, validateScenario } from '../../engines/scenario';
import { useClock, useMediaQuery, usePlan } from '../hooks';
import { useT } from '../i18n';
import { navigate } from '../router';
import { Stage } from '../scene/Stage';
import { useStore } from '../store';
import { DecisionSummary } from '../ui/AnalysisPanel';
import { Slider } from '../ui/Slider';
import { Timeline } from '../ui/Timeline';
import { CameraBar, LayerToggles } from '../ui/ViewControls';

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

/** Free situation builder (FR-02): every change re-runs the whole engine chain. */
export function Constructor() {
  const t = useT();
  const { profile, settings, setSettings, setLayers, working, setWorking } = useStore();
  const draft = working.draft;
  const deferred = useDeferredValue(draft);
  const [stance, setStance] = useState<Stance | null>(null);
  const plan = usePlan(deferred, profile, { stance });
  const clock = useClock(plan?.duration ?? 1, settings.rate);
  const portrait = useMediaQuery('(max-aspect-ratio: 1/1)');

  useEffect(() => {
    clock.seek(0);
    clock.play();
  }, [plan, clock]);

  const set = (patch: (d: ScenarioSpec) => ScenarioSpec) => {
    const next = patch(draft);
    if (validateScenario(next).ok) setWorking({ draft: next });
  };
  const ball = draft.incomingBall;
  const launch = ball.launch ?? { x: 0, y: COURT_HALF_LENGTH + 0.3, h: 1 };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!plan) return null;

  return (
    <div className={`lesson ${portrait ? 'portrait' : ''}`}>
      <div className="lesson-main">
        <div className="stages">
          <Stage plan={plan} clock={clock} view={settings.camera} layers={settings.layers} quality={settings.quality} />
        </div>
        <Timeline plan={plan} clock={clock} rate={settings.rate} onRate={(rate) => setSettings({ rate })} />
      </div>
      <aside className="lesson-side">
        <header className="lesson-head">
          <h2>{t('constructor.title')}</h2>
          <div className="actions">
            <select
              aria-label={t('constructor.fromLibrary')}
              value=""
              onChange={(e) => {
                const s = LIBRARY.scenarios.find((x) => x.id === e.target.value);
                if (s) setWorking({ draft: { ...s, id: 'CUSTOM_01' } });
              }}
            >
              <option value="">{t('constructor.fromLibrary')}…</option>
              {LIBRARY.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.ru}
                </option>
              ))}
            </select>
            <button onClick={() => navigate({ name: 'lesson', id: 'custom', mode: 'decide' })}>{t('library.learn')}</button>
            <button onClick={exportJson}>{t('constructor.export')}</button>
          </div>
        </header>

        <section className="form">
          <h4>{t('constructor.ball')}</h4>
          <Slider label={t('constructor.launchX')} unit={t('units.m')} min={-4} max={4} step={0.1} value={launch.x} onChange={(x) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, launch: { ...launch, x } } }))} />
          <Slider label={t('constructor.bounceX')} unit={t('units.m')} min={-5} max={5} step={0.1} value={ball.bounce.x} onChange={(x) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, bounce: { ...d.incomingBall.bounce, x } } }))} />
          <Slider label={t('constructor.bounceY')} unit={t('units.m')} min={-12.5} max={-1} step={0.1} value={ball.bounce.y} onChange={(y) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, bounce: { ...d.incomingBall.bounce, y } } }))} />
          <Slider label={t('constructor.speed')} unit={t('units.kmh')} digits={0} min={30} max={140} step={1} value={ball.speedKmh} onChange={(speedKmh) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, speedKmh } }))} />
          <label>{t('constructor.spinType')}</label>
          <Seg value={ball.spin} onChange={(spin) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, spin, spinRpm: undefined } }))} options={(['flat', 'topspin', 'slice'] as const).map((v) => ({ v, label: t(`spin.${v}`) }))} />
          <label className="check">
            <input type="checkbox" checked={ball.apexM === undefined} onChange={(e) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, apexM: e.target.checked ? undefined : Math.round(plan.incoming.apex * 10) / 10 } }))} />
            {t('constructor.apex')}: {t('constructor.apexAuto')}
          </label>
          {ball.apexM !== undefined && (
            <Slider label={t('constructor.apex')} unit={t('units.m')} min={1} max={6} step={0.05} value={ball.apexM} onChange={(apexM) => set((d) => ({ ...d, incomingBall: { ...d.incomingBall, apexM } }))} />
          )}
          <label>{t('constructor.surface')}</label>
          <Seg value={draft.surface} onChange={(surface) => set((d) => ({ ...d, surface }))} options={(['hard', 'clay', 'grass'] as const).map((v) => ({ v, label: t(`surface.${v}`) }))} />

          <h4>{t('constructor.player')}</h4>
          <Slider label={t('constructor.startX')} unit={t('units.m')} min={-4} max={4} step={0.1} value={draft.player.start.x} onChange={(x) => set((d) => ({ ...d, player: { ...d.player, start: { ...d.player.start, x } } }))} />
          <Slider label={t('constructor.startY')} unit={t('units.m')} min={-15} max={-6} step={0.1} value={draft.player.start.y} onChange={(y) => set((d) => ({ ...d, player: { ...d.player, start: { ...d.player.start, y } } }))} />
          <label>{t('constructor.shot')}</label>
          <Seg value={draft.task.shot} onChange={(shot) => set((d) => ({ ...d, task: { ...d.task, shot } }))} options={(['forehand', 'backhand'] as const).map((v) => ({ v, label: t(`shot.${v}`) }))} />
          <label>{t('constructor.goal')}</label>
          <Seg value={draft.task.goal} onChange={(goal) => set((d) => ({ ...d, task: { ...d.task, goal } }))} options={(['defensive', 'neutral', 'attacking'] as const).map((v) => ({ v, label: t(`goal.${v}`) }))} />
          <label>{t('lesson.stanceExplorer')}</label>
          <Seg<Stance | 'auto'>
            value={stance ?? 'auto'}
            onChange={(v) => setStance(v === 'auto' ? null : v)}
            options={[{ v: 'auto', label: t('lesson.stanceAuto') }, ...STANCES.map((v) => ({ v, label: t(`stance.${v}`) }))]}
          />
          <p className="muted small">
            {t('handedness.' + profile.handedness)} · {t('stroke.' + plan.stroke.kind)} · {t('level.' + profile.level)} · {profile.heightCm} {t('units.cm')}
          </p>
        </section>

        <DecisionSummary plan={plan} />
        <section>
          <h4>{t('camera.title')}</h4>
          <CameraBar view={settings.camera} onView={(camera) => setSettings({ camera })} />
          <h4>{t('layers.title')}</h4>
          <LayerToggles layers={settings.layers} onChange={setLayers} />
        </section>
      </aside>
    </div>
  );
}
