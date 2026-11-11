/**
 * A rally scenario: the opponent's incoming shot, the coached player's
 * stroke and the outgoing reply — all computed up-front so that playback,
 * scrubbing and stepping are exact and deterministic.
 */
import {
  BALL_RADIUS,
  COURT_HALF_LENGTH,
  FlightResult,
  LaunchSolution,
  NetCrossing,
  SERVICE_LINE_DIST,
  SINGLES_HALF_WIDTH,
  Sample,
  SurfaceId,
  SURFACES,
  kmhToMs,
  simulateFlight,
  solveLaunch,
} from './physics';
import {
  Pose,
  STROKES,
  StrokeDef,
  StrokeId,
  contactPose,
  poseAt,
  racketCenter,
  swingPhase,
} from './strokes';
import { Vec3, lerp, smoothstep, vec } from './vector';

export interface ShotConfig {
  target: { x: number; z: number };
  speedKmh: number;
  /** Positive = topspin, negative = backspin. */
  spinRpm: number;
}

export interface ScenarioConfig {
  stroke: StrokeId;
  surface: SurfaceId;
  /** Is the incoming ball a serve (must land in the receiver's deuce service box)? */
  serve: boolean;
  incoming: ShotConfig & { start: Vec3 };
  outgoing: ShotConfig;
  /**
   * Where the player meets the ball: metres behind the baseline (negative =
   * inside the court). A ball dropping below LOW_CONTACT_HEIGHT is hit earlier.
   */
  contactDepth: number;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  config: ScenarioConfig;
}

export const PRESETS: Preset[] = [
  {
    id: 'forehand',
    label: 'Forehand topspin',
    description: 'Deep rally ball to the forehand, cross-court topspin reply.',
    config: {
      stroke: 'forehand',
      surface: 'hard',
      serve: false,
      incoming: { start: vec(1.5, 1.0, 12.3), target: { x: -2.2, z: -9 }, speedKmh: 95, spinRpm: 1800 },
      outgoing: { target: { x: 2.8, z: 9 }, speedKmh: 110, spinRpm: 2600 },
      contactDepth: 0.8,
    },
  },
  {
    id: 'backhand',
    label: 'Backhand drive',
    description: 'Rally ball to the backhand, down-the-line reply.',
    config: {
      stroke: 'backhand',
      surface: 'hard',
      serve: false,
      incoming: { start: vec(-1.5, 1.0, 12.3), target: { x: 2.2, z: -8.8 }, speedKmh: 90, spinRpm: 1600 },
      outgoing: { target: { x: 3.0, z: 9.5 }, speedKmh: 100, spinRpm: 1600 },
      contactDepth: 0.8,
    },
  },
  {
    id: 'slice',
    label: 'Backhand slice',
    description: 'Heavy topspin to the backhand, low skidding slice reply.',
    config: {
      stroke: 'slice',
      surface: 'grass',
      serve: false,
      incoming: { start: vec(-1.0, 1.0, 12.3), target: { x: 2.0, z: -9.2 }, speedKmh: 85, spinRpm: 2500 },
      outgoing: { target: { x: 0, z: 9.8 }, speedKmh: 85, spinRpm: -2200 },
      contactDepth: 0.3,
    },
  },
  {
    id: 'return',
    label: 'Serve return',
    description: 'Flat-ish first serve to the deuce box, forehand block return.',
    config: {
      stroke: 'forehand',
      surface: 'hard',
      serve: true,
      incoming: { start: vec(0.8, 2.9, 11.9), target: { x: -2.6, z: -5.8 }, speedKmh: 175, spinRpm: 1200 },
      outgoing: { target: { x: -0.5, z: 8.5 }, speedKmh: 95, spinRpm: 1000 },
      contactDepth: 1.2,
    },
  },
];

export const READY_POSITION: Vec3 = Object.freeze(vec(0, 0, -(COURT_HALF_LENGTH + 0.6)));

export interface ShotResult {
  solution: LaunchSolution;
  flight: FlightResult;
  /** Offset of this shot's local time within the rally. */
  startTime: number;
  bounce: Vec3 | null;
  netCrossing: NetCrossing | null;
  /** Did the first bounce land inside the intended zone? */
  inside: boolean | null;
}

export interface RallyResult {
  config: ScenarioConfig;
  stroke: StrokeDef;
  samples: Sample[];
  duration: number;
  incoming: ShotResult;
  outgoing: ShotResult;
  contact: { t: number; pos: Vec3 };
  player: { ready: Vec3; hit: Vec3; contactPose: Pose };
  warnings: string[];
}

const isInSingles = (p: Vec3, side: -1 | 1) =>
  Math.abs(p.x) <= SINGLES_HALF_WIDTH + BALL_RADIUS &&
  p.z * side >= -BALL_RADIUS &&
  p.z * side <= COURT_HALF_LENGTH + BALL_RADIUS;

/** Receiver's deuce service box (receiver's right = -x). */
const isInDeuceBox = (p: Vec3) =>
  p.x <= BALL_RADIUS &&
  p.x >= -SINGLES_HALF_WIDTH - BALL_RADIUS &&
  p.z <= BALL_RADIUS &&
  p.z >= -SERVICE_LINE_DIST - BALL_RADIUS;

