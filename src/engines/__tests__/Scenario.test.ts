import { describe, expect, it, vi } from 'vitest';
import { PRESETS, simulateRally } from '../rally';
import { Scenario } from '../Scenario';

const make = () => new Scenario(simulateRally(PRESETS[0].config));

describe('Scenario', () => {
  it('does not advance while paused', () => {
    const s = make();
    s.update(0.5);
    expect(s.time).toBe(0);
  });

  it('advances by delta * rate while playing', () => {
    const s = make();
    s.rate = 0.25;
    s.play();
    s.update(0.4);
    expect(s.time).toBeCloseTo(0.1);
  });

  it('step works while paused, pauses playback and clamps', () => {
    const s = make();
    s.play();
    s.step(0.05);
    expect(s.playing).toBe(false);
    expect(s.time).toBeCloseTo(0.05);
    s.step(-1);
    expect(s.time).toBe(0);
  });

  it('loops or stops at the end', () => {
    const s = make();
    s.play();
    s.update(s.duration + 0.1);
    expect(s.playing).toBe(true);
    expect(s.time).toBeCloseTo(0.1);

    s.loop = false;
    s.update(s.duration);
    expect(s.playing).toBe(false);
    expect(s.time).toBe(s.duration);
    s.play();
    expect(s.time).toBe(0);
  });

  it('notifies subscribers on discrete changes', () => {
    const s = make();
    const fn = vi.fn();
    const unsubscribe = s.subscribe(fn);
    s.play();
    s.seek(1);
    unsubscribe();
    s.pause();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('keeps time within a new, shorter rally', () => {
    const s = make();
    s.seek(s.duration);
    s.setRally(simulateRally(PRESETS.find((p) => p.id === 'return')!.config));
    expect(s.time).toBeLessThanOrEqual(s.duration);
  });
});
