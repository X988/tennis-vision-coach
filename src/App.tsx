import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Scenario } from './engines/Scenario';
import { PRESETS, ScenarioConfig, simulateRally } from './engines/rally';
import { Court } from './components/Court';
import { Ball } from './components/Ball';
import { Player } from './components/Player';
import { TrajectoryOverlay } from './components/TrajectoryOverlay';
import { CameraRig } from './components/CameraRig';
import { CAMERA_PRESETS, CameraPreset, RATES, STEP } from './components/uiConstants';
import { SimDriver } from './components/SimDriver';
import { ControlPanel } from './components/ui/ControlPanel';
import { PlaybackBar } from './components/ui/PlaybackBar';
import { useScenarioClock } from './hooks/useScenarioClock';

const DEFAULT_PRESET = PRESETS[0];

export default function App() {
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  const [config, setConfig] = useState<ScenarioConfig>(DEFAULT_PRESET.config);
  const [camera, setCamera] = useState<CameraPreset>('broadcast');
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);

  const rally = useMemo(() => simulateRally(config), [config]);
  const [scenario] = useState(() => new Scenario(rally));
  const clock = useScenarioClock(scenario);

  useEffect(() => scenario.setRally(rally), [scenario, rally]);
  useEffect(() => {
    scenario.rate = rate;
    scenario.loop = loop;
  }, [scenario, rate, loop]);

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
    scenario.reset();
  };

  const editConfig = (next: ScenarioConfig) => {
    setPresetId(null);
    setConfig(next);
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) && e.key !== ' ') return;
      const cam = CAMERA_PRESETS.find((c) => c.key === e.key);
      if (cam) setCamera(cam.id);
      else if (e.key === ' ') scenario.toggle();
      else if (e.key === 'ArrowRight') scenario.step(STEP);
      else if (e.key === 'ArrowLeft') scenario.step(-STEP);
      else if (e.key === 'r' || e.key === 'R') scenario.reset();
      else if (e.key === 'c' || e.key === 'C') scenario.step(rally.contact.t - scenario.time);
      else if (e.key === '+' || e.key === '=') setRate((r) => RATES[Math.min(RATES.indexOf(r) + 1, RATES.length - 1)]);
      else if (e.key === '-') setRate((r) => RATES[Math.max(RATES.indexOf(r) - 1, 0)]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenario, rally]);

  return (
    <div className="app">
      <Canvas shadows camera={{ position: [0, 9, -27], fov: 45, near: 0.05, far: 200 }} className="scene">
        <color attach="background" args={['#0d1420']} />
        <fog attach="fog" args={['#0d1420', 45, 90]} />
        <hemisphereLight args={['#dfefff', '#2a3a2a', 0.6]} />
        <directionalLight
          position={[8, 20, -6]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
        />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1} maxDistance={70} />
        <CameraRig preset={camera} scenario={scenario} />
        <SimDriver scenario={scenario} />
        <Court surface={config.surface} />
        <Player scenario={scenario} />
        <Ball scenario={scenario} />
        {showTrajectory && <TrajectoryOverlay rally={rally} />}
      </Canvas>

      <ControlPanel
        presetId={presetId}
        config={config}
        rally={rally}
        showTrajectory={showTrajectory}
        onPreset={choosePreset}
        onConfig={editConfig}
        onShowTrajectory={setShowTrajectory}
      />
      <PlaybackBar
        scenario={scenario}
        rally={rally}
        clock={clock}
        rate={rate}
        loop={loop}
        camera={camera}
        onRate={setRate}
        onLoop={setLoop}
        onCamera={setCamera}
      />
    </div>
  );
}
