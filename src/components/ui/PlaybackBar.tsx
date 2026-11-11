import { Scenario } from '../../engines/Scenario';
import { RallyResult } from '../../engines/rally';
import { CAMERA_PRESETS, CameraPreset, RATES, STEP } from '../uiConstants';
import { ClockSnapshot } from '../../hooks/useScenarioClock';

interface PlaybackBarProps {
  scenario: Scenario;
  rally: RallyResult;
  clock: ClockSnapshot;
  rate: number;
  loop: boolean;
  camera: CameraPreset;
  onRate: (rate: number) => void;
  onLoop: (loop: boolean) => void;
  onCamera: (camera: CameraPreset) => void;
}

export function PlaybackBar({ scenario, rally, clock, rate, loop, camera, onRate, onLoop, onCamera }: PlaybackBarProps) {
  const pct = (t: number) => `${(t / rally.duration) * 100}%`;
  const bounceTimes = [
    ...rally.incoming.flight.bounces.map((b) => b.t),
    ...rally.outgoing.flight.bounces.map((b) => b.t + rally.contact.t),
  ];

  return (
    <div className="playback">
      <div className="timeline">
        <input
          aria-label="Timeline"
          type="range"
          min={0}
          max={rally.duration}
          step={0.005}
          value={clock.time}
          onChange={(e) => scenario.seek(Number(e.target.value))}
        />
        <div className="ticks" aria-hidden>
          {bounceTimes.map((t, i) => (
            <span key={i} className="tick bounce" style={{ left: pct(t) }} title="Bounce" />
          ))}
          <span className="tick contact" style={{ left: pct(rally.contact.t) }} title="Contact" />
        </div>
      </div>
      <div className="buttons">
        <button title="Reset (R)" onClick={() => scenario.reset()}>
          ⏮
        </button>
        <button title="Step back (←)" onClick={() => scenario.step(-STEP)}>
          ◀︎
        </button>
        <button className="primary" title="Play / pause (Space)" onClick={() => scenario.toggle()}>
          {clock.playing ? '❚❚' : '▶'}
        </button>
        <button title="Step forward (→)" onClick={() => scenario.step(STEP)}>
          ▶︎|
        </button>
        <button title="Jump to contact (C)" onClick={() => scenario.step(rally.contact.t - scenario.time)}>
          Contact
        </button>
        <span className="time">
          {clock.time.toFixed(2)} / {rally.duration.toFixed(2)} s
        </span>
        <select aria-label="Playback speed" value={rate} onChange={(e) => onRate(Number(e.target.value))}>
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} /> Loop
        </label>
        <span className="cams" role="group" aria-label="Camera">
          {CAMERA_PRESETS.map((c) => (
            <button
              key={c.id}
              className={camera === c.id ? 'active' : ''}
              title={`${c.label} (${c.key})`}
              onClick={() => onCamera(c.id)}
            >
              {c.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
