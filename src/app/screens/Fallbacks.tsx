import { useT } from '../i18n';
import { navigate } from '../router';

export function ScreenLoading() {
  const t = useT();
  return (
    <div className="screen-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <p className="muted">{t('state.loading')}</p>
    </div>
  );
}

export function ScreenError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="screen-state" role="alert">
      <h2>{t('state.errorTitle')}</h2>
      <p className="muted">{t('state.errorText')}</p>
      <div className="actions">
        <button className="primary" onClick={onRetry}>
          {t('state.retry')}
        </button>
        <button onClick={() => navigate({ name: 'home' })}>{t('nav.home')}</button>
        <button onClick={() => navigate({ name: 'help' })}>{t('state.report')}</button>
      </div>
    </div>
  );
}

export function NotFound() {
  const t = useT();
  return (
    <div className="screen-state">
      <h2>{t('state.notFoundTitle')}</h2>
      <p className="muted">{t('state.notFoundText')}</p>
      <div className="actions">
        <button className="primary" onClick={() => navigate({ name: 'library' })}>
          {t('nav.library')}
        </button>
      </div>
    </div>
  );
}
