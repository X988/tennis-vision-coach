/**
 * Animation Engine: evaluates the full skeleton (joint positions) of the
 * coached player at any simulation time from a MotionPlan.
 *
 *  - feet are either planted (fixed position — no sliding) or swinging
 *    between two plants;
 *  - pelvis follows the planned path; its height is lowered automatically
 *    so that planted feet stay reachable (no stretched legs / floating feet);
 *  - legs and arms are solved with analytic two-bone IK;
 *  - the racket follows keyed poses (Catmull-Rom) and passes exactly
 *    through the ball at contact.
 *
 * The output is renderer-agnostic, so the same pose can later drive the
 * bones of a rigged glTF model.
 */
import { PLAYER_FORWARD } from './court';
import { FootPlantPlan, MotionPlan, ScalarKey, pelvisPositionAt } from './plan';
import { UP, Vec3, add, addScaled, clamp, cross, dot, length, lerp, normalize, scale, smoothstep, sub, vec } from './vector';

export interface Dimensions {
  ankle: number;
  shin: number;
  thigh: number;
  hipHalf: number;
  spine: number;
  neck: number;
  headR: number;
  shoulderHalf: number;
  upperArm: number;
  forearm: number;
  footLength: number;
  /** Grip to racket head centre. */
  racketReach: number;
  racketHeadR: number;
}

export function dimensions(heightM: number): Dimensions {
  const h = heightM;
  return {
    ankle: 0.045 * h,
    shin: 0.25 * h,
    thigh: 0.245 * h,
    hipHalf: 0.055 * h,
    spine: 0.29 * h,
    neck: 0.1 * h,
    headR: 0.065 * h,
    shoulderHalf: 0.115 * h,
    upperArm: 0.172 * h,
    forearm: 0.19 * h,
    footLength: 0.15 * h,
    racketReach: 0.5,
    racketHeadR: 0.135,
  };
}

export interface Side3 {
  left: Vec3;
  right: Vec3;
}

export interface Joints {
  pelvis: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  hip: Side3;
  knee: Side3;
  ankle: Side3;
  toe: Side3;
  heel: Side3;
  shoulder: Side3;
  elbow: Side3;
  wrist: Side3;
  racket: { butt: Vec3; grip: Vec3; throat: Vec3; head: Vec3; dir: Vec3; normal: Vec3 };
  /** Facing direction of the shoulders. */
  facing: Vec3;
  /** Foot state, for overlays. */
  planted: { left: boolean; right: boolean };
  dims: Dimensions;
}

function scalarAt(keys: ScalarKey[], t: number): number {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) return a.v + (b.v - a.v) * smoothstep((t - a.t) / Math.max(1e-6, b.t - a.t));
  }
  return keys[keys.length - 1].v;
}

/** Foot ground position, yaw and whether it is planted. */
export function footAt(plants: FootPlantPlan[], t: number, liftHeight: number) {
  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    if (t >= p.start && t <= p.end) return { pos: p.pos, yaw: p.yaw, planted: true };
    const next = plants[i + 1];
    if (next && t > p.end && t < next.start) {
      const u = (t - p.end) / (next.start - p.end);
      const e = smoothstep(u);
      const step = length(sub(next.pos, p.pos));
      const pos = lerp(p.pos, next.pos, e);
      const lift = Math.min(liftHeight, 0.04 + step * 0.15);
      return { pos: vec(pos.x, Math.sin(Math.PI * u) * lift, pos.z), yaw: p.yaw + (next.yaw - p.yaw) * e, planted: false };
    }
  }
  const last = plants[plants.length - 1];
  return { pos: last.pos, yaw: last.yaw, planted: true };
}

