import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationClock } from '../../engines/clock';
import { BALL_RADIUS } from '../../engines/physics';
import { Plan, ballPositionAt } from '../../engines/plan';

export function Ball({ plan, clock }: { plan: Plan; clock: SimulationClock }) {
  const ball = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const p = ballPositionAt(plan, clock.time);
    ball.current.position.set(p.x, p.y, p.z);
    shadow.current.position.set(p.x, 0.006, p.z);
    shadow.current.scale.setScalar(0.7 + p.y * 0.25);
    mat.current.opacity = 0.12 + 0.4 * Math.max(0, 1 - p.y / 4);
  });
  return (
    <>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_RADIUS * 1.5, 20, 16]} />
        <meshStandardMaterial color="#d7f230" emissive="#5a6b00" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BALL_RADIUS * 1.8, 20]} />
        <meshBasicMaterial ref={mat} color="#000" transparent depthWrite={false} />
      </mesh>
    </>
  );
}
