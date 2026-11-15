/**
 * Court coordinates used in scenario files (coach-friendly, see docs/SCENARIO_FORMAT.md):
 *   origin — centre of the net on the ground;
 *   X — across the court, positive to the coached player's RIGHT (as seen from their baseline);
 *   Y — along the court, NEGATIVE on the coached player's half, positive on the opponent's;
 *   h — height above the ground. All values in metres.
 *
 * Internal 3D world (three.js, y up): the player faces +z, so the player's right is -x.
 *   world = (-X, h, Y)
 */
import { Vec3, vec } from './vector';

export interface CourtPoint {
  x: number;
  y: number;
}

export const courtToWorld = (p: CourtPoint, h = 0): Vec3 => vec(-p.x, h, p.y);
export const worldToCourt = (v: Vec3): CourtPoint => ({ x: -v.x, y: v.z });

/** World unit vector pointing to the coached player's right. */
export const PLAYER_RIGHT: Vec3 = Object.freeze(vec(-1, 0, 0));
/** World unit vector pointing from the player towards the net. */
export const PLAYER_FORWARD: Vec3 = Object.freeze(vec(0, 0, 1));
