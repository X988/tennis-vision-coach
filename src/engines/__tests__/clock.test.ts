import { describe, expect, it, vi } from 'vitest';
import { SimulationClock } from '../clock';

describe('SimulationClock', () => {
  it('advances by delta * rate only while playing', () => {
    const c = new SimulationClock(3);
    c.update(1);
    expect(c.time).toBe(0);
    c.rate = 0.25;
    c.play();
    c.update(0.4);
    expect(c.time).toBeCloseTo(0.1);
  });

  it('steps frame by frame while paused and clamps', () => {
    const c = new SimulationClock(1);
    c.step(0.5);
    c.step(-2);
    expect(c.time).toBe(0);
    expect(c.playing).toBe(false);
  });

  it('jumps between phase boundaries', () => {
    const c = new SimulationClock(5);
    const marks = [{ id: 'contact' as const, t: 2 }, { id: 'bounce' as const, t: 1 }];
    c.jump(marks, 1);
    expect(c.time).toBe(1);
    c.jump(marks, 1);
    expect(c.time).toBe(2);
    c.jump(marks, -1);
    expect(c.time).toBe(1);
  });

  it('stops at the end unless looping and notifies listeners', () => {
    const c = new SimulationClock(1);
    const fn = vi.fn();
    c.subscribe(fn);
    c.play();
    c.update(2);
    expect(c.playing).toBe(false);
    expect(c.time).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
