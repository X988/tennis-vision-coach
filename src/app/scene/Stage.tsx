import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { SimulationClock } from '../../engines/clock';
import { Plan } from '../../engines/plan';
import { CameraView, Layers, Quality } from '../store';
import { Athlete } from './Athlete';
import { Ball } from './Ball';
import { CameraRig } from './CameraRig';
import { viewFor } from './views';
import { Court } from './Court';
import { Marker, Overlays } from './Overlays';
import { Opponent } from './Opponent';

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

  return (
    <div className={`stage ${tone ? `stage-${tone}` : ''}`}>
      <Canvas
        shadows={!low}
        dpr={low ? 1 : [1, 2]}
        camera={{ position: initial.pos.toArray(), fov: 45, near: 0.05, far: 200 }}
        gl={{ antialias: !low, powerPreference: 'high-performance' }}
      >
        {quality === 'auto' && <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} />}
        <color attach="background" args={['#0d1420']} />
        <fog attach="fog" args={['#0d1420', 40, 85]} />
        <hemisphereLight args={['#dfefff', '#2a3a2a', 0.65]} />
        <directionalLight
          position={[6, 18, -10]}
          intensity={1.4}
          castShadow={!low}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <OrbitControls makeDefault target={initial.target} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={60} />
        <CameraRig plan={plan} view={view} />
        <Court surface={plan.scenario.surface} />
        <Opponent launch={plan.incoming.initial.pos} clock={clock} />
        <Athlete motion={plan.motion} clock={clock} shadows={!low} />
        {layers.ghost && ghost && ghost.contact.made && <Athlete motion={ghost.motion} clock={clock} fixedTime={ghost.contact.t} ghost />}
        <Ball plan={plan} clock={clock} />
        <Overlays plan={plan} layers={layers} markers={markers} hideReply={hideAnswer} />
      </Canvas>
      {label && <div className="stage-label">{label}</div>}
    </div>
  );
}
