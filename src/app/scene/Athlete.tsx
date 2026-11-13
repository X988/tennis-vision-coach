import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationClock } from '../../engines/clock';
import { Joints, poseAt } from '../../engines/motion';
import { MotionPlan } from '../../engines/plan';
import { Vec3 } from '../../engines/vector';

export type Palette = 'player' | 'opponent';

const COLORS: Record<Palette, { shirt: string; accent: string; shorts: string; shoe: string; sole: string; hair: string; skin: string; racket: string }> = {
  player: { shirt: '#f4f5f2', accent: '#2b6fd6', shorts: '#1c2742', shoe: '#f2f2f2', sole: '#2b6fd6', hair: '#3a2a1f', skin: '#dfa985', racket: '#e23d28' },
  opponent: { shirt: '#d1493c', accent: '#f4f5f2', shorts: '#23262d', shoe: '#f2f2f2', sole: '#d1493c', hair: '#1d1b1a', skin: '#c99272', racket: '#f0c419' },
};
const GHOST = '#7fe3ff';

const Y = new THREE.Vector3(0, 1, 0);
const a3 = new THREE.Vector3();
const b3 = new THREE.Vector3();
const vx = new THREE.Vector3();
const vy = new THREE.Vector3();
const vz = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const set = (v: THREE.Vector3, p: Vec3) => v.set(p.x, p.y, p.z);

let stringTexture: THREE.CanvasTexture | null = null;
function strings() {
  if (stringTexture) return stringTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.2;
  for (let i = 6; i < 128; i += 9) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  stringTexture = new THREE.CanvasTexture(c);
  return stringTexture;
}

interface RigOptions {
  palette: Palette;
  ghost: boolean;
  shadows: boolean;
  low: boolean;
}

/**
 * Builds the player's body once and returns an `update` that places every
 * part on the joints computed by the Animation Engine. No skinning: limbs are
 * tapered segments with joint spheres, the torso is three overlapping volumes
 * that follow hips, waist and shoulders separately (so the body visibly coils).
 */
