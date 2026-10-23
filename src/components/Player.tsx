import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Scenario } from '../engines/Scenario';
import * as THREE from 'three';

// Placeholder player. Replace with useGLTF('/models/player.glb') for real glTF.
export function Player({ scenario }: { scenario: Scenario }) {
  const group = useRef<THREE.Group>(null!);
  const arm = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const prog = scenario.getAnimProgress();
    // Simple forehand swing
    if (arm.current) {
      arm.current.rotation.z = Math.sin(prog * Math.PI * 2) * 1.2 - 0.5;
      arm.current.rotation.y = Math.sin(prog * Math.PI) * 0.8;
    }
  });

  return (
    <group ref={group} position={[0, 0, -10]}>
      {/* Body */}
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.3, 1, 4, 8]} />
        <meshStandardMaterial color="#4a90d9" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Racket arm */}
      <mesh ref={arm} position={[0.5, 1.2, 0]}>
        <boxGeometry args={[0.1, 0.6, 0.1]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Racket head */}
      <mesh position={[0.7, 1.5, 0]}>
        <torusGeometry args={[0.15, 0.02, 8, 16]} />
        <meshStandardMaterial color="#aaa" />
      </mesh>
    </group>
  );
}
