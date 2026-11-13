import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { Plan, pelvisPositionAt } from '../../engines/plan';
import { Vec3, sub, normalize } from '../../engines/vector';
import { Layers } from '../store';

type P3 = [number, number, number];
const toP = (v: Vec3): P3 => [v.x, v.y, v.z];

export interface Marker {
  id: string;
  label: string;
  pos: Vec3;
  tone?: 'neutral' | 'good' | 'ok' | 'bad';
}

const TONE = { neutral: '#ffffff', good: '#4ade80', ok: '#facc15', bad: '#ff5d5d' };

function Footprint({ pos, yaw, color, opacity }: { pos: Vec3; yaw: number; color: string; opacity: number }) {
  return (
    <mesh position={[pos.x, 0.012, pos.z]} rotation={[-Math.PI / 2, 0, yaw]}>
      <circleGeometry args={[0.07, 16]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      <mesh position={[0, 0.11, 0]} scale={[1, 1.6, 1]}>
        <circleGeometry args={[0.055, 16]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </mesh>
  );
}

export function Overlays({ plan, layers, markers = [], hideReply = false }: { plan: Plan; layers: Layers; markers?: Marker[]; hideReply?: boolean }) {
  const incoming = useMemo(() => plan.ball.filter((s) => s.t <= plan.contact.t || !plan.contact.made).map((s) => toP(s.pos)), [plan]);
  const reply = useMemo(() => (plan.contact.made && !hideReply ? plan.ball.filter((s) => s.t >= plan.contact.t).map((s) => toP(s.pos)) : []), [plan, hideReply]);
  const pelvisRoute = useMemo(() => {
    const pts: P3[] = [];
    for (let t = 0; t <= plan.contact.t + 0.05; t += 0.04) {
      const p = pelvisPositionAt(plan.motion.pelvisPath, t);
      pts.push([p.x, 0.02, p.z]);
    }
    return pts;
  }, [plan]);
  const steps = useMemo(
    () => [...plan.motion.feet.left, ...plan.motion.feet.right].filter((p) => p.kind === 'step' || p.kind === 'stance'),
    [plan],
  );
  const z = plan.contactZone;
  const firstBounce = plan.incoming.flight.bounces[0];
  const replyBounce = hideReply ? undefined : plan.reply?.flight.bounces[0];

  return (
    <group>
      {layers.trail && incoming.length > 1 && <Line points={incoming} color="#ffb347" lineWidth={2} transparent opacity={0.75} />}
      {layers.trail && reply.length > 1 && <Line points={reply} color="#4fd1ff" lineWidth={2} transparent opacity={0.75} />}
      {layers.bounce && firstBounce && (
        <mesh position={[firstBounce.pos.x, 0.012, firstBounce.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.19, 32]} />
          <meshBasicMaterial color="#ffb347" />
        </mesh>
      )}
      {layers.bounce && replyBounce && (
        <mesh position={[replyBounce.pos.x, 0.012, replyBounce.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.19, 32]} />
          <meshBasicMaterial color={plan.reply?.inside ? '#4fd1ff' : '#ff5d5d'} />
        </mesh>
      )}
      {layers.footRoute && (
        <>
          <Line points={pelvisRoute} color="#ffffff" lineWidth={1} dashed dashSize={0.12} gapSize={0.08} transparent opacity={0.6} />
          {steps.map((p, i) => (
            <Footprint key={i} pos={p.pos} yaw={p.yaw} color={p.kind === 'stance' ? '#7fe3ff' : '#ffffff'} opacity={p.kind === 'stance' ? 0.55 : 0.3} />
          ))}
        </>
      )}
      {layers.contactZone && (
        <mesh position={toP(z.center)}>
          <sphereGeometry args={[z.radius, 24, 16]} />
          <meshBasicMaterial color={z.ok ? '#4ade80' : '#ff8a3d'} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      {layers.direction && plan.reply && (
        <Arrow from={plan.contact.pos} to={{ ...plan.reply.target, y: 0.05 }} color={plan.reply.inside ? '#4fd1ff' : '#ff5d5d'} />
      )}
      {markers.map((m) => (
        <group key={m.id} position={toP(m.pos)}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={TONE[m.tone ?? 'neutral']} />
          </mesh>
          <Line points={[[0, 0, 0], [0, -m.pos.y, 0]]} color={TONE[m.tone ?? 'neutral']} lineWidth={1} dashed dashSize={0.05} gapSize={0.05} />
          <Html center distanceFactor={9} position={[0, 0.3, 0]} zIndexRange={[10, 0]}>
            <span className="marker-label">{m.label}</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Arrow({ from, to, color }: { from: Vec3; to: Vec3; color: string }) {
  const d = normalize(sub(to, from));
  const head: P3 = [to.x - d.x * 0.5, to.y + 0.05, to.z - d.z * 0.5];
  return (
    <group>
      <Line points={[[from.x, 0.03, from.z], [to.x, 0.03, to.z]]} color={color} lineWidth={3} transparent opacity={0.7} />
      <mesh position={head} rotation={[0, Math.atan2(d.x, d.z), 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 0.5, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </mesh>
    </group>
  );
}
