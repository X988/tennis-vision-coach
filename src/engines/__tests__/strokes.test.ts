import { describe, expect, it } from 'vitest';
import { STROKES, contactPitch, contactPose, poseAt, racketCenter, swingPhase } from '../strokes';

describe('strokes', () => {
  it.each(Object.values(STROKES))('$id has a contact keyframe and ordered phases', (stroke) => {
    expect(stroke.keyframes.some((k) => k.phase === stroke.contactPhase)).toBe(true);
    const phases = stroke.keyframes.map((k) => k.phase);
    expect([...phases].sort((a, b) => a - b)).toEqual(phases);
    expect(phases[0]).toBe(0);
    expect(phases[phases.length - 1]).toBe(1);
  });

  it.each([0.5, 0.9, 1.3])('contact pose puts the racket at the requested height (%s m)', (h) => {
    expect(racketCenter(contactPose(STROKES.forehand, h)).y).toBeCloseTo(h, 5);
  });

  it('forehand contact is on the right (-x) and in front, backhand on the left', () => {
    const fh = racketCenter(contactPose(STROKES.forehand, 1));
    const bh = racketCenter(contactPose(STROKES.backhand, 1));
    expect(fh.x).toBeLessThan(0);
    expect(fh.z).toBeGreaterThan(0);
    expect(bh.x).toBeGreaterThan(0);
    expect(bh.z).toBeGreaterThan(0);
  });

  it('poseAt returns the contact pose exactly at the contact phase', () => {
    const stroke = STROKES.slice;
    const cp = contactPose(stroke, 0.8);
    const p = poseAt(stroke, stroke.contactPhase, cp);
    expect(p.torsoYaw).toBeCloseTo(cp.torsoYaw, 12);
    expect(p.armYaw).toBeCloseTo(cp.armYaw, 12);
    expect(p.armPitch).toBeCloseTo(cp.armPitch, 12);
  });

  it('swingPhase hits contactPhase at contact time and is clamped', () => {
    const s = STROKES.forehand;
    expect(swingPhase(s, 1.4, 1.4)).toBeCloseTo(s.contactPhase);
    expect(swingPhase(s, -10, 1.4)).toBe(0);
    expect(swingPhase(s, 10, 1.4)).toBe(1);
  });

  it('contactPitch is clamped for unreachable heights', () => {
    expect(Number.isFinite(contactPitch(10))).toBe(true);
    expect(Number.isFinite(contactPitch(-10))).toBe(true);
  });
});