function createRig({ palette, ghost, shadows, low }: RigOptions) {
  const c = COLORS[palette];
  const seg = low ? 8 : 14;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial(
      ghost ? { color: GHOST, transparent: true, opacity: 0.26, depthWrite: false, roughness: 1 } : { color, roughness: 0.78, ...extra },
    );
    disposables.push(m);
    return m;
  };
  const M = {
    skin: mat(c.skin),
    shirt: mat(c.shirt),
    accent: mat(c.accent),
    shorts: mat(c.shorts),
    shoe: mat(c.shoe),
    sole: mat(c.sole),
    hair: mat(c.hair, { roughness: 0.95 }),
    dark: mat('#1b1b1f'),
    frame: mat(c.racket, { metalness: 0.35, roughness: 0.4 }),
    white: mat('#fafafa'),
  };
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = group) => {
    parent.add(o);
    if (o instanceof THREE.Mesh) {
      o.castShadow = shadows && !ghost;
      disposables.push(o.geometry);
    }
    return o;
  };
  /** Tapered segment along +Y, unit length: radius rFrom at the start, rTo at the end. */
  const bone = (rFrom: number, rTo: number, material: THREE.Material) => add(new THREE.Mesh(new THREE.CylinderGeometry(rTo, rFrom, 1, seg, 1), material));
  const ball = (r: number, material: THREE.Material) => add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), material));

  const sides = ['left', 'right'] as const;
  const legs = sides.map(() => ({
    thigh: bone(0.078, 0.056, M.skin),
    shorts: bone(0.092, 0.084, M.shorts),
    knee: ball(0.057, M.skin),
    shin: bone(0.054, 0.036, M.skin),
    sock: bone(0.04, 0.041, M.white),
    shoe: add(new THREE.Group()),
  }));
  for (const l of legs) {
    const upper = add(new THREE.Mesh(new THREE.SphereGeometry(1, seg, 8), M.shoe), l.shoe);
    upper.scale.set(0.05, 0.044, 0.142);
    upper.position.set(0, 0.012, 0.01);
    const sole = add(new THREE.Mesh(new THREE.SphereGeometry(1, seg, 6), M.sole), l.shoe);
    sole.scale.set(0.052, 0.016, 0.146);
    sole.position.set(0, -0.026, 0.01);
  }
  const arms = sides.map(() => ({
    shoulder: ball(0.062, M.shirt),
    sleeve: bone(0.06, 0.055, M.shirt),
    upper: bone(0.047, 0.04, M.skin),
    elbow: ball(0.041, M.skin),
    fore: bone(0.039, 0.028, M.skin),
    hand: ball(1, M.skin),
  }));
  const hips = ball(1, M.shorts);
  const waist = ball(1, M.shirt);
  const chest = ball(1, M.shirt);
  const yoke = bone(0.06, 0.06, M.shirt); // fills the shoulder line between the arms
  const neck = bone(0.047, 0.043, M.skin);
  const collar = bone(0.062, 0.05, M.accent);

  const head = add(new THREE.Group());
  const skull = add(new THREE.Mesh(new THREE.SphereGeometry(1, seg + 4, seg), M.skin), head);
  skull.scale.set(0.9, 1.06, 0.98);
  const hair = add(new THREE.Mesh(new THREE.SphereGeometry(1.05, seg + 4, seg, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair), head);
  hair.rotation.x = -0.42;
  hair.scale.set(0.93, 1.06, 1);
  const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.085, 6, seg + 6), M.accent), head);
  band.rotation.x = Math.PI / 2 - 0.25;
  band.position.y = 0.42;
  if (!ghost) {
    for (const sx of [-1, 1]) {
      const eye = add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), M.dark), head);
      eye.position.set(sx * 0.33, 0.08, 0.84);
      eye.castShadow = false;
    }
    const nose = add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M.skin), head);
    nose.position.set(0, -0.12, 0.92);
  }

  // Racket.
  const grip = bone(0.0175, 0.016, M.dark);
  const buttCap = ball(0.021, M.dark);
  const throat = [bone(0.0085, 0.0085, M.frame), bone(0.0085, 0.0085, M.frame)];
  const racketHead = add(new THREE.Group());
  const frame = add(new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.0115, 8, low ? 20 : 36), M.frame), racketHead);
  frame.scale.set(1.3, 1, 1.4);
  const stringMat = new THREE.MeshBasicMaterial({ map: strings(), transparent: true, opacity: ghost ? 0.15 : 0.9, side: THREE.DoubleSide, depthWrite: false });
  disposables.push(stringMat);
  const bed = add(new THREE.Mesh(new THREE.CircleGeometry(0.128, 28), stringMat), racketHead);
  bed.scale.set(1.3, 1, 1);
  bed.castShadow = false;

  const look = new THREE.Vector3(0, 0, 1);

  const place = (mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, k: number) => {
    b3.subVectors(to, from);
    const len = Math.max(1e-4, b3.length());
    mesh.position.copy(from).addScaledVector(b3, 0.5);
    mesh.quaternion.setFromUnitVectors(Y, b3.divideScalar(len));
    mesh.scale.set(k, len, k);
  };
  /** Orient with y along `up` and z as close to `fwd` as possible. */
  const orient = (o: THREE.Object3D, up: THREE.Vector3, fwd: THREE.Vector3) => {
    vy.copy(up).normalize();
    vz.copy(fwd).addScaledVector(vy, -fwd.dot(vy));
    if (vz.lengthSq() < 1e-8) {
      vz.set(1, 0, 0);
      vz.addScaledVector(vy, -vz.dot(vy));
      if (vz.lengthSq() < 1e-8) vz.set(0, 0, 1);
    }
    vz.normalize();
    vx.crossVectors(vy, vz);
    o.quaternion.setFromRotationMatrix(m4.makeBasis(vx, vy, vz));
  };

  const P = {
    a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(),
    pelvis: new THREE.Vector3(), chest: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3(),
  };

  function update(j: Joints, lookAt?: Vec3) {
    const k = j.dims.headR / (0.065 * 1.75);
    set(P.pelvis, j.pelvis);
    set(P.chest, j.chest);

    sides.forEach((s, i) => {
      const L = legs[i];
      set(P.a, j.hip[s]);
      set(P.b, j.knee[s]);
      set(P.c, j.ankle[s]);
      place(L.thigh, P.a, P.b, k);
      place(L.shorts, P.a, P.d.lerpVectors(P.a, P.b, 0.5), k);
      L.knee.position.copy(P.b);
      L.knee.scale.setScalar(k);
      place(L.shin, P.b, P.c, k);
      place(L.sock, P.d.lerpVectors(P.b, P.c, 0.74), P.c, k);
      set(P.a, j.heel[s]);
      set(P.b, j.toe[s]);
      L.shoe.position.lerpVectors(P.a, P.b, 0.36).y += 0.03 * k;
      // z runs heel -> toe, so the shoe also shows the foot roll while stepping.
      vz.subVectors(P.b, P.a).normalize();
      vx.crossVectors(Y, vz).normalize();
      vy.crossVectors(vz, vx);
      L.shoe.quaternion.setFromRotationMatrix(m4.makeBasis(vx, vy, vz));
      L.shoe.scale.setScalar(k);

      const A = arms[i];
      set(P.a, j.shoulder[s]);
      set(P.b, j.elbow[s]);
      set(P.c, j.wrist[s]);
      A.shoulder.position.copy(P.a);
      A.shoulder.scale.setScalar(k);
      place(A.upper, P.a, P.b, k);
      place(A.sleeve, P.a, P.d.lerpVectors(P.a, P.b, 0.5), k);
      A.elbow.position.copy(P.b);
      A.elbow.scale.setScalar(k);
      place(A.fore, P.b, P.c, k);
      A.hand.position.copy(P.c);
      A.hand.scale.set(0.043 * k, 0.05 * k, 0.036 * k);
    });

    // Torso: hips follow the pelvis, chest follows the shoulders, waist blends both.
    set(P.up, j.spineDir);
    hips.position.copy(P.pelvis).addScaledVector(P.up, 0.03 * k);
    hips.scale.set(0.178 * k, 0.13 * k, 0.128 * k);
    orient(hips, Y, set(P.fwd, j.pelvisFacing));
    waist.position.lerpVectors(P.pelvis, P.chest, 0.44);
    waist.scale.set(0.158 * k, 0.21 * k, 0.112 * k);
    orient(waist, P.up, set(P.fwd, j.pelvisFacing).add(a3.set(j.facing.x, j.facing.y, j.facing.z)));
    chest.position.lerpVectors(P.pelvis, P.chest, 0.84);
    chest.scale.set(0.192 * k, 0.175 * k, 0.125 * k);
    orient(chest, P.up, set(P.fwd, j.facing));
    place(yoke, set(P.a, j.shoulder.left), set(P.b, j.shoulder.right), k);
    set(P.a, j.head);
    place(neck, P.chest, P.a, k);
    place(collar, P.chest, P.d.lerpVectors(P.chest, P.a, 0.22), k);

    // Head: turns towards the ball, limited to what a neck can do.
    set(P.fwd, j.facing).setY(0).normalize();
    if (lookAt) {
      a3.set(lookAt.x - j.head.x, lookAt.y - j.head.y, lookAt.z - j.head.z);
      const dist = a3.length();
      if (dist > 0.3) {
        a3.divideScalar(dist);
        const pitch = THREE.MathUtils.clamp(Math.asin(a3.y), -0.55, 0.45);
        b3.set(a3.x, 0, a3.z).normalize();
        const yaw = THREE.MathUtils.clamp(Math.atan2(P.fwd.z * b3.x - P.fwd.x * b3.z, P.fwd.dot(b3)), -1.25, 1.25);
        b3.copy(P.fwd).applyAxisAngle(Y, yaw);
        P.fwd.set(b3.x * Math.cos(pitch), Math.sin(pitch), b3.z * Math.cos(pitch));
      }
    }
    look.lerp(P.fwd, 0.35).normalize();
    head.position.copy(P.a);
    head.scale.setScalar(j.dims.headR);
    orient(head, Y, look);

    // Racket.
    const r = j.racket;
    set(P.a, r.butt);
    set(P.b, r.grip).addScaledVector(set(a3, r.dir), 0.13);
    place(grip, P.a, P.b, 1);
    buttCap.position.copy(P.a);
    vx.set(r.dir.x, r.dir.y, r.dir.z).normalize();
    vz.set(r.normal.x, r.normal.y, r.normal.z);
    vz.addScaledVector(vx, -vz.dot(vx)).normalize();
    vy.crossVectors(vz, vx);
    racketHead.position.set(r.head.x, r.head.y, r.head.z);
    racketHead.quaternion.setFromRotationMatrix(m4.makeBasis(vx, vy, vz));
    throat.forEach((t, i) => {
      P.c.set(r.head.x, r.head.y, r.head.z)
        .addScaledVector(vx, -0.135 * 1.3 * 0.82)
        .addScaledVector(vy, (i ? 1 : -1) * 0.075);
      place(t, P.b, P.c, 1);
    });
  }

  return { group, update, dispose: () => disposables.forEach((d) => d.dispose()) };
}

interface AthleteProps {
  motion: MotionPlan;
  clock: SimulationClock;
  /** Render a static pose at this time instead of following the clock (ghost). */
  fixedTime?: number;
  ghost?: boolean;
  shadows?: boolean;
  low?: boolean;
  palette?: Palette;
  /** Point the head looks at (in the athlete's own frame), e.g. the ball. */
  lookAt?: (t: number) => Vec3;
}

/**
 * Procedural articulated player. Every frame the Animation Engine computes
 * the joints for the shared simulation time; the rig is only placed on them,
 * so a rigged glTF model can later be driven by the same pose.
 */
export function Athlete({ motion, clock, fixedTime, ghost = false, shadows = true, low = false, palette = 'player', lookAt }: AthleteProps) {
  const rig = useMemo(() => createRig({ palette, ghost, shadows, low }), [palette, ghost, shadows, low]);
  useEffect(() => () => rig.dispose(), [rig]);
  useFrame(() => {
    const t = fixedTime ?? clock.time;
    rig.update(poseAt(motion, t), lookAt?.(t));
  });
  return <primitive object={rig.group} />;
}
