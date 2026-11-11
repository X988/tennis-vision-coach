/**
 * Builds one complete, time-consistent lesson plan from a scenario:
 * Ball Engine -> Reachability Engine -> Decision Engine -> movement & stroke
 * plan (Animation Engine input) -> reply shot, all on one simulationTime.
 *
 * Any change of the scenario re-runs the whole chain, so contact time,
 * player position, stance, racket path and hints can never get out of sync.
 */
import { solveIncoming, IncomingSolution } from './ball';
import { courtToWorld, PLAYER_FORWARD, PLAYER_RIGHT } from './court';
import {
  Confidence,
  Direction,
  Option,
  PositionChoice,
  PrepTiming,
  Reason,
  UNIT_TURN_DURATION,
  decideFirstStep,
  decidePosition,
  decidePrepTiming,
  decideStance,
} from './decision';
import { COURT_HALF_LENGTH, FlightResult, SURFACES, Sample, kmhToMs, simulateFlight, solveLaunch } from './physics';
import { Athletics, Profile, athletics, travelTime } from './profile';
import { ContactCandidate, ReachResult, ReachStatus, contactOffset, evaluateReach, hitPositionFor } from './reachability';
import { ErrorVariant, ScenarioSpec, Stance, mirrorScenario } from './scenario';
import { STANCE_LAYOUTS, STROKES, StrokeGeometry, ballSide, dominantSide, strokeKind } from './technique';
import { Vec3, add, addScaled, dot, length, lerp, scale, sub, vec } from './vector';

export const T_OPPONENT = 0.8;
const SPLIT_LEAD = 0.18;
const SPLIT_AFTER = 0.06;

export type EventId =
  | 'opponent_hit'
  | 'split_step'
  | 'read'
  | 'net'
  | 'bounce'
  | 'stance_set'
  | 'acceleration'
  | 'contact'
  | 'reply_net'
  | 'reply_bounce'
  | 'recovered';

export type PhaseId =
  | 'ready'
  | 'split_step'
  | 'read_turn'
  | 'movement'
  | 'footwork'
  | 'acceleration'
  | 'contact'
  | 'follow_through'
  | 'recovery'
  | 'feedback';

export interface TimelineEvent {
  id: EventId;
  t: number;
}

export interface Phase {
  id: PhaseId;
  start: number;
  end: number;
}

export interface FootPlantPlan {
  pos: Vec3;
  /** World yaw of the toe direction (radians, atan2(x, z)). */
  yaw: number;
  start: number;
  end: number;
  kind: 'ready' | 'split' | 'step' | 'stance' | 'recovery';
}

export interface ScalarKey {
  t: number;
  v: number;
}

export interface RacketKeyPlan {
  t: number;
  /** Racket head centre relative to the pelvis ground point, in (s, f, y). */
  head: Vec3;
  dir: Vec3;
  offHand?: Vec3;
}

export interface PathSegment {
  t0: number;
  t1: number;
  from: Vec3;
  to: Vec3;
}

export interface MotionPlan {
  /** Unit vector to the ball side and the racket-hand side. */
  side: Vec3;
  dominant: Vec3;
  heightM: number;
  twoHanded: boolean;
  feet: { left: FootPlantPlan[]; right: FootPlantPlan[] };
  pelvisPath: PathSegment[];
  pelvisHeight: ScalarKey[];
  /** Facing angles (deg, towards `side`). */
  torsoFacing: ScalarKey[];
  pelvisFacing: ScalarKey[];
  /** Chest offset (s, f) from above the pelvis, metres. */
  leanS: ScalarKey[];
  leanF: ScalarKey[];
  racket: RacketKeyPlan[];
}

export interface ShotInfo {
  flight: FlightResult;
  startTime: number;
  target: Vec3;
  inside: boolean | null;
  netClearance: number | null;
  launchKmh: number;
}

