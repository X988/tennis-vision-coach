import { useEffect, useMemo, useState } from 'react';
import { SimulationClock } from '../engines/clock';
import { Plan, PlanOptions, buildPlan } from '../engines/plan';
import { Profile } from '../engines/profile';
import { ScenarioSpec } from '../engines/scenario';

/** One clock per screen; advanced once per animation frame regardless of how many 3D views read it. */
export function useClock(duration: number, rate: number) {
  const [clock] = useState(() => new SimulationClock(duration));
  useEffect(() => clock.setDuration(duration), [clock, duration]);
  useEffect(() => {
    clock.rate = rate;
  }, [clock, rate]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.update(Math.min(0.1, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return clock;
}

/** React-side snapshot of the clock (~30 Hz) for the HTML UI. */
export function useClockState(clock: SimulationClock) {
  const [snap, setSnap] = useState({ time: clock.time, playing: clock.playing });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const time = Math.round(clock.time * 100) / 100;
      setSnap((p) => (p.time === time && p.playing === clock.playing ? p : { time, playing: clock.playing }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return snap;
}

export function usePlan(scenario: ScenarioSpec | null, profile: Profile, opts: PlanOptions = {}): Plan | null {
  const { variant = null, stance = null } = opts;
  return useMemo(() => (scenario ? buildPlan(scenario, profile, { variant, stance }) : null), [scenario, profile, variant, stance]);
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
