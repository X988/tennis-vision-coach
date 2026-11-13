/**
 * Technique library: stroke geometry (contact offsets, shoulder turn, racket
 * path key poses) and stance foot layouts. This is the data the coach
 * verifies; numbers are for a 1.75 m player and scale with height.
 *
 * Frame: s — unit vector towards the ball side (forehand: dominant side,
 * backhand: the other side), f — towards the net, y — up.
 */
import { BackhandType, Handedness } from './profile';
import { PLAYER_RIGHT } from './court';
import { ShotSide, Stance } from './scenario';
import { Vec3, scale } from './vector';

export type StrokeKind = 'forehand' | 'backhand_2h' | 'backhand_1h';

export type RacketKeyId = 'ready' | 'takeback' | 'drop' | 'contact' | 'release' | 'follow' | 'finish';

/** Racket head centre and handle->head direction in the (s, f, y) frame. */
export interface RacketKey {
  head: [number, number, number];
  dir: [number, number, number];
}

export interface StrokeGeometry {
  kind: StrokeKind;
  twoHanded: boolean;
  /** Contact point relative to the pelvis ground point: towards the ball side / forward. */
  lateral: number;
  forward: number;
  /** Shoulder line facing angle towards s (deg): end of unit turn, contact, finish. */
  turnFacing: number;
  contactFacing: number;
  finishFacing: number;
  /** Duration of the forward swing (racket acceleration), s. */
  forwardSwing: number;
  /** Racket head direction at contact. */
  contactDir: [number, number, number];
  keys: Record<Exclude<RacketKeyId, 'contact'>, RacketKey>;
  /** Non-dominant hand (one-handed strokes) at key moments, (s, f, y). */
  offHand?: Partial<Record<RacketKeyId, [number, number, number]>>;
}

const READY: RacketKey = { head: [0.0, 0.62, 1.05], dir: [0.15, 0.75, 0.62] };

export const STROKES: Record<StrokeKind, StrokeGeometry> = {
  forehand: {
    kind: 'forehand',
    twoHanded: false,
    lateral: 0.82,
    forward: 0.38,
    turnFacing: 80,
    contactFacing: 5,
    finishFacing: -45,
    forwardSwing: 0.26,
    contactDir: [0.92, 0.32, -0.05],
    keys: {
      ready: READY,
      takeback: { head: [0.55, -0.3, 1.5], dir: [0.25, -0.45, 0.85] },
      drop: { head: [0.75, -0.42, 0.75], dir: [0.15, -0.95, -0.25] },
      release: { head: [0.25, 0.8, 1.3], dir: [-0.55, 0.6, 0.55] },
      follow: { head: [-0.35, 0.3, 1.7], dir: [-0.45, -0.25, 0.85] },
      finish: { head: [-0.45, -0.15, 1.45], dir: [-0.2, -0.85, 0.45] },
    },
    offHand: {
      ready: [0.05, 0.4, 1.0],
      takeback: [0.3, 0.45, 1.35],
      drop: [0.15, 0.45, 1.3],
      contact: [-0.3, 0.25, 1.1],
      release: [-0.3, 0.2, 1.1],
      follow: [-0.3, 0.15, 1.25],
      finish: [-0.3, 0.05, 1.3],
    },
  },
  backhand_2h: {
    kind: 'backhand_2h',
    twoHanded: true,
    lateral: 0.68,
    forward: 0.32,
    turnFacing: 95,
    contactFacing: 15,
    finishFacing: -30,
    forwardSwing: 0.26,
    contactDir: [0.9, 0.38, -0.05],
    keys: {
      ready: READY,
      takeback: { head: [0.5, -0.35, 1.4], dir: [0.3, -0.5, 0.8] },
      drop: { head: [0.65, -0.4, 0.8], dir: [0.2, -0.95, -0.2] },
      release: { head: [0.2, 0.75, 1.3], dir: [-0.5, 0.65, 0.55] },
      follow: { head: [-0.35, 0.25, 1.75], dir: [-0.4, -0.3, 0.85] },
      finish: { head: [-0.4, -0.15, 1.5], dir: [-0.2, -0.85, 0.5] },
    },
  },
  backhand_1h: {
    kind: 'backhand_1h',
    twoHanded: false,
    lateral: 0.78,
    forward: 0.5,
    turnFacing: 100,
    contactFacing: 35,
    finishFacing: 10,
    forwardSwing: 0.28,
    contactDir: [0.85, 0.5, -0.1],
    keys: {
      ready: READY,
      takeback: { head: [0.45, -0.35, 1.45], dir: [0.3, -0.5, 0.8] },
      drop: { head: [0.6, -0.4, 0.8], dir: [0.2, -0.95, -0.2] },
      release: { head: [0.55, 0.8, 1.35], dir: [0.3, 0.75, 0.6] },
      follow: { head: [0.3, 0.45, 1.85], dir: [0.1, 0.2, 0.97] },
      finish: { head: [0.35, 0.1, 1.8], dir: [0.4, -0.3, 0.86] },
    },
    offHand: {
      ready: [0.05, 0.4, 1.0],
      takeback: [0.2, 0.0, 1.3],
      drop: [0.25, 0.05, 1.2],
      contact: [-0.35, -0.35, 1.05],
      release: [-0.4, -0.4, 1.05],
      follow: [-0.45, -0.45, 1.1],
      finish: [-0.45, -0.4, 1.1],
    },
  },
};

export interface FootPlant {
  s: number;
  f: number;
  /** Toe direction, degrees from f towards s. */
  yaw: number;
}

export interface StanceLayout {
  outside: FootPlant;
  inside: FootPlant;
  /** Pelvis facing (deg towards s) when the stance is set. */
  pelvisFacing: number;
  /** Which foot plants last. */
  lastFoot: 'outside' | 'inside';
  /** Extra time the stance costs compared with open stance (an extra/longer step), s. */
  extraSetup: number;
}

export const STANCE_LAYOUTS: Record<Stance, StanceLayout> = {
  open: { outside: { s: 0.3, f: -0.05, yaw: 25 }, inside: { s: -0.3, f: 0.02, yaw: 5 }, pelvisFacing: 20, lastFoot: 'outside', extraSetup: 0 },
  semi_open: { outside: { s: 0.27, f: -0.15, yaw: 45 }, inside: { s: -0.22, f: 0.22, yaw: 25 }, pelvisFacing: 40, lastFoot: 'outside', extraSetup: 0.04 },
  neutral: { outside: { s: 0.14, f: -0.33, yaw: 80 }, inside: { s: -0.04, f: 0.36, yaw: 45 }, pelvisFacing: 65, lastFoot: 'inside', extraSetup: 0.1 },
  closed: { outside: { s: 0.06, f: -0.32, yaw: 90 }, inside: { s: 0.2, f: 0.3, yaw: 65 }, pelvisFacing: 80, lastFoot: 'inside', extraSetup: 0.14 },
};

export function strokeKind(shot: ShotSide, backhand: BackhandType): StrokeKind {
  if (shot === 'forehand') return 'forehand';
  return backhand === 'two_handed' ? 'backhand_2h' : 'backhand_1h';
}

/** World unit vector of the dominant side (racket hand). */
export function dominantSide(h: Handedness): Vec3 {
  return h === 'right' ? PLAYER_RIGHT : scale(PLAYER_RIGHT, -1);
}

/** World unit vector of the ball side for a stroke. */
export function ballSide(h: Handedness, shot: ShotSide): Vec3 {
  const d = dominantSide(h);
  return shot === 'forehand' ? d : scale(d, -1);
}