export interface Plan {
  scenario: ScenarioSpec;
  profile: Profile;
  variant: ErrorVariant | null;
  stroke: StrokeGeometry;
  athletics: Athletics;
  stance: Stance;
  incoming: IncomingSolution;
  reach: ReachResult;
  status: ReachStatus;
  decision: {
    stance: { options: Option<Stance>[]; confidence: Confidence; firedRules: string[] };
    firstStep: { dir: Direction; options: Option<Direction>[]; dist: number };
    prep: { options: Option<PrepTiming>[]; slack: number; starts: Record<PrepTiming, number> };
    position: (Option<PositionChoice> & { candidate: ContactCandidate })[];
  };
  start: Vec3;
  hit: Vec3;
  recovery: Vec3;
  contact: { t: number; pos: Vec3; made: boolean };
  /** Ideal contact zone centre (at the real ball height) and whether the contact is inside it. */
  contactZone: { center: Vec3; radius: number; ok: boolean; error: { lateral: number; forward: number } };
  reply: ShotInfo | null;
  ball: Sample[];
  events: TimelineEvent[];
  phases: Phase[];
  motion: MotionPlan;
  duration: number;
  warnings: Reason[];
}

export interface PlanOptions {
  variant?: ErrorVariant | null;
  /** Show a specific stance instead of the recommended one (stance explorer). */
  stance?: Stance | null;
}

/** The scenario as seen by this profile (mirrored for the other hand). */
export function adaptScenario(s: ScenarioSpec, profile: Profile): ScenarioSpec {
  return s.player.handedness === profile.handedness ? s : mirrorScenario(s);
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * c * (10 + c * (-15 + 6 * c)); // minimum jerk
};

const facingVector = (deg: number, side: Vec3): Vec3 => {
  const a = (deg * Math.PI) / 180;
  return add(scale(PLAYER_FORWARD, Math.cos(a)), scale(side, Math.sin(a)));
};
export const yawOf = (v: Vec3) => Math.atan2(v.x, v.z);

const sfy = (side: Vec3, p: Vec3, origin: Vec3): Vec3 => {
  const d = sub(p, origin);
  return vec(dot(d, side), dot(d, PLAYER_FORWARD), p.y);
};
const tuple = (a: [number, number, number], k: number, ky = k) => vec(a[0] * k, a[1] * k, a[2] * ky);

function isInSingles(p: Vec3) {
  return Math.abs(p.x) <= 4.115 + 0.034 && p.z >= -0.034 && p.z <= COURT_HALF_LENGTH + 0.034;
}

