/**
 * Decision Engine: from the reachable contact and the situation it builds
 * the recommended solution and acceptable alternatives (stance, first step,
 * preparation timing, contact position), each with reasons and confidence.
 *
 * Rules are data (coachRules below, versioned) so a coach can review and
 * change them without touching the engine.
 */
import { PLAYER_FORWARD, PLAYER_RIGHT } from './court';
import { Level } from './profile';
import { ContactCandidate, ReachResult, ReachStatus } from './reachability';
import { Goal, STANCES, Stance } from './scenario';
import { StrokeKind } from './technique';
import { Vec3, dot, sub } from './vector';

export type Verdict = 'recommended' | 'acceptable' | 'not_recommended';
export type Confidence = 'high' | 'medium' | 'low';

/** i18n key + parameters, rendered by the UI. */
export interface Reason {
  key: string;
  params?: Record<string, string | number>;
}

export interface Option<T> {
  value: T;
  verdict: Verdict;
  reasons: Reason[];
  score: number;
}

export interface DecisionContext {
  stroke: StrokeKind;
  goal: Goal;
  level: Level;
  status: ReachStatus;
  /** Spare time when the stance is set, s. */
  margin: number;
  /** Movement towards the ball side (+) / away (-), metres. */
  lateralMove: number;
  /** Movement towards the net (+) / back (-), metres. */
  forwardMove: number;
  contactHeight: number;
  heightM: number;
}

export interface CoachRule {
  id: string;
  when: (c: DecisionContext) => boolean;
  effects: Partial<Record<Stance, number>>;
  reason: string;
}

export const COACH_RULES_VERSION = '0.1-draft';
/** Rules are a draft until a coach signs them off (spec, stage 0). */
export const COACH_RULES_APPROVED = false;

const BASE: Record<StrokeKind, Record<Stance, number>> = {
  forehand: { open: 1.5, semi_open: 2, neutral: 1.5, closed: 0.5 },
  backhand_2h: { open: 1, semi_open: 1.3, neutral: 2, closed: 1.5 },
  backhand_1h: { open: 0.3, semi_open: 0.8, neutral: 1.8, closed: 2 },
};

export const coachRules: CoachRule[] = [
  {
    id: 'rushed',
    when: (c) => c.margin < 0.15 || c.status !== 'ok',
    effects: { open: 1.6, semi_open: 0.5, neutral: -0.6, closed: -1.6 },
    reason: 'reason.rushed',
  },
  {
    id: 'wide',
    when: (c) => c.lateralMove > 2,
    effects: { open: 1, semi_open: 0.3, closed: -0.5 },
    reason: 'reason.wide',
  },
  {
    id: 'forward',
    when: (c) => c.forwardMove > 1,
    effects: { neutral: 1.2, closed: 0.5, open: -0.6 },
    reason: 'reason.forward',
  },
  {
    id: 'backward',
    when: (c) => c.forwardMove < -1,
    effects: { open: 1, semi_open: 0.5, neutral: -0.5, closed: -0.8 },
    reason: 'reason.backward',
  },
  {
    id: 'body',
    when: (c) => c.lateralMove < -0.3,
    effects: { semi_open: 0.6, open: 0.4, closed: -0.4 },
    reason: 'reason.body',
  },
  {
    id: 'high',
    when: (c) => c.contactHeight > 1.3 * (c.heightM / 1.75),
    effects: { open: 0.7, semi_open: 0.5 },
    reason: 'reason.high',
  },
  {
    id: 'low',
    when: (c) => c.contactHeight < 0.6 * (c.heightM / 1.75),
    effects: { neutral: 0.5, closed: 0.3 },
    reason: 'reason.low',
  },
  { id: 'attack', when: (c) => c.goal === 'attacking', effects: { neutral: 0.6, semi_open: 0.3 }, reason: 'reason.attack' },
  { id: 'defend', when: (c) => c.goal === 'defensive', effects: { open: 0.7, closed: -0.3 }, reason: 'reason.defend' },
  { id: 'beginner', when: (c) => c.level === 'beginner', effects: { neutral: 0.4, closed: -0.3 }, reason: 'reason.beginner' },
];

const ACCEPT_GAP = 1.0;

function verdicts<T>(scored: { value: T; score: number; reasons: Reason[] }[]): { options: Option<T>[]; confidence: Confidence } {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted[0].score;
  const gap = sorted.length > 1 ? top - sorted[1].score : Infinity;
  const options = sorted.map((o, i) => ({
    ...o,
    verdict: (i === 0 ? 'recommended' : top - o.score <= ACCEPT_GAP ? 'acceptable' : 'not_recommended') as Verdict,
  }));
  return { options, confidence: gap >= 1 ? 'high' : gap >= 0.4 ? 'medium' : 'low' };
}

