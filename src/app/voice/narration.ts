/** What the voice says. Pure functions: easy to test, no audio here. */
import { Judgement } from '../../engines/feedback';
import { Phase, PhaseId, Plan } from '../../engines/plan';
import { optionLabel } from '../format';
import { T, reasonText } from '../i18n';

/** How long "contact" stays the narrated phase: on the timeline it is only an instant. */
const CONTACT_HOLD = 0.2;

/**
 * The phase the voice talks about at time t: the one that started most
 * recently. The contact is held for a moment so it is never skipped; the
 * closing "feedback" phase is not narrated.
 */
export function primaryPhase(plan: Pick<Plan, 'phases'>, t: number): Phase | null {
  const contact = plan.phases.find((p) => p.id === 'contact');
  let best: Phase | null = null;
  let bestStart = -Infinity;
  for (const p of plan.phases) {
    if (p.id === 'feedback') continue;
    const start = p.id === 'follow_through' && contact ? Math.max(p.start, contact.start + CONTACT_HOLD) : p.start;
    // On a tie the phase listed first wins: the unit turn starts together with the movement and is the one to name.
    if (start > t + 1e-6 || start <= bestStart) continue;
    best = p;
    bestStart = start;
  }
  return best;
}

/** At normal speed phases follow each other within tenths of a second: only the key ones are named. */
const KEY_PHASES: PhaseId[] = ['split_step', 'read_turn', 'footwork', 'contact', 'recovery'];

/**
 * Phase narration: while playing — a short name (all phases in slow motion,
 * only key ones at normal speed); while paused (stepping through phases,
 * tapping the phase list) — the name with its explanation.
 */
export function phaseCue(t: T, phase: PhaseId, playing: boolean, rate: number): string | null {
  if (!playing) return `${t(`phase.${phase}.name`)}. ${t(`phase.${phase}.desc`)}`;
  if (rate >= 0.5 && !KEY_PHASES.includes(phase)) return null;
  return t(`voice.phase.${phase}`);
}

export function questionCue(t: T, kind: Judgement['kind'], n: number, total: number): string {
  return `${t('lesson.question', { n, total })}. ${t(`q.${kind}`)}`;
}

export function resultCue(t: T, results: Judgement[]): string {
  return results
    .map((j) => {
      const parts = [`${t(`q.${j.kind}`)} ${t('voice.yourAnswer')}: ${optionLabel(t, j.kind, j.value)}, ${t(`verdict.${j.verdict}`).toLowerCase()}.`];
      if (j.verdict !== 'recommended') parts.push(`${t('lesson.recommendedIs', { value: optionLabel(t, j.kind, j.recommended) })}.`);
      // One reason is enough by ear; the full list stays on screen.
      const reason = j.reasons[j.verdict === 'recommended' ? 0 : j.reasons.length - 1];
      if (reason) parts.push(reasonText(t, reason));
      return parts.join(' ');
    })
    .join(' ');
}

export function compareCue(t: T, bad: Plan): string {
  const v = bad.variant!;
  return `${t('lesson.modeCompare')}. ${t('lesson.compareWrong', { name: t(`variant.${v}`) })}. ${t(`variant.consequence.${v}`, { stance: t(`stance.${bad.stance}`) })}`;
}

export function tourCue(t: T, stepId: string): string {
  return `${t(`tour.${stepId}.title`)}. ${t(`tour.${stepId}.text`)}`;
}
