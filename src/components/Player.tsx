import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Scenario } from '../engines/Scenario';
import { ARM_LENGTH, RACKET_HANDLE, RACKET_HEAD_RADIUS, SHOULDER_OFFSET } from '../engines/strokes';

const SKIN = '#e8b98f';
const SHIRT = '#f2f2f2';
const SHORTS = '#1f2a44';

/**
 * Primitive right-handed player whose kinematics match `strokes.ts` exactly,
 * so the racket head meets the ball at contact. Replace the meshes with a
 * rigged glTF (useGLTF) driven by the same pose for a realistic model.
 */
export function Player({ scenario }: { scenario: Scenario }) {
  const root = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const shoulder = useRef<THREE.Group>(null!);

  useFrame(() => {
    const { position, pose } = scenario.getPlayerState();
    root.current.position.set(position.x, 0, position.z);
    torso.current.rotation.y = pose.torsoYaw;
    // Euler order YXZ: pitch first, then yaw — same as racketCenter().
    shoulder.current.rotation.set(pose.armPitch, pose.armYaw - pose.torsoYaw, 0, 'YXZ');
  });

  const headZ = ARM_LENGTH + RACKET_HANDLE + RACKET_HEAD_RADIUS * 1.3;

  return (
    <group ref={root}>
      {/* Legs */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.75, 4, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.22, 12]} />
        <meshStandardMaterial color={SHORTS} />
      </mesh>

      <group ref={torso}>
        <mesh position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.19, 0.38, 4, 12]} />
          <meshStandardMaterial color={SHIRT} />
        </mesh>
        <mesh position={[0, 1.64, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        {/* Cap */}
        <mesh position={[0, 1.7, 0.03]} rotation={[0.2, 0, 0]}>
          <sphereGeometry args={[0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d33" />
        </mesh>
        {/* Non-hitting (left) arm, slightly forward for balance */}
        <mesh position={[0.26, 1.2, 0.12]} rotation={[-0.6, 0, 0.25]} castShadow>
          <capsuleGeometry args={[0.045, 0.5, 4, 8]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>

        {/* Hitting arm + racket, pointing along local +z of the shoulder group */}
        <group ref={shoulder} position={[SHOULDER_OFFSET.x, SHOULDER_OFFSET.y, SHOULDER_OFFSET.z]}>
          <mesh position={[0, 0, ARM_LENGTH / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.045, ARM_LENGTH - 0.09, 4, 8]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          <mesh position={[0, 0, ARM_LENGTH + RACKET_HANDLE / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.016, RACKET_HANDLE, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <group position={[0, 0, headZ]} rotation={[0, Math.PI / 2, 0]} scale={[1.3, 1, 1]}>
            <mesh castShadow>
              <torusGeometry args={[RACKET_HEAD_RADIUS, 0.012, 8, 32]} />
              <meshStandardMaterial color="#e23d28" metalness={0.3} roughness={0.4} />
            </mesh>
            <mesh>
              <circleGeometry args={[RACKET_HEAD_RADIUS, 32]} />
              <meshStandardMaterial color="#ddd" transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
