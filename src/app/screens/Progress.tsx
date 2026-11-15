import { LIBRARY } from '../../content/library';
import { useT } from '../i18n';
import { navigate } from '../router';
import { useStore } from '../store';
import { optionLabel } from '../format';

export function Progress() {
  const t = useT();
  const { summary, progress, resetProgress, profile } = useStore();
  const title = (id: string) => {
    const s = LIBRARY.scenarios.find((x) => x.id === id);
    return s ? (s.title[profile.language] ?? s.title.ru) : id;
  };
  return (
    <div className="page" data-tour="page">
      <h1>{t('progress.title')}</h1>
      {progress.length === 0 ? (
        <p className="muted">{t('progress.empty')}</p>
      ) : (
        <>
          <div className="stats">
            {(['attempts', 'answers', 'correct', 'acceptable', 'wrong'] as const).map((k) => (
              <div key={k} className={`stat ${k}`}>
                <span className="stat-v">{summary[k]}</span>
                <span className="stat-l">{t(`progress.${k}`)}</span>
              </div>
            ))}
          </div>
          {Object.keys(summary.errorsByType).length > 0 && (
            <section className="card">
              <h3>{t('progress.errorsByType')}</h3>
              <dl className="kv">
                {Object.entries(summary.errorsByType).map(([k, n]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{t(`q.${k}`)}</dt>
                    <dd>{n}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="card">
            <h3>{t('progress.history')}</h3>
            <ul className="history">
              {[...progress]
                .reverse()
                .slice(0, 40)
                .map((a) => (
                  <li key={a.id}>
                    <button className="link" onClick={() => navigate({ name: 'lesson', id: a.scenarioId, mode: 'decide' })}>
                      {title(a.scenarioId)}
                    </button>
                    <span className="muted small"> · {new Date(a.at).toLocaleString(profile.language)}</span>
                    <div className="small">
                      {a.results.map((r) => (
                        <span key={r.kind} className={`badge v-${r.verdict}`}>
                          {optionLabel(t, r.kind, r.value)}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
          <button className="danger" onClick={() => window.confirm(t('progress.confirmReset')) && resetProgress()}>
            {t('progress.reset')}
          </button>
        </>
      )}
      <p className="muted small">{t('disclaimer.notMeasured')}</p>
    </div>
  );
}
