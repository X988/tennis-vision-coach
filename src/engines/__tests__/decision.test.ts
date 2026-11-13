import { describe, expect, it } from 'vitest';
import { DecisionContext, classifyDirection, decidePrepTiming, decideStance } from '../decision';
import { PLAYER_FORWARD, PLAYER_RIGHT } from '../court';
import { addScaled, vec } from '../vector';

const ctx = (over: Partial<DecisionContext>): DecisionContext => ({
  stroke: 'forehand',
  goal: 'neutral',
  level: 'intermediate',
  status: 'ok',
  margin: 0.4,
  lateralMove: 1,
  forwardMove: 0,
  contactHeight: 1,
  heightM: 1.75,
  ...over,
});

describe('Decision Engine: stance', () => {
  it('has exactly one recommended stance and lists all four', () => {
    const d = decideStance(ctx({}));
    expect(d.options).toHaveLength(4);
    expect(d.options.filter((o) => o.verdict === 'recommended')).toHaveLength(1);
  });

  it('recommends an open stance when rushed on a wide ball', () => {
    expect(decideStance(ctx({ margin: 0.05, lateralMove: 2.5 })).options[0].value).toBe('open');
  });

  it('recommends stepping in (neutral) on a short ball for the two-handed backhand', () => {
    expect(decideStance(ctx({ stroke: 'backhand_2h', forwardMove: 2, goal: 'attacking' })).options[0].value).toBe('neutral');
  });

  it('every option has a reason to explain', () => {
    for (const o of decideStance(ctx({ goal: 'defensive' })).options) expect(o.reasons.length).toBeGreaterThan(0);
  });
});

describe('Decision Engine: first step', () => {
  const o = vec(0, 0, -12);
  it('classifies directions in the player view', () => {
    expect(classifyDirection(o, addScaled(o, PLAYER_RIGHT, 2)).dir).toBe('right');
    expect(classifyDirection(o, addScaled(o, PLAYER_RIGHT, -2)).dir).toBe('left');
    expect(classifyDirection(o, addScaled(o, PLAYER_FORWARD, 2)).dir).toBe('forward');
    expect(classifyDirection(o, addScaled(addScaled(o, PLAYER_FORWARD, -1.5), PLAYER_RIGHT, 1.5)).dir).toBe('back_right');
    expect(classifyDirection(o, addScaled(o, PLAYER_RIGHT, 0.1)).dir).toBe('stay');
  });
});

describe('Decision Engine: preparation timing', () => {
  it('early preparation is always recommended; after the bounce is late for a fast ball', () => {
    const d = decidePrepTiming({ read: 1.0, net: 1.3, bounce: 1.6, contact: 1.9 }, 0.26);
    expect(d.options.find((o) => o.value === 'on_read')!.verdict).toBe('recommended');
    expect(d.options.find((o) => o.value === 'after_bounce')!.verdict).toBe('not_recommended');
  });

  it('a slow ball leaves time to turn after it crosses the net', () => {
    const d = decidePrepTiming({ read: 1.0, net: 1.4, bounce: 2.0, contact: 2.8 }, 0.26);
    expect(d.options.find((o) => o.value === 'ball_over_net')!.verdict).toBe('acceptable');
  });
});
