/**
 * Feedback Engine: builds the answer options for a decision question,
 * judges the learner's choice against the Decision Engine's recommended and
 * acceptable variants, and produces progress records.
 *
 * It only judges choices made on screen; it never claims to have measured
 * the learner's real movement.
 */
import { COACH_RULES_VERSION, Direction, Reason, Verdict } from './decision';
import { Plan } from './plan';
import { DecisionKind, STANCES } from './scenario';

export interface QuestionOption {
  value: string;
  verdict: Verdict;
  reasons: Reason[];
}

const DIRS: Direction[] = ['forward', 'forward_right', 'right', 'back_right', 'back', 'back_left', 'left', 'forward_left'];

export function questionOptions(plan: Plan, kind: DecisionKind): QuestionOption[] {
  const d = plan.decision;
  if (kind === 'stance') {
    // Fixed order (open -> closed) so the position of a button never gives the answer away.
    return STANCES.map((st) => d.stance.options.find((o) => o.value === st)!).map((o) => ({ value: o.value, verdict: o.verdict, reasons: o.reasons }));
  }
  if (kind === 'position') return d.position.map((o) => ({ value: o.value, verdict: o.verdict, reasons: o.reasons }));
  if (kind === 'prep_timing') return d.prep.options.map((o) => ({ value: o.value, verdict: o.verdict, reasons: o.reasons }));

  // first_step: the correct direction(s) plus clearly different distractors.
  const known = new Map(d.firstStep.options.map((o) => [o.value as string, o]));
  const main = d.firstStep.dir;
  const values = new Set<string>(known.keys());
  if (main === 'stay') ['left', 'right', 'back'].forEach((v) => values.add(v));
  else {
    const i = DIRS.indexOf(main);
    [DIRS[(i + 4) % 8], DIRS[(i + 2) % 8], DIRS[(i + 6) % 8], 'stay'].forEach((v) => values.size < 4 && values.add(v));
  }
  const opts = [...values].map((value) => {
    const k = known.get(value);
    return k
      ? { value, verdict: k.verdict, reasons: k.reasons }
      : { value, verdict: 'not_recommended' as Verdict, reasons: [{ key: 'reason.step.wrong', params: { correct: main } }] };
  });
  // Stable, direction-ordered presentation (does not reveal the answer by position).
  const order = ['forward_left', 'forward', 'forward_right', 'left', 'stay', 'right', 'back_left', 'back', 'back_right'];
  return opts.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
}

export interface Judgement {
  kind: DecisionKind;
  value: string;
  verdict: Verdict;
  recommended: string;
  acceptable: string[];
  reasons: Reason[];
  errorType: DecisionKind | null;
}

export function judge(plan: Plan, kind: DecisionKind, value: string): Judgement {
  const options = questionOptions(plan, kind);
  const chosen = options.find((o) => o.value === value);
  const recommended = options.find((o) => o.verdict === 'recommended')!;
  const verdict = chosen?.verdict ?? 'not_recommended';
  return {
    kind,
    value,
    verdict,
    recommended: recommended.value,
    acceptable: options.filter((o) => o.verdict === 'acceptable').map((o) => o.value),
    reasons: [...(chosen?.reasons ?? []), ...(verdict === 'recommended' ? [] : recommended.reasons)],
    errorType: verdict === 'not_recommended' ? kind : null,
  };
}

export interface AttemptRecord {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  at: string;
  ruleVersion: string;
  handedness: string;
  level: string;
  results: { kind: DecisionKind; value: string; verdict: Verdict; errorType: DecisionKind | null }[];
}

export function makeAttempt(plan: Plan, judgements: Judgement[], now = new Date()): AttemptRecord {
  return {
    id: `${plan.scenario.id}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    scenarioId: plan.scenario.id,
    scenarioVersion: plan.scenario.version,
    at: now.toISOString(),
    ruleVersion: COACH_RULES_VERSION,
    handedness: plan.profile.handedness,
    level: plan.profile.level,
    results: judgements.map((j) => ({ kind: j.kind, value: j.value, verdict: j.verdict, errorType: j.errorType })),
  };
}

export interface ProgressSummary {
  attempts: number;
  answers: number;
  correct: number;
  acceptable: number;
  wrong: number;
  errorsByType: Partial<Record<DecisionKind, number>>;
  perScenario: Record<string, { attempts: number; lastAt: string; lastAllGood: boolean; bestAllGood: boolean }>;
}

export function summarize(records: AttemptRecord[]): ProgressSummary {
  const s: ProgressSummary = { attempts: records.length, answers: 0, correct: 0, acceptable: 0, wrong: 0, errorsByType: {}, perScenario: {} };
  for (const r of records) {
    let allGood = true;
    for (const x of r.results) {
      s.answers++;
      if (x.verdict === 'recommended') s.correct++;
      else if (x.verdict === 'acceptable') s.acceptable++;
      else {
        s.wrong++;
        allGood = false;
        if (x.errorType) s.errorsByType[x.errorType] = (s.errorsByType[x.errorType] ?? 0) + 1;
      }
    }
    const p = s.perScenario[r.scenarioId];
    s.perScenario[r.scenarioId] = {
      attempts: (p?.attempts ?? 0) + 1,
      lastAt: !p || r.at > p.lastAt ? r.at : p.lastAt,
      lastAllGood: !p || r.at > p.lastAt ? allGood : p.lastAllGood,
      bestAllGood: (p?.bestAllGood ?? false) || allGood,
    };
  }
  return s;
}
