import { describe, expect, it } from 'vitest';
import { solveIncoming } from '../ball';
import { SURFACES } from '../physics';
import { vec } from '../vector';

const base = { launch: vec(0, 1, 12.2), bounce: { x: -2, z: -9 }, surface: SURFACES.hard };

describe('Ball Engine', () => {
  it('lands on the bounce point with the requested speed before the bounce', () => {
    const r = solveIncoming({ ...base, arrivalKmh: 70, spin: 'topspin' });
    const b = r.flight.bounces[0];
    expect(Math.hypot(b.pos.x + 2, b.pos.z + 9)).toBeLessThan(0.05);
    expect(r.arrivalSpeedKmh).toBeCloseTo(70, 0);
    expect(r.launchSpeedKmh).toBeGreaterThan(70);
    expect(r.matched).toBe(true);
  });

  it('matches a feasible apex by adjusting the spin rate', () => {
    const r = solveIncoming({ ...base, arrivalKmh: 70, spin: 'topspin', apexM: 2.2 });
    expect(r.matched).toBe(true);
    expect(r.apex).toBeCloseTo(2.2, 1);
  });

  it('flags an impossible apex instead of silently ignoring it', () => {
    const r = solveIncoming({ ...base, arrivalKmh: 70, spin: 'topspin', apexM: 7 });
    expect(r.matched).toBe(false);
  });

  it('keeps flying after the bounce (second bounce or out of the court)', () => {
    const r = solveIncoming({ ...base, arrivalKmh: 60, spin: 'slice' });
    expect(r.flight.duration).toBeGreaterThan(r.flight.bounces[0].t + 0.3);
  });
});
