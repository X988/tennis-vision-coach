import { COACH_RULES_VERSION } from '../../engines/decision';
import { Plan, T_OPPONENT } from '../../engines/plan';
import { SimulationClock } from '../../engines/clock';
import { reasonText, useT } from '../i18n';
import { StanceIcon } from './StanceIcon';
import { currentPhases, formatRelative } from '../format';

export function StatusBadge({ plan }: { plan: Plan }) {
  const t = useT();
  return <span className={`badge status-${plan.status}`}>{t(`status.${plan.status}`)}</span>;
}

export function Warnings({ plan }: { plan: Plan }) {
  const t = useT();
  if (!plan.warnings.length) return null;
  return (
    <ul className="warnings">
      {plan.warnings.map((w) => (
        <li key={w.key}>{reasonText(t, w)}</li>
      ))}
    </ul>
  );
}

export function PhaseBreakdown({ plan, time, clock }: { plan: Plan; time: number; clock: SimulationClock }) {
  const t = useT();
  const active = new Set(currentPhases(plan, time).map((p) => p.id));
  return (
    <ol className="phases" data-tour="phase-list">
      {plan.phases
        .filter((p) => p.id !== 'feedback')
        .map((p) => (
          <li key={p.id} className={active.has(p.id) ? 'active' : ''}>
            <button onClick={() => clock.step(p.start - clock.time)}>
              <span className="ph-name">{t(`phase.${p.id}.name`)}</span>
              <span className="ph-time">{formatRelative(t, p.start, plan.contact.t)}</span>
            </button>
            {active.has(p.id) && <p className="ph-desc">{t(`phase.${p.id}.desc`)}</p>}
          </li>
        ))}
    </ol>
  );
}

export function DecisionSummary({ plan }: { plan: Plan }) {
  const t = useT();
  const d = plan.decision;
  const rec = d.stance.options[0];
  const alts = d.stance.options.filter((o) => o.verdict === 'acceptable');
  const reply = plan.reply;
  const turnBefore = plan.contact.t - d.prep.starts.on_read;
  return (
    <div className="analysis" data-tour="analysis">
      <div className="row-between">
        <h3>{t('analysis.title')}</h3>
        <StatusBadge plan={plan} />
      </div>
      <Warnings plan={plan} />
      <div className="stance-rec">
        <StanceIcon stance={plan.stance} />
        <div>
          <div className="muted small">{t('analysis.stance')}</div>
          <strong>{t(`stance.${plan.stance}`)}</strong>
          <span className="muted small"> · {t(`confidence.${d.stance.confidence}`)}</span>
          <ul className="reasons">
            {rec.reasons.map((r) => (
              <li key={r.key}>{reasonText(t, r)}</li>
            ))}
          </ul>
          {alts.length > 0 && (
            <div className="small">
              {t('analysis.alternatives')}: {alts.map((a) => t(`stance.${a.value}`)).join(', ')}
            </div>
          )}
        </div>
      </div>
      <dl className="kv">
        <dt>{t('analysis.firstStep')}</dt>
        <dd>{t(`dir.${d.firstStep.dir}`)}</dd>
        <dt>{t('analysis.prep')}</dt>
        <dd>{t('analysis.prepAt', { t: turnBefore.toFixed(2) })}</dd>
        <dt>{t('analysis.margin')}</dt>
        <dd className={plan.reach.best.margin < 0 ? 'bad' : ''}>{plan.reach.best.margin.toFixed(2)} {t('units.s')}</dd>
        <dt>{t('analysis.contactTime')}</dt>
        <dd>{(plan.contact.t - T_OPPONENT).toFixed(2)} {t('units.s')}</dd>
        <dt>{t('analysis.contactHeight')}</dt>
        <dd>{plan.contact.pos.y.toFixed(2)} {t('units.m')}</dd>
        <dt>{t('layers.contactZone')}</dt>
        <dd className={plan.contactZone.ok ? 'good' : 'bad'}>{plan.contactZone.ok ? t('analysis.zoneOk') : t('analysis.zoneBad')}</dd>
        <dt>{t('analysis.ballSpeed')}</dt>
        <dd>
          {plan.incoming.arrivalSpeedKmh.toFixed(0)} / {plan.incoming.launchSpeedKmh.toFixed(0)} {t('units.kmh')}
        </dd>
        <dt>{t('analysis.apex')}</dt>
        <dd>{plan.incoming.apex.toFixed(2)} {t('units.m')}</dd>
        <dt>{t('analysis.spin')}</dt>
        <dd>
          {t(`spin.${plan.scenario.incomingBall.spin}`)}, {Math.abs(Math.round(plan.incoming.spinRpm))} {t('units.rpm')}
        </dd>
        <dt>{t('analysis.netClearance')}</dt>
        <dd>{plan.incoming.flight.netCrossing?.clearance.toFixed(2)} {t('units.m')}</dd>
        {reply && (
          <>
            <dt>{t('analysis.reply')}</dt>
            <dd className={reply.inside ? 'good' : 'bad'}>{reply.inside ? t('analysis.replyIn') : t('analysis.replyOut')}</dd>
          </>
        )}
      </dl>
      <p className="muted small">{t('analysis.rules', { v: COACH_RULES_VERSION })}</p>
    </div>
  );
}