/** Analytic two-bone IK. Returns the middle joint and the reached end point. */
export function twoBoneIK(root: Vec3, target: Vec3, l1: number, l2: number, pole: Vec3) {
  const toT = sub(target, root);
  const dist = Math.max(1e-6, length(toT));
  const n = scale(toT, 1 / dist);
  const d = clamp(dist, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let p = sub(pole, scale(n, dot(pole, n)));
  if (length(p) < 1e-6) p = Math.abs(n.y) < 0.9 ? cross(n, UP) : cross(n, PLAYER_FORWARD);
  p = normalize(p);
  return { mid: add(addScaled(root, n, a), scale(p, h)), end: addScaled(root, n, d) };
}

const facingVec = (deg: number, side: Vec3) => {
  const a = (deg * Math.PI) / 180;
  return add(scale(PLAYER_FORWARD, Math.cos(a)), scale(side, Math.sin(a)));
};

/** Catmull-Rom interpolation of racket keys (relative frame). */
function racketRel(plan: MotionPlan, t: number) {
  const keys = plan.racket;
  if (t <= keys[0].t) return { head: keys[0].head, dir: keys[0].dir, off: keys[0].offHand };
  if (t >= keys[keys.length - 1].t) {
    const k = keys[keys.length - 1];
    return { head: k.head, dir: k.dir, off: k.offHand };
  }
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - k1.t) / (k2.t - k1.t);
  const cr = (p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3) => {
    const u2 = u * u;
    const u3 = u2 * u;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    return vec(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
  };
  const head = cr(k0.head, k1.head, k2.head, k3.head);
  const dir = normalize(lerp(normalize(k1.dir), normalize(k2.dir), smoothstep(u)));
  const off = k1.offHand && k2.offHand ? lerp(k1.offHand, k2.offHand, smoothstep(u)) : (k2.offHand ?? k1.offHand);
  return { head, dir, off };
}

export function poseAt(plan: MotionPlan, t: number): Joints {
  const dims = dimensions(plan.heightM);
  const side = plan.side;
  const fromRel = (origin: Vec3, r: Vec3) => vec(origin.x + side.x * r.x + PLAYER_FORWARD.x * r.y, r.z, origin.z + side.z * r.x + PLAYER_FORWARD.z * r.y);
  const dirFromRel = (r: Vec3) => normalize(vec(side.x * r.x + PLAYER_FORWARD.x * r.y, r.z, side.z * r.x + PLAYER_FORWARD.z * r.y));

  // Feet.
  const lf = footAt(plan.feet.left, t, 0.12 * (plan.heightM / 1.75));
  const rf = footAt(plan.feet.right, t, 0.12 * (plan.heightM / 1.75));

  // Pelvis.
  const ground = pelvisPositionAt(plan.pelvisPath, t);
  const pelvisFacing = facingVec(scalarAt(plan.pelvisFacing, t), side);
  const pelvisRight = normalize(cross(pelvisFacing, UP));
  const leg = dims.thigh + dims.shin;
  let pelvisY = scalarAt(plan.pelvisHeight, t);
  for (const [f, sgn] of [
    [lf, -1],
    [rf, 1],
  ] as const) {
    const hip = addScaled(vec(ground.x, 0, ground.z), pelvisRight, sgn * dims.hipHalf);
    const ankleY = f.pos.y + dims.ankle;
    const dxz = Math.hypot(hip.x - f.pos.x, hip.z - f.pos.z);
    const reach = leg * 0.995;
    if (dxz < reach) pelvisY = Math.min(pelvisY, ankleY + Math.sqrt(reach * reach - dxz * dxz));
    else pelvisY = Math.min(pelvisY, ankleY + 0.02);
  }
  const pelvis = vec(ground.x, pelvisY, ground.z);
  const hip = { left: addScaled(pelvis, pelvisRight, -dims.hipHalf), right: addScaled(pelvis, pelvisRight, dims.hipHalf) };

  // Legs.
  const legOf = (h: Vec3, f: { pos: Vec3; yaw: number }) => {
    const toeDir = vec(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    const ankleTarget = vec(f.pos.x, f.pos.y + dims.ankle, f.pos.z);
    const ik = twoBoneIK(h, ankleTarget, dims.thigh, dims.shin, add(toeDir, scale(UP, 0.2)));
    return {
      knee: ik.mid,
      ankle: ik.end,
      toe: vec(ik.end.x + toeDir.x * dims.footLength * 0.75, Math.max(0.02, ik.end.y - dims.ankle + 0.02), ik.end.z + toeDir.z * dims.footLength * 0.75),
      heel: vec(ik.end.x - toeDir.x * dims.footLength * 0.25, Math.max(0.02, ik.end.y - dims.ankle + 0.02), ik.end.z - toeDir.z * dims.footLength * 0.25),
    };
  };
  const L = legOf(hip.left, lf);
  const R = legOf(hip.right, rf);

  // Torso.
  const facing = facingVec(scalarAt(plan.torsoFacing, t), side);
  const torsoRight = normalize(cross(facing, UP));
  const lean = add(scale(side, scalarAt(plan.leanS, t)), scale(PLAYER_FORWARD, scalarAt(plan.leanF, t)));
  const chest = add(addScaled(pelvis, UP, dims.spine), lean);
  const neck = addScaled(chest, UP, dims.neck * 0.6);
  const head = addScaled(neck, UP, dims.neck * 0.4 + dims.headR);
  const shoulder = { left: addScaled(chest, torsoRight, -dims.shoulderHalf), right: addScaled(chest, torsoRight, dims.shoulderHalf) };
  const domIsRight = plan.dominant.x < 0; // PLAYER_RIGHT is -x

  // Racket and hands.
  const rel = racketRel(plan, t);
  let rHead = fromRel(ground, rel.head);
  let rDir = dirFromRel(rel.dir);
  let grip = addScaled(rHead, rDir, -dims.racketReach);
  const domShoulder = domIsRight ? shoulder.right : shoulder.left;
  const offShoulder = domIsRight ? shoulder.left : shoulder.right;
  const domOut = domIsRight ? torsoRight : scale(torsoRight, -1);
  // Keep the head on its path; if the grip is out of the arm's reach, turn the
  // racket around the head (sphere-sphere intersection) to bring the grip in.
  const armReach = (dims.upperArm + dims.forearm) * 0.985;
  if (length(sub(grip, domShoulder)) > armReach) {
    const d = length(sub(domShoulder, rHead));
    const r1 = dims.racketReach;
    if (d <= r1 + armReach && d >= Math.abs(r1 - armReach)) {
      const n = scale(sub(domShoulder, rHead), 1 / d);
      const a = (d * d + r1 * r1 - armReach * armReach) / (2 * d);
      const hc = Math.sqrt(Math.max(0, r1 * r1 - a * a));
      const c = addScaled(rHead, n, a);
      let v = sub(grip, c);
      v = sub(v, scale(n, dot(v, n)));
      if (length(v) < 1e-6) v = cross(n, UP);
      grip = addScaled(c, normalize(v), hc);
      rDir = normalize(sub(rHead, grip));
    }
  }
  const domArm = twoBoneIK(domShoulder, grip, dims.upperArm, dims.forearm, add(scale(UP, -1), scale(domOut, 0.6)));
  // If the grip is out of reach, the racket stays in the hand (moves rigidly).
  const slip = sub(domArm.end, grip);
  if (length(slip) > 1e-4) {
    grip = domArm.end;
    rHead = add(rHead, slip);
  }
  const offTarget = plan.twoHanded ? addScaled(grip, rDir, 0.1) : rel.off ? fromRel(ground, rel.off) : addScaled(grip, rDir, 0.18);
  const offArm = twoBoneIK(offShoulder, offTarget, dims.upperArm, dims.forearm, add(scale(UP, -1), scale(domOut, -0.6)));

  let normal = cross(rDir, UP);
  normal = length(normal) < 0.2 ? facing : normalize(normal);
  if (dot(normal, PLAYER_FORWARD) < 0) normal = scale(normal, -1);

  const elbow = domIsRight ? { right: domArm.mid, left: offArm.mid } : { left: domArm.mid, right: offArm.mid };
  const wrist = domIsRight ? { right: domArm.end, left: offArm.end } : { left: domArm.end, right: offArm.end };

  return {
    pelvis,
    chest,
    neck,
    head,
    hip,
    knee: { left: L.knee, right: R.knee },
    ankle: { left: L.ankle, right: R.ankle },
    toe: { left: L.toe, right: R.toe },
    heel: { left: L.heel, right: R.heel },
    shoulder,
    elbow,
    wrist,
    racket: {
      butt: addScaled(grip, rDir, -0.08),
      grip,
      throat: addScaled(grip, rDir, dims.racketReach - dims.racketHeadR * 1.3),
      head: rHead,
      dir: rDir,
      normal,
    },
    facing,
    planted: { left: lf.planted, right: rf.planted },
    dims,
  };
}
