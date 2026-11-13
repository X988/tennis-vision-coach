import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../content/library';
import { judge, makeAttempt, questionOptions, summarize } from '../feedback';
import { buildPlan } from '../plan';
import { DEFAULT_PROFILE } from '../profile';
import { DECISIONS } from '../scenario';

const plan = buildPlan(LIBRARY.scenarios.find((s) => s.id === 'FH_MEDIUM_NEUTRAL_01')!, DEFAULT_PROFILE);

describe('Feedback Engine', () => {
  it.each(DECISIONS)('%s question has one recommended option among several', (kind) => {
    const opts = questionOptions(plan, kind);
    expect(opts.length).toBeGreaterThanOrEqual(3);
    expect(opts.filter((o) => o.verdict === 'recommended')).toHaveLength(1);
  });

  it('presents stances in a fixed order that does not reveal the answer', () => {
    expect(questionOptions(plan, 'stance').map((o) => o.value)).toEqual(['open', 'semi_open', 'neutral', 'closed']);
  });

  it('judges correct and wrong answers and explains', () => {
    const opts = questionOptions(plan, 'stance');
    const good = judge(plan, 'stance', opts.find((o) => o.verdict === 'recommended')!.value);
    expect(good.verdict).toBe('recommended');
    expect(good.errorType).toBeNull();
    const badOpt = opts.find((o) => o.verdict === 'not_recommended');
    if (badOpt) {
      const bad = judge(plan, 'stance', badOpt.value);
      expect(bad.errorType).toBe('stance');
      expect(bad.reasons.length).toBeGreaterThan(0);
    }
  });

  it('summarizes progress with attempts and error types', () => {
    const a = makeAttempt(plan, [judge(plan, 'stance', 'closed'), judge(plan, 'first_step', plan.decision.firstStep.dir)], new Date('2026-11-01'));
    const b = makeAttempt(plan, [judge(plan, 'stance', plan.stance)], new Date('2026-11-02'));
    const s = summarize([a, b]);
    expect(s.attempts).toBe(2);
    expect(s.perScenario[plan.scenario.id].attempts).toBe(2);
    expect(s.perScenario[plan.scenario.id].lastAllGood).toBe(true);
    expect(s.correct).toBeGreaterThanOrEqual(2);
  });
});
