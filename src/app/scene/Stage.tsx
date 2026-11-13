import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { SimulationClock } from '../../engines/clock';
import { Plan, ballPositionAt, buildOpponentMotion } from '../../engines/plan';
import { CameraView, Layers, Quality } from '../store';
import { Athlete } from './Athlete';
import { Ball } from './Ball';
import { CameraRig } from './CameraRig';
import { viewFor } from './views';
import { Court } from './Court';
import { Marker, Overlays } from './Overlays';

interface StageProps {
  plan: Plan;
  clock: SimulationClock;
  view: CameraView;
  layers: Layers;
  quality: Quality;
  markers?: Marker[];
  /** Plan whose contact pose is drawn as a translucent "ghost" (defaults to this plan). */
  ghostPlan?: Plan | null;
  label?: string;
  tone?: 'good' | 'bad';
  /** Hide the reply shot and the player (decision mode, before the answer). */
  hideAnswer?: boolean;
}

/**
 * One 3D view of a plan. Several stages may share one SimulationClock
 * (comparison mode); the clock is advanced outside, once per frame.
 */
export function Stage({ plan, clock, view, layers, quality, markers, ghostPlan, label, tone, hideAnswer = false }: StageProps) {
  const [degraded, setDegraded] = useState(false);
  const low = quality === 'low' || (quality === 'auto' && degraded);
  const initial = viewFor(plan, view === 'free' ? 'back' : view)!;
  const ghost = ghostPlan === undefined ? plan : ghostPlan;
  const launch = plan.incoming.initial.pos;
  const opponent = useMemo(() => buildOpponentMotion(launch), [launch]);
  const ballAt = useCallback((t: number) => ballPositionAt(plan, t), [plan]);
  // The opponent is drawn in a frame rotated by 180 degrees around the net centre.
  const ballAtMirrored = useCallback(
    (t: number) => {
      const p = ballPositionAt(plan, t);
      return { x: -p.x, y: p.y, z: -p.z };
    },
    [plan],
  );

  return (
    <div className={`stage ${tone ? `stage-${tone}` : ''}`} data-tour="stage">
      <Canvas
        shadows={low ? false : 'soft'}
        dpr={low ? 1 : [1, 2]}
        camera={{ position: initial.pos.toArray(), fov: 45, near: 0.05, far: 200 }}
        gl={{ antialias: !low, powerPreference: 'high-performance' }}
      >
        {quality === 'auto' && <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} />}
        <color attach="background" args={['#0d1420']} />
        <fog attach="fog" args={['#0d1420', 40, 85]} />
        <hemisphereLight args={['#eaf3ff', '#33402f', 0.75]} />
        <directionalLight position={[-8, 10, 12]} intensity={0.35} />
        <directionalLight
          position={[6, 18, -10]}
          intensity={1.5}
          castShadow={!low}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <OrbitControls makeDefault target={initial.target} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={60} />
        <CameraRig plan={plan} view={view} />
        <Court surface={plan.scenario.surface} />
        <group rotation={[0, Math.PI, 0]}>
          <Athlete motion={opponent} clock={clock} shadows={!low} low palette="opponent" lookAt={ballAtMirrored} />
        </group>
        <Athlete motion={plan.motion} clock={clock} shadows={!low} low={low} lookAt={ballAt} />
        {layers.ghost && ghost && ghost.contact.made && <Athlete motion={ghost.motion} clock={clock} fixedTime={ghost.contact.t} ghost low />}
        <Ball plan={plan} clock={clock} />
        <Overlays plan={plan} layers={layers} markers={markers} hideReply={hideAnswer} />
      </Canvas>
      {label && <div className="stage-label">{label}</div>}
    </div>
  );
}
