import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { BALL_RADIUS } from '../engines/physics';
import { RallyResult } from '../engines/rally';
import { Vec3 } from '../engines/vector';

const INCOMING = '#ffb347';
const OUTGOING = '#4fd1ff';

function toPoints(samples: { pos: Vec3 }[]): [number, number, number][] {
  return samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1).map((s) => [s.pos.x, s.pos.y, s.pos.z]);
}

function BounceMarker({ pos, color, inside }: { pos: Vec3; color: string; inside: boolean | null }) {
  return (
    <mesh position={[pos.x, 0.01, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.12, 0.18, 32]} />
      <meshBasicMaterial color={inside === false ? '#ff4d4d' : color} transparent opacity={0.9} />
    </mesh>
  );
}

/** Ball path (incoming / outgoing), bounce marks and the contact point. */
export function TrajectoryOverlay({ rally }: { rally: RallyResult }) {
  const incoming = useMemo(() => toPoints(rally.incoming.flight.samples), [rally]);
  const outgoing = useMemo(() => toPoints(rally.outgoing.flight.samples), [rally]);
  const c = rally.contact.pos;

  return (
    <group>
      <Line points={incoming} color={INCOMING} lineWidth={2} transparent opacity={0.8} />
      <Line points={outgoing} color={OUTGOING} lineWidth={2} transparent opacity={0.8} />
      {rally.incoming.bounce && (
        <BounceMarker pos={rally.incoming.bounce} color={INCOMING} inside={rally.incoming.inside} />
      )}
      {rally.outgoing.bounce && (
        <BounceMarker pos={rally.outgoing.bounce} color={OUTGOING} inside={rally.outgoing.inside} />
      )}
      {/* Contact point and its projection on the ground */}
      <mesh position={[c.x, c.y, c.z]}>
        <sphereGeometry args={[BALL_RADIUS * 3, 16, 16]} />
        <meshBasicMaterial color="#ffffff" wireframe />
      </mesh>
      <Line
        points={[
          [c.x, 0, c.z],
          [c.x, c.y, c.z],
        ]}
        color="#ffffff"
        dashed
        dashSize={0.05}
        gapSize={0.05}
        lineWidth={1}
      />
    </group>
  );
}
