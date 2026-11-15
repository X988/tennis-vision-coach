import { useMemo } from 'react';
import * as THREE from 'three';
import {
  COURT_HALF_LENGTH,
  DOUBLES_HALF_WIDTH,
  NET_HEIGHT_CENTER,
  NET_HEIGHT_POST,
  NET_POST_X,
  SERVICE_LINE_DIST,
  SINGLES_HALF_WIDTH,
  SurfaceId,
} from '../../engines/physics';

const LINE = 0.05;
const LINE_Y = 0.004;

const SURFACE_COLORS: Record<SurfaceId, { court: string; surround: string }> = {
  hard: { court: '#2f5f9e', surround: '#3f7a4a' },
  clay: { court: '#b8582e', surround: '#a24d29' },
  grass: { court: '#4f8a3a', surround: '#477d34' },
};

/** A white court line lying on the ground, from (x1, z1) to (x2, z2) — axis-aligned only. */
function Line({ x1, z1, x2, z2 }: { x1: number; z1: number; x2: number; z2: number }) {
  const w = Math.abs(x2 - x1) || LINE;
  const l = Math.abs(z2 - z1) || LINE;
  return (
    <mesh position={[(x1 + x2) / 2, LINE_Y, (z1 + z2) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial color="#f4f4f4" roughness={0.8} />
    </mesh>
  );
}

let netTexture: THREE.CanvasTexture | null = null;
function netMesh() {
  if (netTexture) return netTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(10,12,14,0.28)';
  g.fillRect(0, 0, 32, 32);
  g.strokeStyle = 'rgba(15,17,20,0.95)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 32, 32);
  netTexture = new THREE.CanvasTexture(c);
  netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping;
  return netTexture;
}

function Net() {
  const avg = (NET_HEIGHT_CENTER + NET_HEIGHT_POST) / 2;
  const angle = Math.atan2(NET_HEIGHT_POST - NET_HEIGHT_CENTER, NET_POST_X);
  const map = useMemo(() => {
    const t = netMesh().clone();
    t.repeat.set(NET_POST_X / 0.09, avg / 0.09);
    t.needsUpdate = true;
    return t;
  }, [avg]);
  return (
    <group>
      {/* Net mesh, one panel per half. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * NET_POST_X) / 2, avg / 2, 0]}>
          <planeGeometry args={[NET_POST_X, avg]} />
          <meshBasicMaterial map={map} transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* White tape on top */}
      {[-1, 1].map((side) => (
        <mesh key={`tape${side}`} position={[(side * NET_POST_X) / 2, avg, 0]} rotation={[0, 0, side * angle]}>
          <boxGeometry args={[NET_POST_X + 0.02, 0.06, 0.025]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ))}
      {/* Centre strap */}
      <mesh position={[0, NET_HEIGHT_CENTER / 2, 0]}>
        <boxGeometry args={[0.05, NET_HEIGHT_CENTER, 0.015]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      {/* Posts */}
      {[-1, 1].map((side) => (
        <mesh key={`post${side}`} position={[side * NET_POST_X, NET_HEIGHT_POST / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, NET_HEIGHT_POST + 0.02, 12]} />
          <meshStandardMaterial color="#1d3b2a" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Court({ surface }: { surface: SurfaceId }) {
  const L = COURT_HALF_LENGTH;
  const S = SINGLES_HALF_WIDTH;
  const D = DOUBLES_HALF_WIDTH;
  const SL = SERVICE_LINE_DIST;
  const colors = SURFACE_COLORS[surface];

  return (
    <group>
      {/* Run-off area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[D * 2 + 8, L * 2 + 14]} />
        <meshStandardMaterial color={colors.surround} roughness={0.95} />
      </mesh>
      {/* Playing surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[D * 2, L * 2]} />
        <meshStandardMaterial color={colors.court} roughness={0.9} />
      </mesh>

      {/* Baselines and sidelines (singles + doubles) */}
      <Line x1={-D} z1={L} x2={D} z2={L} />
      <Line x1={-D} z1={-L} x2={D} z2={-L} />
      {[-D, -S, S, D].map((x) => (
        <Line key={x} x1={x} z1={-L} x2={x} z2={L} />
      ))}
      {/* Service lines and centre service line */}
      <Line x1={-S} z1={SL} x2={S} z2={SL} />
      <Line x1={-S} z1={-SL} x2={S} z2={-SL} />
      <Line x1={0} z1={-SL} x2={0} z2={SL} />
      {/* Centre marks */}
      <Line x1={0} z1={L - 0.1} x2={0} z2={L} />
      <Line x1={0} z1={-L} x2={0} z2={-L + 0.1} />

      <Net />
    </group>
  );
}
