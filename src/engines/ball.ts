/**
 * Ball Engine: turns the scenario's incoming-ball description into a full,
 * physically consistent flight (launch -> net -> bounce -> second bounce).
 *
 * Semantics (docs/SCENARIO_FORMAT.md):
 *  - speedKmh is the ball speed just before the bounce;
 *  - bounce is the first bounce point;
 *  - apexM (optional) is the highest point before the bounce. Speed and
 *    bounce fix launch speed and angle, so the apex is matched by the spin
 *    rate within the range of the chosen spin type.
 */
import {
  BallState,
  COURT_HALF_LENGTH,
  FlightResult,
  Surface,
  kmhToMs,
  msToKmh,
  simulateFlight,
  solveLaunch,
  solveMonotonic,
} from './physics';
import { SpinType } from './scenario';
import { Vec3, length } from './vector';

export const SPIN_RANGES: Record<SpinType, { min: number; max: number; default: number }> = {
  flat: { min: -200, max: 600, default: 200 },
  topspin: { min: 800, max: 4500, default: 2200 },
  slice: { min: -3500, max: -400, default: -1500 },
};

export interface IncomingInput {
  launch: Vec3;
  bounce: { x: number; z: number };
  arrivalKmh: number;
  spin: SpinType;
  spinRpm?: number;
  apexM?: number;
  surface: Surface;
}

export interface IncomingSolution {
  initial: BallState;
  launchSpeedKmh: number;
  arrivalSpeedKmh: number;
  spinRpm: number;
  elevation: number;
  apex: number;
  /** False if the requested apex/speed/bounce combination is impossible; nearest values are used. */
  matched: boolean;
  /** Full flight until the second bounce (or the ball leaves the court area). */
  flight: FlightResult;
}

const SEARCH_DT = 1 / 120;

function apexOf(f: FlightResult) {
  let m = -Infinity;
  for (const s of f.samples) m = Math.max(m, s.pos.y);
  return m;
}

function solveForArrival(input: IncomingInput, rpm: number) {
  const target = kmhToMs(input.arrivalKmh);
  const attempt = (v0: number) =>
    solveLaunch({ start: input.launch, target: input.bounce, speed: v0, spinRpm: rpm, surface: input.surface, dt: SEARCH_DT });
  const arrival = (v0: number) => {
    const sol = attempt(v0);
    const b = sol.flight.bounces[0];
    return b ? length(b.velIn) : 0;
  };
  const r = solveMonotonic((v0) => arrival(v0) - target, target * 0.98, target * 2.8, 0.05);
  const sol = attempt(r.x);
  return { v0: r.x, sol, ok: r.ok && sol.reachable };
}

export function solveIncoming(input: IncomingInput): IncomingSolution {
  const range = SPIN_RANGES[input.spin];
  let rpm = input.spinRpm ?? range.default;
  let matched = true;

  if (input.spinRpm === undefined && input.apexM !== undefined) {
    const apexAt = (r: number) => apexOf(solveForArrival(input, r).sol.flight) - input.apexM!;
    const r = solveMonotonic(apexAt, range.min, range.max, 0.02, 25);
    rpm = r.x;
    matched = r.ok;
  }

  const { v0, ok } = solveForArrival(input, rpm);
  matched = matched && ok;
  const sol = solveLaunch({ start: input.launch, target: input.bounce, speed: v0, spinRpm: rpm, surface: input.surface });
  const initial: BallState = { pos: input.launch, vel: sol.vel, spin: sol.spin };
  const flight = simulateFlight(initial, {
    surface: input.surface,
    maxTime: 5,
    stop: (s, _t, bounces) => bounces >= 2 || s.pos.z < -(COURT_HALF_LENGTH + 8) || Math.abs(s.pos.x) > 12,
  });
  const before = flight.samples.filter((s) => !flight.bounces[0] || s.t <= flight.bounces[0].t);
  const apex = Math.max(...before.map((s) => s.pos.y));
  const b = flight.bounces[0];
  return {
    initial,
    launchSpeedKmh: msToKmh(v0),
    arrivalSpeedKmh: b ? msToKmh(length(b.velIn)) : 0,
    spinRpm: rpm,
    elevation: sol.elevation,
    apex,
    matched: matched && (input.apexM === undefined || Math.abs(apex - input.apexM) < 0.1),
    flight,
  };
}
