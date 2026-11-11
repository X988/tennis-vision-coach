import { COURT_HALF_LENGTH, SINGLES_HALF_WIDTH, SURFACES, SurfaceId, msToKmh, radSToRpm } from '../../engines/physics';
import { PRESETS, RallyResult, ScenarioConfig, ShotConfig, ShotResult } from '../../engines/rally';
import { STROKES, StrokeId } from '../../engines/strokes';
import { length } from '../../engines/vector';
import { Slider } from './Slider';

interface ControlPanelProps {
  presetId: string | null;
  config: ScenarioConfig;
  rally: RallyResult;
  showTrajectory: boolean;
  onPreset: (id: string) => void;
  onConfig: (config: ScenarioConfig) => void;
  onShowTrajectory: (show: boolean) => void;
}

const fmt = (v: number, digits = 2) => v.toFixed(digits);

function ShotSliders({
  title,
  shot,
  side,
  onChange,
}: {
  title: string;
  shot: ShotConfig;
  side: -1 | 1;
  onChange: (shot: ShotConfig) => void;
}) {
  const margin = 1.5;
  const zMin = side < 0 ? -COURT_HALF_LENGTH - margin : 0.5;
  const zMax = side < 0 ? -0.5 : COURT_HALF_LENGTH + margin;
  return (
    <fieldset>
      <legend>{title}</legend>
      <Slider
        label="Speed"
        unit="km/h"
        digits={0}
        min={40}
        max={230}
        step={1}
        value={shot.speedKmh}
        onChange={(speedKmh) => onChange({ ...shot, speedKmh })}
      />
      <Slider
        label="Spin (− slice / + topspin)"
        unit="rpm"
        digits={0}
        min={-3500}
        max={4500}
        step={50}
        value={shot.spinRpm}
        onChange={(spinRpm) => onChange({ ...shot, spinRpm })}
      />
      <Slider
        label="Target across"
        unit="m"
        min={-SINGLES_HALF_WIDTH - margin}
        max={SINGLES_HALF_WIDTH + margin}
        step={0.1}
        value={shot.target.x}
        onChange={(x) => onChange({ ...shot, target: { ...shot.target, x } })}
      />
      <Slider
        label="Target along (net = 0)"
        unit="m"
        min={zMin}
        max={zMax}
        step={0.1}
        value={shot.target.z}
        onChange={(z) => onChange({ ...shot, target: { ...shot.target, z } })}
      />
    </fieldset>
  );
}

function Verdict({ inside }: { inside: boolean | null }) {
  if (inside === null) return <span className="tag">no bounce</span>;
  return <span className={`tag ${inside ? 'in' : 'out'}`}>{inside ? 'IN' : 'OUT'}</span>;
}

function ShotStats({ title, shot }: { title: string; shot: ShotResult }) {
  const firstBounce = shot.flight.bounces[0];
  const kick = firstBounce ? (firstBounce.velOut.y / Math.max(1e-6, -firstBounce.velIn.y)) * 100 : null;
  return (
    <div className="stats-block">
      <h4>
        {title} <Verdict inside={shot.inside} />
      </h4>
      <dl>
        <dt>Launch angle</dt>
        <dd>{fmt((shot.solution.elevation * 180) / Math.PI, 1)}°</dd>
        <dt>Net clearance</dt>
        <dd className={shot.netCrossing && shot.netCrossing.clearance < 0 ? 'bad' : ''}>
          {shot.netCrossing ? `${fmt(shot.netCrossing.clearance)} m` : '—'}
        </dd>
        {firstBounce && (
          <>
            <dt>Speed before / after bounce</dt>
            <dd>
              {fmt(msToKmh(length(firstBounce.velIn)), 0)} / {fmt(msToKmh(length(firstBounce.velOut)), 0)} km/h
            </dd>
            <dt>Vertical rebound</dt>
            <dd>{fmt(kick ?? 0, 0)} %</dd>
          </>
        )}
        <dt>Spin</dt>
        <dd>{fmt(radSToRpm(length(shot.solution.spin)), 0)} rpm</dd>
      </dl>
    </div>
  );
}

export function ControlPanel({
  presetId,
  config,
  rally,
  showTrajectory,
  onPreset,
  onConfig,
  onShowTrajectory,
}: ControlPanelProps) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const set = (patch: Partial<ScenarioConfig>) => onConfig({ ...config, ...patch });

  return (
    <aside className="panel">
      <header>
        <h1>Tennis Vision Coach</h1>
        <p className="muted">{preset ? preset.description : 'Custom scenario'}</p>
      </header>

      <details open>
        <summary>Scenario</summary>
        <div className="row">
          <label>
            Preset
            <select value={presetId ?? ''} onChange={(e) => onPreset(e.target.value)}>
              {!preset && <option value="">Custom</option>}
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row two">
          <label>
            Stroke
            <select value={config.stroke} onChange={(e) => set({ stroke: e.target.value as StrokeId })}>
              {Object.values(STROKES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Surface
            <select value={config.surface} onChange={(e) => set({ surface: e.target.value as SurfaceId })}>
              {Object.values(SURFACES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Slider
          label="Contact depth behind baseline"
          unit="m"
          min={-2}
          max={3}
          step={0.1}
          value={config.contactDepth}
          onChange={(contactDepth) => set({ contactDepth })}
        />
        <label className="check">
          <input type="checkbox" checked={showTrajectory} onChange={(e) => onShowTrajectory(e.target.checked)} />
          Show trajectory and bounce marks
        </label>
      </details>

      <details open>
        <summary>Incoming ball</summary>
        <ShotSliders
          title={config.serve ? 'Serve' : 'Opponent shot'}
          shot={config.incoming}
          side={-1}
          onChange={(s) => set({ incoming: { ...config.incoming, ...s } })}
        />
      </details>

      <details>
        <summary>Your reply</summary>
        <ShotSliders title="Reply" shot={config.outgoing} side={1} onChange={(outgoing) => set({ outgoing })} />
      </details>

      <details open>
        <summary>Analysis</summary>
        {rally.warnings.length > 0 && (
          <ul className="warnings">
            {rally.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="stats-block">
          <h4>Contact</h4>
          <dl>
            <dt>Time to contact</dt>
            <dd>{fmt(rally.contact.t)} s</dd>
            <dt>Contact height</dt>
            <dd>{fmt(rally.contact.pos.y)} m</dd>
            <dt>Distance to baseline</dt>
            <dd>{fmt(-rally.contact.pos.z - COURT_HALF_LENGTH)} m</dd>
          </dl>
        </div>
        <ShotStats title={config.serve ? 'Serve' : 'Incoming'} shot={rally.incoming} />
        <ShotStats title="Reply" shot={rally.outgoing} />
      </details>
    </aside>
  );
}
