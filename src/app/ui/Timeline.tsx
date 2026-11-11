import { useEffect } from 'react';
import { FRAME, RATES, SimulationClock } from '../../engines/clock';
import { Plan, PhaseId } from '../../engines/plan';
import { useClockState } from '../hooks';
import { useT } from '../i18n';
import { formatRelative } from '../format';

const PHASE_COLORS: Record<PhaseId, string> = {
  ready: '#64748b',
  split_step: '#a78bfa',
  read_turn: '#f472b6',
  movement: '#60a5fa',
  footwork: '#22d3ee',
  acceleration: '#fb923c',
  contact: '#ffffff',
  follow_through: '#facc15',
  recovery: '#4ade80',
  feedback: '#334155',
};

/** Rows so overlapping phases (turn while moving) stay visible. */
const ROW: Record<PhaseId, number> = {
  ready: 0, split_step: 0, movement: 0, footwork: 0, acceleration: 0, contact: 0, follow_through: 0, recovery: 0, feedback: 0, read_turn: 1,
};

interface Props {
  plan: Plan;
  clock: SimulationClock;
  rate: number;
  onRate: (r: number) => void;
  keyboard?: boolean;
}

export function Timeline({ plan, clock, rate, onRate, keyboard = true }: Props) {
  const t = useT();
  const { time, playing } = useClockState(clock);
  const pct = (x: number) => `${(x / plan.duration) * 100}%`;
  const marks = [...plan.phases, ...plan.events];

  useEffect(() => {
    if (!keyboard) return;
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') clock.toggle();
      else if (e.key === 'ArrowRight') {
        if (e.shiftKey) clock.jump(marks, 1);
        else clock.step(FRAME);
      } else if (e.key === 'ArrowLeft') {
        if (e.shiftKey) clock.jump(marks, -1);
        else clock.step(-FRAME);
      }
      else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') clock.step(plan.contact.t - clock.time);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <div className="timeline">
      <div className="tl-track">
        {plan.phases.map((p) => (
          <button
            key={p.id}
            className="tl-phase"
            title={t(`phase.${p.id}.name`)}
            style={{ left: pct(p.start), width: `max(3px, ${pct(p.end - p.start)})`, top: ROW[p.id] * 9, background: PHASE_COLORS[p.id] }}
            onClick={() => clock.step(p.start - clock.time)}
          />
        ))}
        {plan.events.map((e) => (
          <span key={e.id} className={`tl-event ${e.id === 'contact' ? 'is-contact' : ''}`} style={{ left: pct(e.t) }} title={`${t(`event.${e.id}`)} · ${formatRelative(t, e.t, plan.contact.t)}`} />
        ))}
        <input
          className="tl-scrub"
          aria-label="timeline"
          type="range"
          min={0}
          max={plan.duration}
          step={0.005}
          value={time}
          onChange={(e) => clock.seek(Number(e.target.value))}
        />
      </div>
      <div className="tl-controls">
        <button className="icon" title={t('timeline.phaseBack')} aria-label={t('timeline.phaseBack')} onClick={() => clock.jump(marks, -1)}>⏮</button>
        <button className="icon" title={t('timeline.frameBack')} aria-label={t('timeline.frameBack')} onClick={() => clock.step(-FRAME)}>◀︎</button>
        <button className="icon primary" title={playing ? t('timeline.pause') : t('timeline.play')} aria-label={playing ? t('timeline.pause') : t('timeline.play')} onClick={() => clock.toggle()}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon" title={t('timeline.frameFwd')} aria-label={t('timeline.frameFwd')} onClick={() => clock.step(FRAME)}>▶︎|</button>
        <button className="icon" title={t('timeline.phaseFwd')} aria-label={t('timeline.phaseFwd')} onClick={() => clock.jump(marks, 1)}>⏭</button>
        <span className="tl-time">{formatRelative(t, time, plan.contact.t)}</span>
        <select className="rate-select" aria-label={t('timeline.speed')} value={rate} onChange={(e) => onRate(Number(e.target.value))}>
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
        <span className="seg rate-seg" role="group" aria-label={t('timeline.speed')}>
          {RATES.map((r) => (
            <button key={r} className={r === rate ? 'active' : ''} onClick={() => onRate(r)}>
              {r}×
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
