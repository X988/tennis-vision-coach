import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Scenario } from '../engines/Scenario';
import * as THREE from 'three';

export function Ball({ scenario }: { scenario: Scenario }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const pos = scenario.getBallPos();
    ref.current.position.copy(pos);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.065, 16, 16]} />
      <meshStandardMaterial color="#c8e600" />
    </mesh>
  );
}
