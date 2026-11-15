import { del } from 'idb-keyval';
import { analyticsConfigured, setConsent } from '../analytics/analytics';
import { useT } from '../i18n';
import { useStore } from '../store';

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? '';
const POLICY_DATE = '15.11.2026';

/** Privacy policy (also the text for the store listing) and the learner's data controls. */
export function Privacy() {
  const t = useT();
  const { privacy, setPrivacy } = useStore();
  const configured = analyticsConfigured();

  const eraseAll = async () => {
    if (!window.confirm(t('privacy.eraseConfirm'))) return;
    setConsent(false);
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    await del('tvc.progress.v1').catch(() => undefined);
    window.location.hash = '#/';
    window.location.reload();
  };

  return (
    <div className="page narrow privacy">
      <h1>{t('privacy.title')}</h1>
      <p className="muted small">{t('privacy.updated', { date: POLICY_DATE })}</p>

      {configured && (
        <section className="card">
          <h3>{t('privacy.yourChoice')}</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={privacy.analytics === 'granted'}
              onChange={(e) => {
                setPrivacy({ analytics: e.target.checked ? 'granted' : 'denied' });
                setConsent(e.target.checked);
              }}
            />
            {t('privacy.consent')}
          </label>
          <p className="muted small">{t('privacy.withdraw')}</p>
        </section>
      )}

      <section>
        <h3>{t('privacy.h.local')}</h3>
        <p>{t('privacy.p.local')}</p>
        <h3>{t('privacy.h.stats')}</h3>
        <p>{configured ? t('privacy.p.stats') : t('privacy.p.statsOff')}</p>
        {configured && (
          <ul>
            <li>{t('privacy.li.id')}</li>
            <li>{t('privacy.li.events')}</li>
            <li>{t('privacy.li.device')}</li>
            <li>{t('privacy.li.profile')}</li>
          </ul>
        )}
        <h3>{t('privacy.h.never')}</h3>
        <p>{t('privacy.p.never')}</p>
        <h3>{t('privacy.h.voice')}</h3>
        <p>{t('privacy.p.voice')}</p>
        <h3>{t('privacy.h.children')}</h3>
        <p>{t('privacy.p.children')}</p>
        <h3>{t('privacy.h.delete')}</h3>
        <p>{t('privacy.p.delete')}</p>
        <button className="danger" onClick={eraseAll}>
          {t('privacy.erase')}
        </button>
        {SUPPORT_EMAIL && (
          <>
            <h3>{t('privacy.h.contact')}</h3>
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
