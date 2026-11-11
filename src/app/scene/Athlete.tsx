import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationClock } from '../../engines/clock';
import { Joints, poseAt } from '../../engines/motion';
import { MotionPlan } from '../../engines/plan';
import { Vec3 } from '../../engines/vector';

const Y = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

type BoneSpec = { from: (j: Joints) => Vec3; to: (j: Joints) => Vec3; r: number; color: string };

const SKIN = '#e2b48c';
const SHIRT = '#f4f4f4';
const SHORTS = '#1f2a44';
const SHOE = '#30343c';

const BONES: BoneSpec[] = [
  { from: (j) => j.hip.left, to: (j) => j.knee.left, r: 0.065, color: SKIN },
  { from: (j) => j.knee.left, to: (j) => j.ankle.left, r: 0.05, color: SKIN },
  { from: (j) => j.hip.right, to: (j) => j.knee.right, r: 0.065, color: SKIN },
  { from: (j) => j.knee.right, to: (j) => j.ankle.right, r: 0.05, color: SKIN },
  { from: (j) => j.heel.left, to: (j) => j.toe.left, r: 0.045, color: SHOE },
  { from: (j) => j.heel.right, to: (j) => j.toe.right, r: 0.045, color: SHOE },
  { from: (j) => j.hip.left, to: (j) => j.hip.right, r: 0.11, color: SHORTS },
  { from: (j) => j.pelvis, to: (j) => j.chest, r: 0.15, color: SHIRT },
  { from: (j) => j.shoulder.left, to: (j) => j.shoulder.right, r: 0.07, color: SHIRT },
  { from: (j) => j.chest, to: (j) => j.neck, r: 0.05, color: SKIN },
  { from: (j) => j.shoulder.left, to: (j) => j.elbow.left, r: 0.045, color: SKIN },
  { from: (j) => j.elbow.left, to: (j) => j.wrist.left, r: 0.038, color: SKIN },
  { from: (j) => j.shoulder.right, to: (j) => j.elbow.right, r: 0.045, color: SKIN },
  { from: (j) => j.elbow.right, to: (j) => j.wrist.right, r: 0.038, color: SKIN },
  { from: (j) => j.racket.butt, to: (j) => j.racket.throat, r: 0.016, color: '#222' },
];

function placeBone(mesh: THREE.Mesh, a: Vec3, b: Vec3) {
  tmpA.set(a.x, a.y, a.z);
  tmpB.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = Math.max(1e-4, tmpB.length());
  mesh.position.copy(tmpA).addScaledVector(tmpB, 0.5);
  mesh.quaternion.setFromUnitVectors(Y, tmpB.normalize());
  mesh.scale.set(1, len, 1);
}

interface AthleteProps {
  motion: MotionPlan;
  clock: SimulationClock;
  /** Render a static pose at this time instead of following the clock (ghost). */
  fixedTime?: number;
  ghost?: boolean;
  shadows?: boolean;
}

/**
 * Procedural articulated player. Every frame the Animation Engine computes
 * the joints for the shared simulation time; meshes are only placed on them.
 */
export function Athlete({ motion, clock, fixedTime, ghost = false, shadows = true }: AthleteProps) {
  const bones = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Mesh>(null!);
  const racketHead = useRef<THREE.Group>(null!);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const vx = useMemo(() => new THREE.Vector3(), []);
  const vy = useMemo(() => new THREE.Vector3(), []);
  const vz = useMemo(() => new THREE.Vector3(), []);
  const geom = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10), []);
  const materials = useMemo(
    () =>
      BONES.map(
        (b) =>
          new THREE.MeshStandardMaterial({
            color: ghost ? '#7fe3ff' : b.color,
            transparent: ghost,
            opacity: ghost ? 0.28 : 1,
            depthWrite: !ghost,
            roughness: 0.7,
          }),
      ),
    [ghost],
  );

  useFrame(() => {
    const j = poseAt(motion, fixedTime ?? clock.time);
    BONES.forEach((b, i) => {
      const m = bones.current[i];
      if (!m) return;
      placeBone(m, b.from(j), b.to(j));
      m.scale.x = m.scale.z = b.r * (motion.heightM / 1.75);
    });
    head.current.position.set(j.head.x, j.head.y, j.head.z);
    head.current.scale.setScalar(j.dims.headR);
    const r = j.racket;
    vx.set(r.dir.x, r.dir.y, r.dir.z).normalize();
    vz.set(r.normal.x, r.normal.y, r.normal.z).normalize();
    vy.crossVectors(vz, vx).normalize();
    basis.makeBasis(vx, vy, vz);
    racketHead.current.quaternion.setFromRotationMatrix(basis);
    racketHead.current.position.set(r.head.x, r.head.y, r.head.z);
  });

  return (
    <group>
      {BONES.map((_, i) => (
        <mesh key={i} ref={(m) => (bones.current[i] = m)} geometry={geom} material={materials[i]} castShadow={shadows && !ghost} />
      ))}
      <mesh ref={head} castShadow={shadows && !ghost}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={ghost ? '#7fe3ff' : SKIN} transparent={ghost} opacity={ghost ? 0.28 : 1} depthWrite={!ghost} />
      </mesh>
      <group ref={racketHead}>
        <mesh scale={[1.3, 1, 1]} castShadow={shadows && !ghost}>
          <torusGeometry args={[0.135, 0.011, 8, 32]} />
          <meshStandardMaterial color={ghost ? '#7fe3ff' : '#e23d28'} transparent={ghost} opacity={ghost ? 0.35 : 1} />
        </mesh>
        <mesh scale={[1.3, 1, 1]}>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color="#ddd" transparent opacity={ghost ? 0.12 : 0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