export function decideStance(ctx: DecisionContext) {
  const fired = coachRules.filter((r) => r.when(ctx));
  const scored = STANCES.map((st) => {
    let score = BASE[ctx.stroke][st];
    const reasons: Reason[] = [];
    for (const r of fired) {
      const e = r.effects[st];
      if (!e) continue;
      score += e;
      reasons.push({ key: `${r.reason}.${e > 0 ? 'pro' : 'con'}` });
    }
    if (reasons.length === 0) reasons.push({ key: `reason.base.${ctx.stroke}` });
    return { value: st, score, reasons };
  });
  return { ...verdicts(scored), firedRules: fired.map((r) => r.id) };
}

export type Direction =
  | 'stay'
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'forward_left'
  | 'forward_right'
  | 'back_left'
  | 'back_right';

const SECTORS: Direction[] = ['forward', 'forward_right', 'right', 'back_right', 'back', 'back_left', 'left', 'forward_left'];

/** Direction of a move in the player's own view (right = player's right). */
export function classifyDirection(from: Vec3, to: Vec3) {
  const d = sub(to, from);
  const right = dot(d, PLAYER_RIGHT);
  const fwd = dot(d, PLAYER_FORWARD);
  const dist = Math.hypot(right, fwd);
  if (dist < 0.35) return { dir: 'stay' as Direction, angle: 0, dist, nearBoundary: false };
  const angle = (Math.atan2(right, fwd) * 180) / Math.PI; // 0 = forward, 90 = right
  const idx = ((Math.round(angle / 45) % 8) + 8) % 8;
  const rel = angle / 45 - Math.round(angle / 45);
  return { dir: SECTORS[idx], angle, dist, nearBoundary: Math.abs(rel) > 0.36 };
}

export function decideFirstStep(start: Vec3, hit: Vec3) {
  const c = classifyDirection(start, hit);
  const options: Option<Direction>[] = [
    { value: c.dir, verdict: 'recommended', score: 1, reasons: [{ key: 'reason.step.main', params: { dist: c.dist.toFixed(1) } }] },
  ];
  if (c.nearBoundary && c.dir !== 'stay') {
    const idx = SECTORS.indexOf(c.dir);
    const rel = c.angle / 45 - Math.round(c.angle / 45);
    const neighbour = SECTORS[(idx + (rel > 0 ? 1 : 7)) % 8];
    options.push({ value: neighbour, verdict: 'acceptable', score: 0.5, reasons: [{ key: 'reason.step.neighbour' }] });
  }
  return { ...c, options };
}

export type PrepTiming = 'on_read' | 'ball_over_net' | 'after_bounce';
export const UNIT_TURN_DURATION = 0.3;

export function decidePrepTiming(times: { read: number; net: number; bounce: number; contact: number }, forwardSwing: number) {
  const latestTurnEnd = times.contact - forwardSwing - 0.1;
  const slackOf = (start: number) => latestTurnEnd - (start + UNIT_TURN_DURATION);
  const starts: Record<PrepTiming, number> = { on_read: times.read, ball_over_net: times.net, after_bounce: times.bounce };
  const options: Option<PrepTiming>[] = (Object.keys(starts) as PrepTiming[]).map((k) => {
    const slack = slackOf(starts[k]);
    if (k === 'on_read') {
      return { value: k, verdict: 'recommended', score: 1, reasons: [{ key: 'reason.prep.early', params: { before: (times.contact - starts[k]).toFixed(2) } }] };
    }
    return slack >= 0.15
      ? { value: k, verdict: 'acceptable', score: 0.5, reasons: [{ key: 'reason.prep.ok_slow', params: { slack: slack.toFixed(2) } }] }
      : { value: k, verdict: 'not_recommended', score: 0, reasons: [{ key: 'reason.prep.late', params: { slack: slack.toFixed(2) } }] };
  });
  return { options, slack: slackOf(times.read), starts };
}

export type PositionChoice = 'early' | 'main' | 'late';

export function decidePosition(reach: ReachResult) {
  const best = reach.best;
  const others = reach.candidates;
  const nearest = (t: number) => others.reduce((b, c) => (Math.abs(c.t - t) < Math.abs(b.t - t) ? c : b), best);
  const early = nearest(best.t - 0.22);
  const late = nearest(best.t + 0.3);
  const judge = (value: PositionChoice, c: ContactCandidate): Option<PositionChoice> & { candidate: ContactCandidate } => {
    if (value === 'main') return { value, candidate: c, score: c.score, verdict: 'recommended', reasons: [{ key: 'reason.pos.main' }] };
    if (c.margin < 0) return { value, candidate: c, score: c.score, verdict: 'not_recommended', reasons: [{ key: 'reason.pos.late', params: { late: (-c.margin).toFixed(2) } }] };
    const acceptable = best.score - c.score <= ACCEPT_GAP;
    return {
      value,
      candidate: c,
      score: c.score,
      verdict: acceptable ? 'acceptable' : 'not_recommended',
      reasons: [{ key: value === 'early' ? 'reason.pos.early' : 'reason.pos.deep', params: { h: c.pos.y.toFixed(2) } }],
    };
  };
  return [judge('early', early), judge('main', best), judge('late', late)];
}
