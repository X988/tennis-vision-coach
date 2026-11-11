/** Small presentation helpers shared by several screens. */
import { Plan } from '../engines/plan';
import { DecisionKind } from '../engines/scenario';
import type { T } from './i18n';

export function formatRelative(t: T, time: number, contact: number) {
  const d = time - contact;
  if (Math.abs(d) < 0.005) return t('timeline.atContact');
  return d < 0 ? t('timeline.relative', { t: (-d).toFixed(2) }) : t('timeline.after', { t: d.toFixed(2) });
}

export function currentPhases(plan: Plan, time: number) {
  return plan.phases.filter((p) => time >= p.start && time <= p.end);
}

export function optionLabel(t: T, kind: DecisionKind, value: string) {
  switch (kind) {
    case 'stance':
      return t(`stance.${value}`);
    case 'first_step':
      return t(`dir.${value}`);
    case 'prep_timing':
      return t(`prep.${value}`);
    case 'position':
      return t(`pos.${value}`);
  }
}