/** The player never lets the ball drop lower than this before hitting it. */
export const LOW_CONTACT_HEIGHT = 0.4;

export function simulateRally(config: ScenarioConfig): RallyResult {
  const surface = SURFACES[config.surface];
  const stroke = STROKES[config.stroke];
  const warnings: string[] = [];

  // 1. Incoming shot — flies until the player can hit it.
  const contactZ = -(COURT_HALF_LENGTH + config.contactDepth);
  const inSolution = solveLaunch({
    start: config.incoming.start,
    target: config.incoming.target,
    speed: kmhToMs(config.incoming.speedKmh),
    spinRpm: config.incoming.spinRpm,
    surface,
  });
  const inFlight = simulateFlight(
    { pos: config.incoming.start, vel: inSolution.vel, spin: inSolution.spin },
    {
      surface,
      maxTime: 5,
      stop: (s, _t, bounces) =>
        s.pos.z <= contactZ ||
        bounces >= 2 ||
        (bounces >= 1 && s.vel.y <= 0 && s.pos.y <= LOW_CONTACT_HEIGHT),
    },
  );
  const contact = { t: inFlight.duration, pos: inFlight.final.pos };
  const inBounce = inFlight.bounces[0]?.pos ?? null;
  const incoming: ShotResult = {
    solution: inSolution,
    flight: inFlight,
    startTime: 0,
    bounce: inBounce,
    netCrossing: inFlight.netCrossing,
    inside: inBounce ? (config.serve ? isInDeuceBox(inBounce) : isInSingles(inBounce, -1)) : null,
  };
  if (!inSolution.reachable) warnings.push('Incoming shot cannot reach its target with this speed/spin.');
  if (inFlight.netCrossing && inFlight.netCrossing.clearance < 0) warnings.push('Incoming shot hits the net.');
  if (inFlight.bounces.length === 0) warnings.push('Ball is taken out of the air (volley) — no bounce before contact.');

  // 2. Outgoing reply from the contact point.
  const outSolution = solveLaunch({
    start: contact.pos,
    target: config.outgoing.target,
    speed: kmhToMs(config.outgoing.speedKmh),
    spinRpm: config.outgoing.spinRpm,
    surface,
  });
  const outFlight = simulateFlight(
    { pos: contact.pos, vel: outSolution.vel, spin: outSolution.spin },
    {
      surface,
      maxTime: 4,
      stop: (s, t, bounces) => bounces >= 2 || Math.abs(s.pos.z) > COURT_HALF_LENGTH + 6 || t > 3.5,
    },
  );
  const outBounce = outFlight.bounces[0]?.pos ?? null;
  const outgoing: ShotResult = {
    solution: outSolution,
    flight: outFlight,
    startTime: contact.t,
    bounce: outBounce,
    netCrossing: outFlight.netCrossing,
    inside: outBounce ? isInSingles(outBounce, 1) : null,
  };
  if (!outSolution.reachable) warnings.push('Reply cannot reach its target with this speed/spin.');
  if (outFlight.netCrossing && outFlight.netCrossing.clearance < 0) warnings.push('Reply hits the net.');

  // 3. Place the player so that the racket centre meets the ball at contact.
  const cPose = contactPose(stroke, contact.pos.y);
  const offset = racketCenter(cPose);
  const hit = vec(contact.pos.x - offset.x, 0, contact.pos.z - offset.z);

  const samples: Sample[] = [
    ...inFlight.samples,
    ...outFlight.samples.slice(1).map((s) => ({ t: s.t + contact.t, pos: s.pos })),
  ];

  return {
    config,
    stroke,
    samples,
    duration: contact.t + outFlight.duration + 0.5,
    incoming,
    outgoing,
    contact,
    player: { ready: READY_POSITION, hit, contactPose: cPose },
    warnings,
  };
}

/** Ball position at time t (linear interpolation between samples, binary search). */
export function ballPositionAt(rally: RallyResult, t: number): Vec3 {
  const s = rally.samples;
  if (t <= s[0].t) return s[0].pos;
  if (t >= s[s.length - 1].t) return s[s.length - 1].pos;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const span = s[hi].t - s[lo].t;
  return lerp(s[lo].pos, s[hi].pos, span > 0 ? (t - s[lo].t) / span : 0);
}

export interface PlayerState {
  position: Vec3;
  pose: Pose;
  phase: number;
}

/** Player position (moves to the ball, then recovers) and swing pose at time t. */
export function playerStateAt(rally: RallyResult, t: number): PlayerState {
  const { ready, hit, contactPose: cPose } = rally.player;
  const ct = rally.contact.t;
  const arriveBy = Math.max(0.3, ct - 0.2);
  const position =
    t <= ct
      ? lerp(ready, hit, smoothstep(t / arriveBy))
      : lerp(hit, ready, smoothstep((t - ct - 0.3) / 1.2));
  const phase = swingPhase(rally.stroke, t, ct);
  return { position, pose: poseAt(rally.stroke, phase, cPose), phase };
}
