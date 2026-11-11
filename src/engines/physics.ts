/**
 * Tennis ball flight physics.
 *
 * Coordinate system (metres, seconds):
 *   x — across the court, y — up, z — along the court (net at z = 0).
 *   The coached player stands on the -z side, the opponent on the +z side.
 *
 * Model:
 *   - gravity, quadratic air drag and Magnus lift (spin), integrated with RK4;
 *   - bounce with coefficient of restitution and Coulomb friction that can
 *     bring the ball into rolling (changes both horizontal speed and spin).
 */
import {
  UP,
  Vec3,
  add,
  addScaled,
  clamp,
  cross,
  dot,
  horizontal,
  length,
  lerp,
  normalize,
  scale,
  sub,
  vec,
} from './vector';

export const BALL_RADIUS = 0.0335;
export const BALL_MASS = 0.057;
export const AIR_DENSITY = 1.21;
export const DRAG_COEFFICIENT = 0.55;
export const GRAVITY = 9.81;

export const COURT_HALF_LENGTH = 11.885;
export const SINGLES_HALF_WIDTH = 4.115;
export const DOUBLES_HALF_WIDTH = 5.485;
export const SERVICE_LINE_DIST = 6.4;
export const NET_HEIGHT_CENTER = 0.914;
export const NET_HEIGHT_POST = 1.07;
/** Net posts stand 0.914 m outside the doubles sidelines. */
export const NET_POST_X = DOUBLES_HALF_WIDTH + 0.914;

/** I / (m r^2) of a pressurised tennis ball (thin-ish hollow shell). */
const MOMENT_FACTOR = 0.55;
/** 0.5 * rho * A / m — shared factor of drag and lift accelerations. */
const AERO_K = (0.5 * AIR_DENSITY * Math.PI * BALL_RADIUS ** 2) / BALL_MASS;

export const DEFAULT_DT = 1 / 240;

export type SurfaceId = 'hard' | 'clay' | 'grass';

export interface Surface {
  id: SurfaceId;
  label: string;
  /** Vertical coefficient of restitution. */
  restitution: number;
  /** Sliding friction coefficient between ball and court. */
  friction: number;
}

export const SURFACES: Record<SurfaceId, Surface> = {
  hard: { id: 'hard', label: 'Hard', restitution: 0.76, friction: 0.55 },
  clay: { id: 'clay', label: 'Clay', restitution: 0.8, friction: 0.8 },
  grass: { id: 'grass', label: 'Grass', restitution: 0.7, friction: 0.4 },
};

export interface BallState {
  pos: Vec3;
  vel: Vec3;
  /** Angular velocity vector, rad/s. */
  spin: Vec3;
}

export interface Sample {
  t: number;
  pos: Vec3;
}

export interface BounceEvent {
  t: number;
  pos: Vec3;
  velIn: Vec3;
  velOut: Vec3;
}

export interface NetCrossing {
  t: number;
  pos: Vec3;
  /** Distance between the bottom of the ball and the top of the net (negative = into the net). */
  clearance: number;
}

export interface FlightResult {
  samples: Sample[];
  bounces: BounceEvent[];
  netCrossing: NetCrossing | null;
  final: BallState;
  duration: number;
}

export const kmhToMs = (kmh: number) => kmh / 3.6;
export const msToKmh = (ms: number) => ms * 3.6;
export const rpmToRadS = (rpm: number) => (rpm * 2 * Math.PI) / 60;
export const radSToRpm = (w: number) => (w * 60) / (2 * Math.PI);

/** Net height at lateral position x (linear sag model between centre strap and posts). */
export function netHeightAt(x: number): number {
  const k = clamp(Math.abs(x) / NET_POST_X, 0, 1);
  return NET_HEIGHT_CENTER + (NET_HEIGHT_POST - NET_HEIGHT_CENTER) * k;
}

/**
 * Horizontal axis around which positive values mean topspin for a ball
 * travelling along `dir` (negative values mean backspin / slice).
 */
export function topspinAxis(dir: Vec3): Vec3 {
  return normalize(cross(UP, horizontal(dir)));
}

export function spinVector(dir: Vec3, topspinRpm: number): Vec3 {
  return scale(topspinAxis(dir), rpmToRadS(topspinRpm));
}

/** Lift coefficient as a function of spin ratio S = r*w/v (empirical fit for tennis balls). */
export function liftCoefficient(speed: number, spinRate: number): number {
  if (speed < 1e-6 || spinRate < 1e-6) return 0;
  const s = (BALL_RADIUS * spinRate) / speed;
  return 1 / (2 + 1 / s);
}

