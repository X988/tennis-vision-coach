import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../content/library';
import { PLAYER_RIGHT } from '../court';
import { footAt, poseAt } from '../motion';
import { buildPlan } from '../plan';
import { DEFAULT_PROFILE, Profile } from '../profile';
import { CATEGORIES, ERROR_VARIANTS, STANCES } from '../scenario';
import { Vec3, dot, length, sub } from '../vector';

const profile = DEFAULT_PROFILE;
const scenarios = LIBRARY.scenarios;

/** Distance from point p to segment ab. */
function segDist(p: Vec3, a: Vec3, b: Vec3) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return length(sub(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }));
}

describe('scenario library', () => {
  it('loads 12 valid scenarios', () => {
    expect(LIBRARY.errors).toEqual([]);
    expect(scenarios).toHaveLength(12);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(12);
  });

  it('covers every required situation, both strokes and at least two cameras each', () => {
    const cats = new Set(scenarios.flatMap((s) => s.learning.categories));
    for (const c of CATEGORIES) expect(cats).toContain(c);
    expect(new Set(scenarios.map((s) => s.task.shot))).toEqual(new Set(['forehand', 'backhand']));
    expect(new Set(scenarios.map((s) => s.task.goal))).toEqual(new Set(['neutral', 'attacking', 'defensive']));
    for (const s of scenarios) expect(s.learning.cameras.length).toBeGreaterThanOrEqual(2);
  });
});

describe.each(scenarios.map((s) => [s.id, s] as const))('plan %s', (_id, scenario) => {
  const plan = buildPlan(scenario, profile);

  it('has ordered events and an incoming ball that clears the net', () => {
    const ts = plan.events.map((e) => e.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(plan.incoming.flight.netCrossing!.clearance).toBeGreaterThan(0);
    expect(plan.warnings.filter((w) => w.key === 'warn.ball_net')).toEqual([]);
  });

  it('racket head meets the ball exactly at contact (when reachable)', () => {
    if (!plan.contact.made) return;
    const j = poseAt(plan.motion, plan.contact.t);
    expect(length(sub(j.racket.head, plan.contact.pos))).toBeLessThan(0.01);
  });

  it('planted feet never slide and legs reach them', () => {
    for (const plants of [plan.motion.feet.left, plan.motion.feet.right]) {
      for (const p of plants) {
        const a = Math.max(0, p.start);
        const b = Math.min(plan.duration, p.end);
        if (b <= a) continue;
        for (const t of [a, (a + b) / 2, b]) {
          const f = footAt(plants, t, 0.12);
          expect(length(sub(f.pos, p.pos))).toBeLessThan(1e-9);
        }
      }
    }
    for (let t = 0; t <= plan.duration; t += 0.05) {
      const j = poseAt(plan.motion, t);
      const l = footAt(plan.motion.feet.left, t, 0.12);
      if (l.planted) expect(Math.hypot(j.ankle.left.x - l.pos.x, j.ankle.left.z - l.pos.z)).toBeLessThan(0.03);
      const r = footAt(plan.motion.feet.right, t, 0.12);
      if (r.planted) expect(Math.hypot(j.ankle.right.x - r.pos.x, j.ankle.right.z - r.pos.z)).toBeLessThan(0.03);
    }
  });

  it('racket head never passes through the torso', () => {
    for (let t = 0; t <= plan.duration; t += 0.02) {
      const j = poseAt(plan.motion, t);
      expect(segDist(j.racket.head, j.pelvis, j.neck)).toBeGreaterThan(0.15);
    }
  });

  it('every error variant changes the outcome', () => {
    for (const v of ERROR_VARIANTS) {
      // Swing timing / spacing cannot change a ball that is not reached at all.
      if (plan.status === 'unreachable' && (v === 'late_prep' || v === 'too_close')) continue;
      const q = buildPlan(scenario, profile, { variant: v });
      const changed =
        q.status !== plan.status ||
        Math.abs(q.contact.t - plan.contact.t) > 0.005 ||
        q.contactZone.ok !== plan.contactZone.ok ||
        q.stance !== plan.stance ||
        length(sub(q.hit, plan.hit)) > 0.05;
      expect(changed, v).toBe(true);
    }
  });
});

describe('plan invariants', () => {
  const s = scenarios.find((x) => x.id === 'FH_MEDIUM_NEUTRAL_01')!;

  it('recomputes contact time, position and stance when the ball changes', () => {
    const a = buildPlan(s, profile);
    const b = buildPlan({ ...s, incomingBall: { ...s.incomingBall, bounce: { x: 2.6, y: -9.5 }, speedKmh: 80 } }, profile);
    expect(Math.abs(a.contact.t - b.contact.t)).toBeGreaterThan(0.02);
    expect(length(sub(a.hit, b.hit))).toBeGreaterThan(0.3);
  });

  it('all four stances put the feet in different places', () => {
    const lastPlants = STANCES.map((st) => {
      const p = buildPlan(s, profile, { stance: st });
      const at = p.contact.t;
      return [footAt(p.motion.feet.left, at, 0.12).pos, footAt(p.motion.feet.right, at, 0.12).pos];
    });
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const d = length(sub(lastPlants[i][0], lastPlants[j][0])) + length(sub(lastPlants[i][1], lastPlants[j][1]));
        expect(d).toBeGreaterThan(0.1);
      }
  });

  it('mirrors correctly for a left-handed player', () => {
    const lefty: Profile = { ...profile, handedness: 'left' };
    const r = buildPlan(s, profile);
    const l = buildPlan(s, lefty);
    // Right-hander's forehand is on their right, left-hander's on their left.
    expect(dot(r.contact.pos, PLAYER_RIGHT)).toBeGreaterThan(0);
    expect(dot(l.contact.pos, PLAYER_RIGHT)).toBeLessThan(0);
    expect(l.contact.t).toBeCloseTo(r.contact.t, 2);
    expect(l.stance).toBe(r.stance);
    const jl = poseAt(l.motion, l.contact.t);
    // The racket is held in the left hand.
    expect(length(sub(jl.wrist.left, jl.racket.grip))).toBeLessThan(0.01);
  });

  it('an advanced player reaches what a beginner cannot', () => {
    const wide = scenarios.find((x) => x.id === 'BH_WIDE_01')!;
    const beg = buildPlan(wide, { ...profile, level: 'beginner' });
    const adv = buildPlan(wide, { ...profile, level: 'advanced' });
    expect(adv.reach.best.margin).toBeGreaterThan(beg.reach.best.margin);
  });

  it('an unreachable ball is reported, not teleported to', () => {
    const p = buildPlan(scenarios.find((x) => x.id === 'FH_WIDE_FAST_01')!, profile);
    expect(p.status).toBe('unreachable');
    expect(p.warnings.some((w) => w.key === 'warn.unreachable')).toBe(true);
    // At the moment the ball passes the player is still running.
    const j = poseAt(p.motion, p.reach.best.t);
    expect(length(sub({ ...j.pelvis, y: 0 }, p.hit))).toBeGreaterThan(0.2);
  });
});
