/**
 * Stroke kinematics for the (right-handed) placeholder player.
 *
 * Player-local frame: the player faces +z, +y is up, so the player's right
 * hand side is -x. A pose is three angles:
 *   torsoYaw — shoulder turn around the vertical axis;
 *   armYaw   — direction of arm + racket around the vertical axis (player frame);
 *   armPitch — how far the arm + racket point below the horizon.
 * Arm direction = (cos(pitch) sin(yaw), -sin(pitch), cos(pitch) cos(yaw)).
 */
import { Vec3, add, clamp, degToRad, smoothstep, vec } from './vector';

export type StrokeId = 'forehand' | 'backhand' | 'slice';

export interface Pose {
  torsoYaw: number;
  armYaw: number;
  armPitch: number;
}

export interface Keyframe {
  phase: number;
  pose: Pose;
}

export interface StrokeDef {
  id: StrokeId;
  label: string;
  /** Total swing duration, seconds. */
  duration: number;
  /** Phase (0..1) of the swing at which the racket meets the ball. */
  contactPhase: number;
  keyframes: Keyframe[];
}

/** Right shoulder position in the torso frame. */
export const SHOULDER_OFFSET: Vec3 = Object.freeze(vec(-0.22, 1.42, 0));
export const ARM_LENGTH = 0.62;
export const RACKET_HANDLE = 0.3;
export const RACKET_HEAD_RADIUS = 0.15;
/** Distance from shoulder to the centre of the racket head. */
export const REACH = ARM_LENGTH + RACKET_HANDLE + RACKET_HEAD_RADIUS * 1.3;
export const EYE_HEIGHT = 1.65;

const pose = (torsoYaw: number, armYaw: number, armPitch: number): Pose => ({
  torsoYaw: degToRad(torsoYaw),
  armYaw: degToRad(armYaw),
  armPitch: degToRad(armPitch),
});

const READY = pose(0, -15, 15);

export const STROKES: Record<StrokeId, StrokeDef> = {
  forehand: {
    id: 'forehand',
    label: 'Forehand (topspin)',
    duration: 1.1,
    contactPhase: 0.6,
    keyframes: [
      { phase: 0, pose: READY },
      { phase: 0.35, pose: pose(-75, -150, -5) },
      { phase: 0.6, pose: pose(-10, -40, 0) },
      { phase: 1, pose: pose(35, 70, -45) },
    ],
  },
  backhand: {
    id: 'backhand',
    label: 'Backhand (one-handed)',
    duration: 1.1,
    contactPhase: 0.6,
    keyframes: [
      { phase: 0, pose: READY },
      { phase: 0.35, pose: pose(80, 155, -5) },
      { phase: 0.6, pose: pose(15, 45, 0) },
      { phase: 1, pose: pose(-20, -50, -50) },
    ],
  },
  slice: {
    id: 'slice',
    label: 'Backhand slice',
    duration: 1.2,
    contactPhase: 0.6,
    keyframes: [
      { phase: 0, pose: READY },
      { phase: 0.35, pose: pose(75, 150, -35) },
      { phase: 0.6, pose: pose(20, 50, 0) },
      { phase: 1, pose: pose(0, 5, 10) },
    ],
  },
};

/** Arm pitch that puts the racket centre at `height` above the ground. */
export function contactPitch(height: number): number {
  return Math.asin(clamp((SHOULDER_OFFSET.y - height) / REACH, -0.95, 0.95));
}

/** Racket head centre in the player frame (feet at the origin). */
export function racketCenter(p: Pose): Vec3 {
  const c = Math.cos(p.torsoYaw);
  const s = Math.sin(p.torsoYaw);
  const shoulder = vec(
    SHOULDER_OFFSET.x * c + SHOULDER_OFFSET.z * s,
    SHOULDER_OFFSET.y,
    -SHOULDER_OFFSET.x * s + SHOULDER_OFFSET.z * c,
  );
  const cp = Math.cos(p.armPitch);
  const arm = vec(cp * Math.sin(p.armYaw), -Math.sin(p.armPitch), cp * Math.cos(p.armYaw));
  return add(shoulder, vec(arm.x * REACH, arm.y * REACH, arm.z * REACH));
}

/** The contact pose of a stroke for a ball at the given height. */
export function contactPose(stroke: StrokeDef, height: number): Pose {
  const kf = stroke.keyframes.find((k) => k.phase === stroke.contactPhase);
  if (!kf) throw new Error(`Stroke ${stroke.id} has no contact keyframe`);
  return { ...kf.pose, armPitch: contactPitch(height) };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolated pose at swing phase 0..1 (eased between keyframes). */
export function poseAt(stroke: StrokeDef, phase: number, contact: Pose): Pose {
  const frames = stroke.keyframes.map((k) =>
    k.phase === stroke.contactPhase ? { phase: k.phase, pose: contact } : k,
  );
  const p = clamp(phase, 0, 1);
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1].phase) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const t = smoothstep((p - a.phase) / (b.phase - a.phase || 1));
  return {
    torsoYaw: mix(a.pose.torsoYaw, b.pose.torsoYaw, t),
    armYaw: mix(a.pose.armYaw, b.pose.armYaw, t),
    armPitch: mix(a.pose.armPitch, b.pose.armPitch, t),
  };
}

/** Swing phase at simulation time t, so that phase == contactPhase exactly at contactTime. */
export function swingPhase(stroke: StrokeDef, t: number, contactTime: number): number {
  return clamp((t - contactTime) / stroke.duration + stroke.contactPhase, 0, 1);
}