export function acceleration(vel: Vec3, spin: Vec3): Vec3 {
  const gravity = vec(0, -GRAVITY, 0);
  const speed = length(vel);
  if (speed < 1e-9) return gravity;
  const drag = scale(vel, -AERO_K * DRAG_COEFFICIENT * speed);
  const w = length(spin);
  if (w < 1e-9) return add(gravity, drag);
  // |w x v| / w = v * sin(angle); multiplied by v gives the v^2 scaling of lift.
  const magnus = scale(cross(spin, vel), (AERO_K * liftCoefficient(speed, w) * speed) / w);
  return add(add(gravity, drag), magnus);
}

/** One RK4 step of free flight (spin is assumed constant in the air). */
export function stepFlight(state: BallState, dt: number): BallState {
  const { pos, vel, spin } = state;
  const a1 = acceleration(vel, spin);
  const v2 = addScaled(vel, a1, dt / 2);
  const a2 = acceleration(v2, spin);
  const v3 = addScaled(vel, a2, dt / 2);
  const a3 = acceleration(v3, spin);
  const v4 = addScaled(vel, a3, dt);
  const a4 = acceleration(v4, spin);
  const dPos = add(add(vel, scale(add(v2, v3), 2)), v4);
  const dVel = add(add(a1, scale(add(a2, a3), 2)), a4);
  return {
    pos: addScaled(pos, dPos, dt / 6),
    vel: addScaled(vel, dVel, dt / 6),
    spin,
  };
}

/**
 * Bounce off the court. Vertical speed is reversed and scaled by the
 * restitution. Friction acts against the slip of the contact point and is
 * limited by the impulse that would bring the ball into pure rolling.
 */
export function bounce(state: BallState, surface: Surface): BallState {
  const { vel, spin } = state;
  const vyOut = -surface.restitution * vel.y;
  const vh = horizontal(vel);
  const speedH = length(vh);
  const pos = vec(state.pos.x, BALL_RADIUS, state.pos.z);
  if (speedH < 1e-9) return { pos, vel: vec(0, vyOut, 0), spin };

  const dir = scale(vh, 1 / speedH);
  const axis = topspinAxis(dir);
  const wTop = dot(spin, axis);
  // Velocity of the contact point relative to the court, along dir.
  const slip = speedH - wTop * BALL_RADIUS;
  const maxImpulse = surface.friction * (1 + surface.restitution) * Math.abs(vel.y);
  const rollImpulse = (Math.abs(slip) * MOMENT_FACTOR) / (1 + MOMENT_FACTOR);
  const j = Math.sign(slip) * Math.min(maxImpulse, rollImpulse);

  const speedHOut = speedH - j;
  const dW = j / (MOMENT_FACTOR * BALL_RADIUS);
  return {
    pos,
    vel: vec(dir.x * speedHOut, vyOut, dir.z * speedHOut),
    spin: addScaled(spin, axis, dW),
  };
}

export interface FlightOptions {
  surface: Surface;
  dt?: number;
  maxTime?: number;
  /** Called after every integration step; return true to stop the flight. */
  stop?: (state: BallState, t: number, bounceCount: number) => boolean;
}

const lerpState = (a: BallState, b: BallState, f: number): BallState => ({
  pos: lerp(a.pos, b.pos, f),
  vel: lerp(a.vel, b.vel, f),
  spin: a.spin,
});

/** Simulates flight with bounces until `stop` returns true or `maxTime` is reached. */
export function simulateFlight(initial: BallState, options: FlightOptions): FlightResult {
  const dt = options.dt ?? DEFAULT_DT;
  const maxTime = options.maxTime ?? 6;
  const samples: Sample[] = [{ t: 0, pos: initial.pos }];
  const bounces: BounceEvent[] = [];
  let netCrossing: NetCrossing | null = null;
  let state = initial;
  let t = 0;

  while (t < maxTime) {
    let next = stepFlight(state, dt);
    let stepDt = dt;

    if (!netCrossing && state.pos.z !== 0 && Math.sign(state.pos.z) !== Math.sign(next.pos.z)) {
      const f = state.pos.z / (state.pos.z - next.pos.z);
      const at = lerpState(state, next, f);
      netCrossing = {
        t: t + f * dt,
        pos: at.pos,
        clearance: at.pos.y - BALL_RADIUS - netHeightAt(at.pos.x),
      };
    }

    if (next.pos.y < BALL_RADIUS && next.vel.y < 0) {
      // Cut the step at the moment of ground contact and bounce there.
      const f = clamp((state.pos.y - BALL_RADIUS) / (state.pos.y - next.pos.y), 0, 1);
      const contact = lerpState(state, next, f);
      const out = bounce(contact, options.surface);
      stepDt = f * dt;
      bounces.push({ t: t + stepDt, pos: out.pos, velIn: contact.vel, velOut: out.vel });
      next = out;
    }

    t += stepDt;
    state = next;
    samples.push({ t, pos: state.pos });
    if (options.stop?.(state, t, bounces.length)) break;
    if (state.pos.y < -1) break; // safety net, should never happen
  }

  return { samples, bounces, netCrossing, final: state, duration: t };
}

