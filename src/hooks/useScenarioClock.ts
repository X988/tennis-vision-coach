import { useEffect, useState } from 'react';
import { Scenario } from '../engines/Scenario';

export interface ClockSnapshot {
  time: number;
  playing: boolean;
}

/**
 * Mirrors the scenario clock into React state for the HTML UI.
 * The 3D scene reads the scenario directly every frame; the UI only needs
 * ~30 updates per second, rounded to centiseconds.
 */
export function useScenarioClock(scenario: Scenario): ClockSnapshot {
  const [snap, setSnap] = useState<ClockSnapshot>({ time: scenario.time, playing: scenario.playing });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const time = Math.round(scenario.time * 100) / 100;
      const playing = scenario.playing;
      setSnap((prev) => (prev.time === time && prev.playing === playing ? prev : { time, playing }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scenario]);

  return snap;
}
