/**
 * Reachability Engine: which contact points can the player get to in time,
 * taking start position, reaction, acceleration, top speed and the time the
 * stance must be set before contact into account.
 */
import { PLAYER_FORWARD } from './court';
import { COURT_HALF_LENGTH, FlightResult } from './physics';
import { Athletics, travelTime } from './profile';
import { Goal } from './scenario';
import { StrokeGeometry } from './technique';
import { Vec3, addScaled, horizontal, length, sub, vec } from './vector';

export type ReachStatus = 'ok' | 'defensive' | 'unreachable';

export interface ContactCandidate {
  /** Simulation time of the contact. */
  t: number;
  pos: Vec3;
  /** Pelvis ground position needed for this contact. */
  hit: Vec3;
  distance: number;
  travel: number;
  /** Spare time (s) between being set and contact; negative = late. */
  margin: number;
  score: number;
}

export interface ReachInput {
  flight: FlightResult;
  /** Simulation time of the opponent's contact (flight t = 0). */
  tOpp: number;
  start: Vec3;
  stroke: StrokeGeometry;
  /** Ball side unit vector. */
  side: Vec3;
  athletics: Athletics;
  goal: Goal;
  /** Modifiers used for error variants. */
  reactionExtra?: number;
  setupExtra?: number;
  lateralAdjust?: number;
}

export interface ReachResult {
  status: ReachStatus;
  best: ContactCandidate;
  /** Time window (sim time) in which a contact is reachable, null if none. */
  window: [number, number] | null;
  candidates: ContactCandidate[];
  moveStart: number;
  lateral: number;
  forward: number;
}

export function contactOffset(stroke: StrokeGeometry, heightM: number, lateralAdjust = 0) {
  const k = heightM / 1.75;
  return { lateral: stroke.lateral * k + lateralAdjust, forward: stroke.forward * k };
}

export function hitPositionFor(contact: Vec3, side: Vec3, lateral: number, forward: number): Vec3 {
  const p = addScaled(addScaled(horizontal(contact), side, -lateral), PLAYER_FORWARD, -forward);
  return vec(p.x, 0, p.z);
}

const IDEAL_HEIGHT: Record<Goal, number> = { attacking: 1.15, neutral: 1.0, defensive: 0.95 };

function scoreCandidate(c: Omit<ContactCandidate, 'score'>, goal: Goal, heightM: number) {
  const k = heightM / 1.75;
  let s = -2 * Math.abs(c.pos.y - IDEAL_HEIGHT[goal] * k) + 3 * Math.min(c.margin, 0.25);
  if (goal === 'attacking') s += 0.6 * (c.pos.z + COURT_HALF_LENGTH);
  else if (goal === 'neutral') s -= 0.5 * Math.abs(c.pos.z + COURT_HALF_LENGTH + 0.5);
  else s += 0.5 * Math.min(c.margin, 1);
  return s;
}

function collect(input: ReachInput, opts: { stretch: number; setupFactor: number; minHeight: number }) {
  const { flight, athletics: a } = input;
  const firstBounce = flight.bounces[0];
  const moveStart = input.tOpp + a.reaction + (input.reactionExtra ?? 0);
  const { lateral, forward } = contactOffset(input.stroke, a.heightM, (input.lateralAdjust ?? 0) + opts.stretch);
  const setup = a.setupTime * opts.setupFactor + (input.setupExtra ?? 0);
  const out: ContactCandidate[] = [];
  if (!firstBounce) return { out, moveStart, lateral, forward };
  for (let i = 0; i < flight.samples.length; i += 2) {
    const smp = flight.samples[i];
    if (smp.t <= firstBounce.t + 0.03) continue;
    if (flight.bounces[1] && smp.t >= flight.bounces[1].t) break;
    const p = smp.pos;
    if (p.y < Math.max(opts.minHeight, 0.1) || p.y > a.contactBand[1]) continue;
    if (p.z > -1 || p.z < -(COURT_HALF_LENGTH + 4.5)) continue;
    const ideal = hitPositionFor(p, input.side, lateral, forward);
    // The player may lean / extend instead of the last few centimetres of running.
    const full = length(sub(ideal, input.start));
    const distance = Math.max(0, full - a.reachTolerance);
    const hit = full > 1e-6 ? addScaled(input.start, sub(ideal, input.start), distance / full) : ideal;
    const travel = travelTime(distance, a);
    const t = input.tOpp + smp.t;
    const margin = t - setup - (moveStart + travel);
    const c = { t, pos: p, hit, distance, travel, margin };
    out.push({ ...c, score: scoreCandidate(c, input.goal, a.heightM) });
  }
  return { out, moveStart, lateral, forward };
}

export function evaluateReach(input: ReachInput): ReachResult {
  const a = input.athletics;
  const normal = collect(input, { stretch: 0, setupFactor: 1, minHeight: a.contactBand[0] });
  const feasible = normal.out.filter((c) => c.margin >= 0);
  const windowOf = (cs: ContactCandidate[]): [number, number] | null =>
    cs.length ? [Math.min(...cs.map((c) => c.t)), Math.max(...cs.map((c) => c.t))] : null;
  const pick = (cs: ContactCandidate[]) => cs.reduce((b, c) => (c.score > b.score ? c : b));

  if (feasible.length) {
    return { status: 'ok', best: pick(feasible), window: windowOf(feasible), candidates: normal.out, moveStart: normal.moveStart, lateral: normal.lateral, forward: normal.forward };
  }
  // Defensive alternative: stretch further, set up on the run, accept a lower ball.
  const def = collect(input, { stretch: 0.4 * (a.heightM / 1.75), setupFactor: 0.35, minHeight: 0.15 });
  const defFeasible = def.out.filter((c) => c.margin >= 0);
  if (defFeasible.length) {
    const best = defFeasible.reduce((b, c) => (c.margin > b.margin ? c : b));
    return { status: 'defensive', best, window: windowOf(defFeasible), candidates: def.out, moveStart: def.moveStart, lateral: def.lateral, forward: def.forward };
  }
  const all = normal.out.length ? normal.out : def.out;
  const src = normal.out.length ? normal : def;
  const fallback: ContactCandidate =
    all.length > 0
      ? all.reduce((b, c) => (c.margin > b.margin ? c : b))
      : {
          t: input.tOpp + input.flight.duration,
          pos: input.flight.final.pos,
          hit: hitPositionFor(input.flight.final.pos, input.side, src.lateral, src.forward),
          distance: 0,
          travel: 0,
          margin: -1,
          score: -Infinity,
        };
  return { status: 'unreachable', best: fallback, window: null, candidates: all, moveStart: src.moveStart, lateral: src.lateral, forward: src.forward };
}