export interface LaunchRequest {
  start: Vec3;
  target: { x: number; z: number };
  speed: number; // m/s
  spinRpm: number; // positive = topspin, negative = backspin
  surface: Surface;
  /** Integration step for the search (coarser = faster). */
  dt?: number;
}

export interface LaunchSolution {
  vel: Vec3;
  spin: Vec3;
  /** Launch elevation, radians (negative = downwards). */
  elevation: number;
  /** True if the ball lands within 5 cm of the target. */
  reachable: boolean;
  landing: Vec3;
}

const MIN_ELEVATION = -0.6;
const MAX_ELEVATION = 1.0;

/**
 * Root of a monotonically increasing function on [lo, hi] (Illinois variant
 * of regula falsi). Returns the clamped end if there is no sign change.
 */
export function solveMonotonic(f: (x: number) => number, lo: number, hi: number, tol = 1e-3, maxIter = 40) {
  let fa = f(lo);
  let fb = f(hi);
  if (fa >= 0) return { x: lo, ok: Math.abs(fa) < tol };
  if (fb <= 0) return { x: hi, ok: Math.abs(fb) < tol };
  let a = lo;
  let b = hi;
  let side = 0;
  for (let i = 0; i < maxIter; i++) {
    const x = (a * fb - b * fa) / (fb - fa);
    const fx = f(x);
    if (Math.abs(fx) < tol || Math.abs(b - a) < 1e-9) return { x, ok: true };
    if (fx < 0) {
      a = x;
      fa = fx;
      if (side === -1) fb /= 2;
      side = -1;
    } else {
      b = x;
      fb = fx;
      if (side === 1) fa /= 2;
      side = 1;
    }
  }
  return { x: (a + b) / 2, ok: false };
}

function launchState(req: LaunchRequest, dir: Vec3, elevation: number): BallState {
  const vel = vec(
    dir.x * Math.cos(elevation) * req.speed,
    Math.sin(elevation) * req.speed,
    dir.z * Math.cos(elevation) * req.speed,
  );
  return { pos: req.start, vel, spin: spinVector(dir, req.spinRpm) };
}

function firstBounceFlight(req: LaunchRequest, dir: Vec3, elevation: number): FlightResult {
  return simulateFlight(launchState(req, dir, elevation), {
    surface: req.surface,
    dt: req.dt,
    maxTime: 8,
    stop: (_s, _t, bounces) => bounces > 0,
  });
}

/**
 * Finds the (lowest) launch elevation so that a ball hit from `start` with
 * the given speed and spin first lands on `target`. Without side spin the
 * flight stays in the vertical plane through start and target, so only the
 * elevation has to be searched.
 */
export function solveLaunch(req: LaunchRequest): LaunchSolution & { flight: FlightResult } {
  const toTarget = sub(vec(req.target.x, BALL_RADIUS, req.target.z), req.start);
  const dir = normalize(horizontal(toTarget));
  const distance = length(horizontal(toTarget));
  const along = (e: number) => {
    const f = firstBounceFlight(req, dir, e);
    const p = f.bounces[0]?.pos ?? f.final.pos;
    return dot(horizontal(sub(p, req.start)), dir) - distance;
  };

  // Coarse scan for the first elevation that reaches the target (the low,
  // "tennis" root), then refine inside that bracket.
  const steps = 16;
  let prev = MIN_ELEVATION;
  let bracket: [number, number] | null = null;
  let best = { e: MIN_ELEVATION, err: Infinity };
  for (let i = 0; i <= steps; i++) {
    const e = MIN_ELEVATION + ((MAX_ELEVATION - MIN_ELEVATION) * i) / steps;
    const d = along(e);
    if (Math.abs(d) < best.err) best = { e, err: Math.abs(d) };
    if (d >= 0) {
      if (i > 0) bracket = [prev, e];
      break;
    }
    prev = e;
  }
  const elevation = bracket ? solveMonotonic(along, bracket[0], bracket[1], 0.002).x : best.e;

  const initial = launchState(req, dir, elevation);
  const flight = firstBounceFlight(req, dir, elevation);
  const landing = flight.bounces[0]?.pos ?? flight.final.pos;
  const miss = length(horizontal(sub(landing, vec(req.target.x, 0, req.target.z))));
  return { vel: initial.vel, spin: initial.spin, elevation, reachable: miss < 0.05, landing, flight };
}
