import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulationClock } from '../../engines/clock';
import { BALL_RADIUS } from '../../engines/physics';
import { Plan, ballPositionAt } from '../../engines/plan';

const TRAIL = 7;
const TRAIL_DT = 0.022;
/** Drawn a little larger than a real ball so it stays readable on a phone. */
const R = BALL_RADIUS * 1.5;

function seamTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d4ee2c';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#f7ffe0';
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 0; x <= 128; x++) {
    const y = 32 + 18 * Math.sin((x / 128) * Math.PI * 4);
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/**
 * Ball with a seam (so its spin is visible), a contact shadow and a short
 * motion trail. The trail is computed from the plan, so it is also correct
 * when paused, stepping frame by frame or scrubbing.
 */
export function Ball({ plan, clock }: { plan: Plan; clock: SimulationClock }) {
  const ball = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null!);
  const trail = useRef<(THREE.Mesh | null)[]>([]);
  const texture = useMemo(seamTexture, []);
  const spinSign = plan.incoming.spinRpm >= 0 ? 1 : -1;

  useFrame(() => {
    const t = clock.time;
    const p = ballPositionAt(plan, t);
    ball.current.position.set(p.x, p.y, p.z);
    // Visual spin about the horizontal axis (slowed down to stay readable).
    ball.current.rotation.x = -spinSign * t * 14 * (t < plan.contact.t ? 1 : -1.2);
    shadow.current.position.set(p.x, 0.006, p.z);
    shadow.current.scale.setScalar(0.7 + p.y * 0.25);
    shadowMat.current.opacity = 0.14 + 0.4 * Math.max(0, 1 - p.y / 4);
    for (let i = 0; i < TRAIL; i++) {
      const m = trail.current[i];
      if (!m) continue;
      const q = ballPositionAt(plan, t - (i + 1) * TRAIL_DT);
      m.position.set(q.x, q.y, q.z);
      m.visible = Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + Math.abs(q.z - p.z) > 0.01;
    }
  });

  return (
    <>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[R, 24, 18]} />
        <meshStandardMaterial map={texture} emissive="#5a6b00" emissiveIntensity={0.35} roughness={0.85} />
      </mesh>
      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh key={i} ref={(m) => (trail.current[i] = m)} scale={1 - (i + 1) / (TRAIL + 2)}>
          <sphereGeometry args={[R, 10, 8]} />
          <meshBasicMaterial color="#e6ff5a" transparent opacity={0.34 * (1 - i / TRAIL)} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BALL_RADIUS * 1.8, 20]} />
        <meshBasicMaterial ref={shadowMat} color="#000" transparent depthWrite={false} />
      </mesh>
    </>
  );
}
