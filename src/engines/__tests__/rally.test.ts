import { describe, expect, it } from 'vitest';
import { PRESETS, ballPositionAt, playerStateAt, simulateRally } from '../rally';
import { racketCenter } from '../strokes';
import { add, length, sub } from '../vector';

describe.each(PRESETS)('preset $id', ({ config }) => {
  const rally = simulateRally(config);

  it('has no warnings and both shots land in', () => {
    expect(rally.warnings).toEqual([]);
    expect(rally.incoming.inside).toBe(true);
    expect(rally.outgoing.inside).toBe(true);
  });

  it('both shots clear the net', () => {
    expect(rally.incoming.netCrossing!.clearance).toBeGreaterThan(0);
    expect(rally.outgoing.netCrossing!.clearance).toBeGreaterThan(0);
  });

  it('racket meets the ball at the contact time', () => {
    const { position, pose } = playerStateAt(rally, rally.contact.t);
    const racket = add(position, racketCenter(pose));
    const ball = ballPositionAt(rally, rally.contact.t);
    expect(length(sub(racket, ball))).toBeLessThan(0.01);
  });

  it('ball trajectory is continuous through the contact', () => {
    const before = ballPositionAt(rally, rally.contact.t - 0.001);
    const after = ballPositionAt(rally, rally.contact.t + 0.001);
    expect(length(sub(before, after))).toBeLessThan(0.1);
  });
});

describe('simulateRally', () => {
  it('flags a reply that is too slow to reach the target', () => {
    const rally = simulateRally({
      ...PRESETS[0].config,
      outgoing: { target: { x: 0, z: 11.5 }, speedKmh: 30, spinRpm: 0 },
    });
    expect(rally.warnings.some((w) => w.includes('Reply'))).toBe(true);
  });

  it('a hard serve return happens earlier than a rally ball', () => {
    const rallyBall = simulateRally(PRESETS.find((p) => p.id === 'forehand')!.config);
    const serve = simulateRally(PRESETS.find((p) => p.id === 'return')!.config);
    expect(serve.contact.t).toBeLessThan(rallyBall.contact.t);
  });
});
