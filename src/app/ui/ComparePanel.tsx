import { Plan } from '../../engines/plan';
import { useT } from '../i18n';

export function ComparePanel({ good, bad }: { good: Plan; bad: Plan }) {
  const t = useT();
  const v = bad.variant!;
  const rows: { label: string; a: string; b: string; diff: boolean }[] = [
    { label: t('analysis.status'), a: t(`status.${good.status}`), b: t(`status.${bad.status}`), diff: good.status !== bad.status },
    { label: t('analysis.stance'), a: t(`stance.${good.stance}`), b: t(`stance.${bad.stance}`), diff: good.stance !== bad.stance },
    {
      label: t('analysis.margin'),
      a: `${good.reach.best.margin.toFixed(2)} ${t('units.s')}`,
      b: `${bad.reach.best.margin.toFixed(2)} ${t('units.s')}`,
      diff: Math.abs(good.reach.best.margin - bad.reach.best.margin) > 0.02,
    },
    {
      label: t('event.contact'),
      a: `${(good.contact.t - 0.8).toFixed(2)} ${t('units.s')}`,
      b: bad.contact.made ? `${(bad.contact.t - 0.8).toFixed(2)} ${t('units.s')}` : '—',
      diff: Math.abs(good.contact.t - bad.contact.t) > 0.01 || !bad.contact.made,
    },
    {
      label: t('layers.contactZone'),
      a: good.contactZone.ok ? t('analysis.zoneOk') : t('analysis.zoneBad'),
      b: bad.contactZone.ok ? t('analysis.zoneOk') : t('analysis.zoneBad'),
      diff: good.contactZone.ok !== bad.contactZone.ok,
    },
    {
      label: t('analysis.reply'),
      a: good.reply ? (good.reply.inside ? t('analysis.replyIn') : t('analysis.replyOut')) : '—',
      b: bad.reply ? (bad.reply.inside ? t('analysis.replyIn') : t('analysis.replyOut')) : '—',
      diff: (good.reply?.inside ?? null) !== (bad.reply?.inside ?? null),
    },
  ];
  return (
    <div className="compare">
      <h3>{t('lesson.differences')}</h3>
      <p>{t(`variant.consequence.${v}`, { stance: t(`stance.${bad.stance}`) })}</p>
      <table>
        <thead>
          <tr>
            <th />
            <th className="good">{t('lesson.compareCorrect')}</th>
            <th className="bad">{t(`variant.${v}`)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.diff ? 'diff' : ''}>
              <td>{r.label}</td>
              <td>{r.a}</td>
              <td>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{t('disclaimer.coach')}</p>
    </div>
  );
}
