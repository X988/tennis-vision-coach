import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationClock } from '../../engines/clock';
import { T_OPPONENT } from '../../engines/plan';
import { Vec3 } from '../../engines/vector';

/** Simplified opponent at the launch point; the arm swings through the opponent's contact. */
export function Opponent({ launch, clock }: { launch: Vec3; clock: SimulationClock }) {
  const arm = useRef<THREE.Group>(null!);
  useFrame(() => {
    const u = THREE.MathUtils.clamp((clock.time - (T_OPPONENT - 0.35)) / 0.6, 0, 1);
    arm.current.rotation.y = -1.6 + u * 3.0;
  });
  const side = launch.x >= 0 ? 0.75 : -0.75;
  return (
    <group position={[launch.x + side, 0, launch.z + 0.3]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.9, 4, 10]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshStandardMaterial color="#e2b48c" />
      </mesh>
      <group ref={arm} position={[side > 0 ? 0.25 : -0.25, 1.3, 0]}>
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  );
}
