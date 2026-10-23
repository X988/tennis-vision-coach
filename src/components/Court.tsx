import { useMemo } from 'react';
import * as THREE from 'three';

export function Court() {
  const courtLength = 23.77;
  const singlesWidth = 8.23;
  const netHeight = 0.914;

  const courtGeo = useMemo(() => new THREE.PlaneGeometry(singlesWidth, courtLength), []);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const courtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 }), []);

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} geometry={courtGeo} material={courtMat} />
      {/* Baselines */}
      <mesh position={[0, 0.02, courtLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[singlesWidth, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.02, -courtLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[singlesWidth, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Sidelines */}
      <mesh position={[singlesWidth / 2, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, courtLength]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-singlesWidth / 2, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.05, courtLength]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Service lines approx */}
      <mesh position={[0, 0.02, 6.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[singlesWidth, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.02, -6.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[singlesWidth, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
      {/* Net */}
      <mesh position={[0, netHeight / 2, 0]}>
        <boxGeometry args={[singlesWidth, netHeight, 0.05]} />
        <meshStandardMaterial color="#111" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