/** Ball position at simulation time t (binary search + linear interpolation). */
export function ballPositionAt(plan: Pick<Plan, 'ball'>, t: number): Vec3 {
  const s = plan.ball;
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

export function pelvisPositionAt(path: PathSegment[], t: number): Vec3 {
  let p = path[0].from;
  for (const seg of path) {
    if (t < seg.t0) return p;
    if (t <= seg.t1) return lerp(seg.from, seg.to, smooth((t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0)));
    p = seg.to;
  }
  return p;
}

export function buildPlan(scenarioIn: ScenarioSpec, profile: Profile, opts: PlanOptions = {}): Plan {
  const variant = opts.variant ?? null;
  const scenario = adaptScenario(scenarioIn, profile);
  const surface = SURFACES[scenario.surface];
  const ath = athletics(profile);
  const k = ath.heightM / 1.75;
  const stroke = STROKES[strokeKind(scenario.task.shot, profile.backhand)];
  const side = ballSide(profile.handedness, scenario.task.shot);
  const dominant = dominantSide(profile.handedness);
  const warnings: Reason[] = [];

  // 1. Ball.
  const launch = scenario.incomingBall.launch ?? { x: 0, y: COURT_HALF_LENGTH + 0.3, h: 1 };
  const incoming = solveIncoming({
    launch: courtToWorld(launch, launch.h),
    bounce: (() => {
      const w = courtToWorld(scenario.incomingBall.bounce);
      return { x: w.x, z: w.z };
    })(),
    arrivalKmh: scenario.incomingBall.speedKmh,
    spin: scenario.incomingBall.spin,
    spinRpm: scenario.incomingBall.spinRpm,
    apexM: scenario.incomingBall.apexM,
    surface,
  });
  if (!incoming.matched) warnings.push({ key: 'warn.ball_adjusted', params: { apex: incoming.apex.toFixed(2), rpm: Math.round(incoming.spinRpm) } });
  if (incoming.flight.netCrossing && incoming.flight.netCrossing.clearance < 0) warnings.push({ key: 'warn.ball_net' });

  // 2. Reachability (ideal first; variants are evaluated against it).
  const start = courtToWorld(scenario.player.start);
  const reachIdeal = evaluateReach({ flight: incoming.flight, tOpp: T_OPPONENT, start, stroke, side, athletics: ath, goal: scenario.task.goal });

  // 3. Decisions for the ideal plan.
  const move = sub(reachIdeal.best.hit, start);
  const ctx = {
    stroke: stroke.kind,
    goal: scenario.task.goal,
    level: profile.level,
    status: reachIdeal.status,
    margin: reachIdeal.best.margin,
    lateralMove: dot(move, side),
    forwardMove: dot(move, PLAYER_FORWARD),
    contactHeight: reachIdeal.best.pos.y,
    heightM: ath.heightM,
  };
  const stanceDecision = decideStance(ctx);
  const netT = incoming.flight.netCrossing ? T_OPPONENT + incoming.flight.netCrossing.t : T_OPPONENT + 0.4;
  const bounceT = T_OPPONENT + (incoming.flight.bounces[0]?.t ?? 0.8);
  const decision = {
    stance: stanceDecision,
    firstStep: decideFirstStep(start, reachIdeal.best.hit),
    prep: decidePrepTiming({ read: reachIdeal.moveStart, net: netT, bounce: bounceT, contact: reachIdeal.best.t }, stroke.forwardSwing),
    position: decidePosition(reachIdeal),
  };

  // 4. Apply the error variant (comparison mode).
  let stance = opts.stance ?? stanceDecision.options[0].value;
  let reach = reachIdeal;
  let prepStart = reachIdeal.moveStart;
  let splitStep = true;
  if (variant) {
    const mods: { reactionExtra?: number; setupExtra?: number; lateralAdjust?: number } = {};
    if (variant === 'no_split_step') {
      mods.reactionExtra = 0.18;
      splitStep = false;
    }
    if (variant === 'wrong_stance') {
      stance = stanceDecision.options[stanceDecision.options.length - 1].value;
      mods.setupExtra = STANCE_LAYOUTS[stance].extraSetup - STANCE_LAYOUTS[stanceDecision.options[0].value].extraSetup + 0.06;
    }
    if (variant !== 'late_prep' && variant !== 'too_close') {
      const r = evaluateReach({ flight: incoming.flight, tOpp: T_OPPONENT, start, stroke, side, athletics: ath, goal: scenario.task.goal, ...mods });
      const same = r.candidates.find((c) => Math.abs(c.t - reachIdeal.best.t) < 0.012 && c.margin >= 0);
      reach = same ? { ...r, status: r.status === 'unreachable' ? 'ok' : r.status, best: same } : r;
    }
    if (variant === 'late_prep') prepStart = bounceT;
  }

  // 5. Contact timing.
  const status = reach.status;
  let tc = reach.best.t;
  let contactPos = reach.best.pos;
  let hit = reach.best.hit;
  const made = status !== 'unreachable';
  if (variant === 'late_prep' && made) {
    // A late unit turn makes the swing late: the ball is met further along
    // its path, i.e. beside / behind the body instead of in front.
    const ready = prepStart + UNIT_TURN_DURATION + stroke.forwardSwing + 0.05;
    const behind = (ready > tc ? 0.45 : 0.38) * k;
    const later = incoming.flight.samples.find((s) => s.t + T_OPPONENT > tc && length(sub(s.pos, contactPos)) >= behind);
    if (later) {
      tc = later.t + T_OPPONENT;
      contactPos = later.pos;
    }
  }
  if (variant === 'too_close' && made) {
    const o = contactOffset(stroke, ath.heightM, -0.45 * k);
    hit = hitPositionFor(contactPos, side, o.lateral, o.forward);
  }

  const travelNeeded = reach.best.travel;
  const moveStart = reach.moveStart;
  const tSet = status === 'unreachable' ? moveStart + travelNeeded : Math.max(moveStart + 0.12, reach.best.t - ath.setupTime - 0.5 * Math.max(0, reach.best.margin));
  if (!made) {
    // Swing late at the arrival point; the ball is not met.
    tc = Math.max(tc, tSet + 0.12);
    const o = contactOffset(stroke, ath.heightM);
    contactPos = addScaled(addScaled(vec(hit.x, reach.best.pos.y, hit.z), side, o.lateral), PLAYER_FORWARD, o.forward);
    warnings.push({ key: 'warn.unreachable', params: { late: (-reach.best.margin).toFixed(2) } });
  } else if (status === 'defensive') {
    warnings.push({ key: 'warn.defensive' });
  }

  // Contact zone (where the ball should be relative to the body).
  const off = contactOffset(stroke, ath.heightM);
  const zoneCenter = addScaled(addScaled(vec(hit.x, contactPos.y, hit.z), side, off.lateral), PLAYER_FORWARD, off.forward);
  const err = sfy(side, contactPos, zoneCenter);
  const radius = ath.reachTolerance + 0.1 * k;
  const contactZone = { center: zoneCenter, radius, ok: made && Math.hypot(err.x, err.y) <= radius, error: { lateral: err.x, forward: err.y } };

  // 6. Reply shot.
  let reply: ShotInfo | null = null;
  if (made) {
    const c = dot(contactPos, PLAYER_RIGHT) >= 0 ? 1 : -1; // court X sign of the contact
    const goal = scenario.task.goal;
    const base =
      goal === 'attacking'
        ? { X: c * 2.9, Y: 9.6, kmh: 125, rpm: 1800 }
        : goal === 'defensive'
          ? { X: 0, Y: 9.7, kmh: 85, rpm: stroke.kind === 'backhand_1h' ? -1500 : 2800 }
          : { X: -c * 2.5, Y: 9.3, kmh: 105, rpm: 2300 };
    const degraded = variant !== null && !contactZone.ok;
    const X = degraded ? base.X + c * 1.8 : base.X;
    const kmh = degraded ? base.kmh * 0.85 : base.kmh;
    const target = courtToWorld({ x: X, y: base.Y });
    const sol = solveLaunch({ start: contactPos, target: { x: target.x, z: target.z }, speed: kmhToMs(kmh), spinRpm: base.rpm, surface });
    const flight = simulateFlight({ pos: contactPos, vel: sol.vel, spin: sol.spin }, {
      surface,
      maxTime: 4,
      stop: (s, t, b) => b >= 2 || Math.abs(s.pos.z) > COURT_HALF_LENGTH + 6 || t > 3.2,
    });
    const b = flight.bounces[0];
    reply = {
      flight,
      startTime: tc,
      target,
      inside: b ? isInSingles(b.pos) : null,
      netClearance: flight.netCrossing?.clearance ?? null,
      launchKmh: kmh,
    };
  }

  // 7. Ball timeline (sim time).
  const ball: Sample[] = [{ t: 0, pos: incoming.initial.pos }];
  for (const s of incoming.flight.samples) {
    const t = s.t + T_OPPONENT;
    if (made && t > tc) break;
    ball.push({ t, pos: s.pos });
  }
  if (made && reply) {
    ball.push({ t: tc, pos: contactPos });
    for (const s of reply.flight.samples.slice(1)) ball.push({ t: s.t + tc, pos: s.pos });
  }

  // 8. Recovery target: behind the centre of the baseline, shaded to the contact side.
  const recovery = vec(contactPos.x * 0.2, 0, -(COURT_HALF_LENGTH + 0.5));
  const recStart = tc + 0.45;
  const recDist = length(sub(recovery, hit));
  const recEnd = recStart + travelTime(recDist, ath) * 1.25 + 0.35;

  // 9. Motion plan.
  const motion = buildMotion({
    lean: { lateral: Math.max(-0.1, Math.min(0.45, err.x)), forward: Math.max(-0.15, Math.min(0.2, err.y)) },
    stroke,
    side,
    dominant,
    ath,
    stance,
    start,
    hit,
    recovery,
    splitStep,
    prepStart,
    moveStart,
    tSet,
    tc,
    contactPos,
    made,
    recStart,
    recEnd,
  });

  // 10. Events and phases.
  const replyEvents: TimelineEvent[] = [];
  if (reply?.flight.netCrossing) replyEvents.push({ id: 'reply_net', t: tc + reply.flight.netCrossing.t });
  if (reply?.flight.bounces[0]) replyEvents.push({ id: 'reply_bounce', t: tc + reply.flight.bounces[0].t });
  const tAccel = tc - stroke.forwardSwing;
  const events: TimelineEvent[] = [
    { id: 'opponent_hit', t: T_OPPONENT },
    ...(splitStep ? [{ id: 'split_step' as const, t: T_OPPONENT + SPLIT_AFTER }] : []),
    { id: 'read', t: moveStart },
    { id: 'net', t: netT },
    { id: 'bounce', t: bounceT },
    { id: 'stance_set', t: tSet },
    { id: 'acceleration', t: tAccel },
    { id: 'contact', t: tc },
    ...replyEvents,
    { id: 'recovered', t: recEnd },
  ];
  events.sort((a, b) => a.t - b.t);
  const lastBall = ball[ball.length - 1].t;
  const duration = Math.max(recEnd + 0.6, lastBall + 0.2);
  const phases: Phase[] = [
    { id: 'ready', start: 0, end: T_OPPONENT - SPLIT_LEAD },
    ...(splitStep ? [{ id: 'split_step' as const, start: T_OPPONENT - SPLIT_LEAD, end: T_OPPONENT + SPLIT_AFTER }] : []),
    { id: 'read_turn', start: prepStart, end: Math.min(prepStart + UNIT_TURN_DURATION, tAccel) },
    { id: 'movement', start: moveStart, end: Math.max(moveStart + 0.05, tSet - 0.15) },
    { id: 'footwork', start: Math.max(moveStart, tSet - 0.25), end: tSet },
    { id: 'acceleration', start: tAccel, end: tc },
    { id: 'contact', start: tc - 0.02, end: tc + 0.02 },
    { id: 'follow_through', start: tc, end: recStart },
    { id: 'recovery', start: recStart, end: recEnd },
    { id: 'feedback', start: recEnd, end: duration },
  ];

  return {
    scenario,
    profile,
    variant,
    stroke,
    athletics: ath,
    stance,
    incoming,
    reach,
    status,
    decision,
    start,
    hit,
    recovery,
    contact: { t: tc, pos: contactPos, made },
    contactZone,
    reply,
    ball,
    events,
    phases,
    motion,
    duration,
    warnings,
  };
}

interface MotionInput {
  /** Torso lean towards the ball at contact (s, f), metres — reaching instead of running. */
  lean: { lateral: number; forward: number };
  stroke: StrokeGeometry;
  side: Vec3;
  dominant: Vec3;
  ath: Athletics;
  stance: Stance;
  start: Vec3;
  hit: Vec3;
  recovery: Vec3;
  splitStep: boolean;
  prepStart: number;
  moveStart: number;
  tSet: number;
  tc: number;
  contactPos: Vec3;
  made: boolean;
  recStart: number;
  recEnd: number;
}

function buildMotion(m: MotionInput): MotionPlan {
  const { stroke, side, ath } = m;
  const k = ath.heightM / 1.75;
  const right = PLAYER_RIGHT;
  const layout = STANCE_LAYOUTS[m.stance];
  const hipH = 0.53 * ath.heightM;

  // --- Pelvis path.
  const pelvisPath: PathSegment[] = [
    { t0: 0, t1: m.moveStart, from: m.start, to: m.start },
    { t0: m.moveStart, t1: m.tSet, from: m.start, to: m.hit },
    { t0: m.tSet, t1: m.recStart, from: m.hit, to: m.hit },
    { t0: m.recStart, t1: m.recEnd, from: m.hit, to: m.recovery },
  ];

  // --- Feet.
  const outsideIsRight = dot(side, right) > 0;
  const footFacing = (deg: number) => yawOf(facingVector(deg, side));
  // Toes turned slightly out in the ready position.
  const readyYaw = (isRight: boolean) => yawOf(addScaled(PLAYER_FORWARD, right, isRight ? 0.14 : -0.14));
  const at = (p: Vec3, isRight: boolean, w: number) => addScaled(p, right, (isRight ? 1 : -1) * w * k);

  const feet: { left: FootPlantPlan[]; right: FootPlantPlan[] } = { left: [], right: [] };
  const push = (isRight: boolean, plant: FootPlantPlan) => {
    const list = isRight ? feet.right : feet.left;
    const prev = list[list.length - 1];
    if (prev) prev.end = Math.min(prev.end, plant.start);
    list.push(plant);
  };
  const hopStart = T_OPPONENT - SPLIT_LEAD;
  const land = T_OPPONENT + SPLIT_AFTER;
  for (const isRight of [false, true]) {
    push(isRight, { pos: at(m.start, isRight, 0.27), yaw: readyYaw(isRight), start: -1, end: m.splitStep ? hopStart : m.moveStart, kind: 'ready' });
    if (m.splitStep) push(isRight, { pos: at(m.start, isRight, 0.35), yaw: readyYaw(isRight), start: land, end: Infinity, kind: 'split' });
  }

  const stepSequence = (from: Vec3, to: Vec3, t0: number, t1: number, last: 'right' | 'left', finals: { right: FootPlantPlan; left: FootPlantPlan }, kind: FootPlantPlan['kind']) => {
    const dist = length(sub(to, from));
    const inter = dist < 0.25 ? 0 : Math.ceil(dist / (0.8 * k));
    const total = inter + 2;
    const span = Math.max(0.1, t1 - t0);
    const seg: PathSegment[] = [{ t0, t1, from, to }];
    for (let i = 0; i < total; i++) {
      const fromEnd = total - 1 - i;
      const footIsRight = (fromEnd % 2 === 0) === (last === 'right');
      const tLand = t0 + ((i + 1) / total) * span;
      const tLift = t0 + (i / total) * span;
      let plant: FootPlantPlan;
      if (i >= total - 2) {
        const f = footIsRight ? finals.right : finals.left;
        plant = { ...f, start: tLand, end: Infinity };
      } else {
        const p = pelvisPositionAt(seg, Math.min(t1, tLand + 0.5 * (span / total)));
        plant = { pos: at(p, footIsRight, 0.17), yaw: readyYaw(footIsRight), start: tLand, end: Infinity, kind };
      }
      const list = footIsRight ? feet.right : feet.left;
      const prev = list[list.length - 1];
      if (prev) prev.end = Math.min(prev.end, tLift);
      list.push(plant);
    }
  };

  const plantAt = (p: { s: number; f: number; yaw: number }): { pos: Vec3; yaw: number } => ({
    pos: addScaled(addScaled(m.hit, side, p.s * k), PLAYER_FORWARD, p.f * k),
    yaw: footFacing(p.yaw),
  });
  const outside = plantAt(layout.outside);
  const inside = plantAt(layout.inside);
  const stanceFinals = {
    right: { ...(outsideIsRight ? outside : inside), start: 0, end: Infinity, kind: 'stance' as const },
    left: { ...(outsideIsRight ? inside : outside), start: 0, end: Infinity, kind: 'stance' as const },
  };
  const lastIsOutside = layout.lastFoot === 'outside';
  const lastFoot: 'right' | 'left' = lastIsOutside === outsideIsRight ? 'right' : 'left';
  stepSequence(m.start, m.hit, m.moveStart, m.tSet, lastFoot, stanceFinals, 'step');

  const readyFinals = {
    right: { pos: at(m.recovery, true, 0.28), yaw: readyYaw(true), start: 0, end: Infinity, kind: 'recovery' as const },
    left: { pos: at(m.recovery, false, 0.28), yaw: readyYaw(false), start: 0, end: Infinity, kind: 'recovery' as const },
  };
  stepSequence(m.hit, m.recovery, m.recStart, m.recEnd, lastFoot === 'right' ? 'left' : 'right', readyFinals, 'recovery');

  // --- Pelvis height (the leg IK lowers it further if a foot would not reach).
  const crouchContact = 0.1 + 0.45 * Math.min(0.7, Math.max(0, 1.0 * k - m.contactPos.y));
  const pelvisHeight: ScalarKey[] = [
    { t: 0, v: hipH - 0.05 * k },
    ...(m.splitStep
      ? [
          { t: hopStart, v: hipH - 0.07 * k },
          { t: (hopStart + land) / 2, v: hipH + 0.03 * k },
          { t: land, v: hipH - 0.12 * k },
        ]
      : []),
    { t: m.moveStart + 0.1, v: hipH - 0.09 * k },
    { t: m.tSet, v: hipH - crouchContact * k },
    { t: m.tc, v: hipH - crouchContact * k },
    { t: m.tc + 0.35, v: hipH - 0.05 * k },
    { t: m.recEnd, v: hipH - 0.06 * k },
  ];

  // --- Swing timing.
  const tAccel = m.tc - stroke.forwardSwing;
  const turnEnd = Math.max(m.prepStart + 0.1, Math.min(m.prepStart + UNIT_TURN_DURATION, tAccel - 0.05));
  const tDrop = tAccel + 0.45 * stroke.forwardSwing;
  const holdEnd = Math.max(turnEnd + 0.02, tAccel);
  const torsoFacing: ScalarKey[] = [
    { t: 0, v: 0 },
    { t: m.prepStart, v: 0 },
    { t: turnEnd, v: stroke.turnFacing },
    { t: holdEnd, v: stroke.turnFacing },
    { t: tDrop, v: stroke.turnFacing * 0.75 },
    { t: m.tc, v: stroke.contactFacing },
    { t: m.tc + 0.3, v: stroke.finishFacing },
    { t: m.recStart, v: stroke.finishFacing },
    { t: m.recEnd, v: 0 },
  ];
  const pelvisFacing: ScalarKey[] = [
    { t: 0, v: 0 },
    { t: m.prepStart, v: 0 },
    { t: turnEnd, v: stroke.turnFacing * 0.45 },
    { t: m.tSet, v: layout.pelvisFacing },
    { t: tAccel, v: layout.pelvisFacing },
    { t: m.tc, v: Math.min(layout.pelvisFacing, stroke.contactFacing + 15) - 10 },
    { t: m.tc + 0.3, v: stroke.finishFacing * 0.6 },
    { t: m.recStart, v: stroke.finishFacing * 0.6 },
    { t: m.recEnd, v: 0 },
  ];

  const leanKeys = (v: number): ScalarKey[] => [
    { t: 0, v: 0 },
    { t: Math.max(0, tAccel - 0.15), v: 0 },
    { t: m.tc, v },
    { t: m.tc + 0.35, v: v * 0.3 },
    { t: m.recEnd, v: 0 },
  ];

  // --- Racket keys, relative to the pelvis ground point in (s, f, y).
  const key = (id: keyof StrokeGeometry['keys']) => ({ head: tuple(stroke.keys[id].head, k), dir: tuple(stroke.keys[id].dir, 1) });
  const off = (id: keyof NonNullable<StrokeGeometry['offHand']>) => (stroke.offHand?.[id] ? tuple(stroke.offHand[id]!, k) : undefined);
  const contactRel = sfy(side, m.contactPos, m.hit);
  const drop = key('drop');
  const cd = stroke.contactDir;
  const racket: RacketKeyPlan[] = [
    { t: 0, ...key('ready'), offHand: off('ready') },
    { t: m.prepStart, ...key('ready'), offHand: off('ready') },
    { t: turnEnd, ...key('takeback'), offHand: off('takeback') },
    { t: holdEnd, ...key('takeback'), offHand: off('takeback') },
    { t: tDrop, head: vec(drop.head.x, drop.head.y, Math.min(drop.head.z, m.contactPos.y - 0.25 * k)), dir: drop.dir, offHand: off('drop') },
    { t: m.tc, head: vec(contactRel.x, contactRel.y, m.contactPos.y), dir: vec(cd[0], cd[1], cd[2]), offHand: off('contact') },
    { t: m.tc + 0.1, ...key('release'), offHand: off('release') },
    { t: m.tc + 0.25, ...key('follow'), offHand: off('follow') },
    { t: m.tc + 0.5, ...key('finish'), offHand: off('finish') },
    { t: Math.max(m.tc + 0.6, m.recEnd), ...key('ready'), offHand: off('ready') },
  ];
  for (let i = 1; i < racket.length; i++) if (racket[i].t <= racket[i - 1].t) racket[i].t = racket[i - 1].t + 0.02;

  return {
    side,
    dominant: m.dominant,
    heightM: ath.heightM,
    twoHanded: stroke.twoHanded,
    feet,
    pelvisPath,
    pelvisHeight,
    torsoFacing,
    pelvisFacing,
    leanS: leanKeys(m.lean.lateral),
    leanF: leanKeys(m.lean.forward + 0.05 * k),
    racket,
  };
}

