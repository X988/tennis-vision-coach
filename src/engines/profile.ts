/** Learner profile and the athletic parameters derived from it. */

export type Handedness = 'right' | 'left';
export type BackhandType = 'two_handed' | 'one_handed';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Language = 'ru' | 'uk' | 'en';

export interface Profile {
  handedness: Handedness;
  backhand: BackhandType;
  heightCm: number;
  level: Level;
  language: Language;
}

export const DEFAULT_PROFILE: Profile = {
  handedness: 'right',
  backhand: 'two_handed',
  heightCm: 175,
  level: 'intermediate',
  language: 'ru',
};

export interface Athletics {
  heightM: number;
  /** Seconds from the opponent's contact until the first move (ball read). */
  reaction: number;
  /** m/s^2, first-step acceleration and braking. */
  accel: number;
  /** m/s, top lateral running speed. */
  maxSpeed: number;
  /** Seconds the stance must be set before contact. */
  setupTime: number;
  /** Comfortable contact height band, metres. */
  contactBand: [number, number];
  /** How far the player can lean / extend instead of moving the feet, metres. */
  reachTolerance: number;
}

const BY_LEVEL: Record<Level, { reaction: number; accel: number; maxSpeed: number; setupTime: number }> = {
  beginner: { reaction: 0.3, accel: 5.5, maxSpeed: 4.6, setupTime: 0.22 },
  intermediate: { reaction: 0.22, accel: 7, maxSpeed: 5.6, setupTime: 0.16 },
  advanced: { reaction: 0.18, accel: 8.5, maxSpeed: 6.4, setupTime: 0.12 },
};

export function athletics(profile: Pick<Profile, 'heightCm' | 'level'>): Athletics {
  const heightM = profile.heightCm / 100;
  const k = heightM / 1.75;
  const base = BY_LEVEL[profile.level];
  return {
    heightM,
    reaction: base.reaction,
    accel: base.accel,
    // Taller players have a slightly longer stride but no faster reaction.
    maxSpeed: base.maxSpeed * (0.9 + 0.1 * k),
    setupTime: base.setupTime,
    contactBand: [0.3 * k, 1.6 * k],
    reachTolerance: 0.2 * k,
  };
}

/** Rest-to-rest time to cover distance d with a trapezoidal speed profile. */
export function travelTime(d: number, a: Athletics): number {
  if (d <= 0) return 0;
  const dAccel = (a.maxSpeed * a.maxSpeed) / a.accel; // accelerate + brake distance
  return d >= dAccel ? d / a.maxSpeed + a.maxSpeed / a.accel : 2 * Math.sqrt(d / a.accel);
}

/** Distance covered after time t when moving flat out (for "can't reach" playback). */
export function distanceCovered(t: number, a: Athletics): number {
  if (t <= 0) return 0;
  const tAcc = a.maxSpeed / a.accel;
  return t <= tAcc ? 0.5 * a.accel * t * t : 0.5 * a.accel * tAcc * tAcc + a.maxSpeed * (t - tAcc);
}
