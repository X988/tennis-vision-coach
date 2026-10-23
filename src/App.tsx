import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import { Scenario } from './engines/Scenario';
import { Court } from './components/Court';
import { Ball } from './components/Ball';
import { Player } from './components/Player';

export default function App() {
  const scenario = useRef(new Scenario()).current;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cam, setCam] = useState<'top' | 'side' | 'back' | 'free'>('free');

  useEffect(() => {
    scenario.speed = speed;
  }, [speed]);

  const togglePlay = () => {
    if (playing) scenario.pause();
    else scenario.play();
    setPlaying(!playing);
  };

  const handleStep = () => {
    scenario.step(0.05);
  };

  const handleBounceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const z = parseFloat(e.target.value);
    scenario.setBouncePoint(2.5, z);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseFloat(e.target.value);
    scenario.setSpeed(s);
  };

  return (
    <>
      <Canvas shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        {cam === 'top' && <PerspectiveCamera makeDefault position={[0, 25, 0]} fov={50} />}
        {cam === 'side' && <PerspectiveCamera makeDefault position={[15, 5, 0]} fov={50} />}
        {cam === 'back' && <PerspectiveCamera makeDefault position={[0, 4, -18]} fov={50} />}
        {cam === 'free' && <OrbitControls makeDefault />}
        <Court />
        <Ball scenario={scenario} />
        <Player scenario={scenario} />
        <gridHelper args={[40, 40]} position={[0, 0, 0]} />
      </Canvas>
      <div className="controls">
        <button onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
        <button onClick={handleStep}>Step</button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={0.25}>0.25x</option>
          <option value={1}>1x</option>
        </select>
        <div>
          Cam: 
          <button onClick={() => setCam('top')}>Top</button>
          <button onClick={() => setCam('side')}>Side</button>
          <button onClick={() => setCam('back')}>Back</button>
          <button onClick={() => setCam('free')}>Free</button>
        </div>
        <div>
          Bounce Z: <input type="range" min={-12} max={0} step={0.1} defaultValue={-8} onChange={handleBounceChange} />
        </div>
        <div>
          Ball speed: <input type="range" min={5} max={30} step={1} defaultValue={15} onChange={handleSpeedChange} />
        </div>
      </div>
    </>
  );
}
