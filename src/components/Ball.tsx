import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BALL_RADIUS } from '../engines/physics';
import { Scenario } from '../engines/Scenario';

export function Ball({ scenario }: { scenario: Scenario }) {
  const ball = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame(() => {
    const p = scenario.getBallPosition();
    ball.current.position.set(p.x, p.y, p.z);
    // Contact shadow helps judge height and depth (the key visual cue for reading a ball).
    shadow.current.position.set(p.x, 0.006, p.z);
    const k = Math.max(0, 1 - p.y / 4);
    shadow.current.scale.setScalar(0.6 + p.y * 0.25);
    shadowMat.current.opacity = 0.15 + 0.4 * k;
  });

  return (
    <>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_RADIUS * 1.6, 20, 20]} />
        <meshStandardMaterial color="#d7f230" emissive="#5a6b00" emissiveIntensity={0.35} roughness={0.6} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BALL_RADIUS * 1.8, 20]} />
        <meshBasicMaterial ref={shadowMat} color="#000" transparent depthWrite={false} />
      </mesh>
    </>
  );
}
