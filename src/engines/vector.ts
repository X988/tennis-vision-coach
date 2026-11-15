/** Minimal immutable 3D vector helpers (framework-free, easy to unit test). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const UP: Vec3 = Object.freeze(vec(0, 1, 0));

export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => vec(a.x * s, a.y * s, a.z * s);
/** a + b * s */
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 =>
  vec(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-12 ? scale(a, 1 / l) : vec();
};
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
/** Horizontal (XZ-plane) projection. */
export const horizontal = (a: Vec3): Vec3 => vec(a.x, 0, a.z);

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
export const degToRad = (d: number) => (d * Math.PI) / 180;
