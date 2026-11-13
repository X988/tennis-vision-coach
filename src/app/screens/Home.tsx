import { LIBRARY } from '../../content/library';
import { useT } from '../i18n';
import { navigate } from '../router';
import { useStore } from '../store';
import { useTour } from '../tour/context';

export function Home() {
  const t = useT();
  const { summary, working, onboarding } = useStore();
  const tour = useTour();
  const all = LIBRARY.scenarios;
  const done = all.filter((s) => summary.perScenario[s.id]?.bestAllGood).length;
  const firstOpen = all.find((s) => !summary.perScenario[s.id]?.bestAllGood) ?? all[0];
  const pct = summary.answers ? Math.round(((summary.correct + summary.acceptable) / summary.answers) * 100) : 0;
  const last = working.lastLesson;

  return (
    <div className="page home">
      <section className="hero">
        <h1>{t('app.title')}</h1>
        <p className="muted">{t('app.tagline')}</p>
      </section>
      {!onboarding.tourDone && (
        <section className="card offer">
          <p>{t('tour.offer')}</p>
          <button className="primary" onClick={tour.start}>
            {t('tour.offerButton')}
          </button>
        </section>
      )}
      <div className="home-actions">
        <button className="big primary" data-tour="home-start" onClick={() => navigate({ name: 'lesson', id: firstOpen.id, mode: 'decide' })}>
          <strong>{t('home.start')}</strong>
          <span>{t('home.startHint')}</span>
        </button>
        {last && (
          <button className="big" onClick={() => navigate({ name: 'lesson', id: last.id, mode: last.mode as 'decide' })}>
            <strong>{t('home.continue')}</strong>
            <span>{LIBRARY.scenarios.find((s) => s.id === last.id)?.title.ru}</span>
          </button>
        )}
        <button className="big" data-tour="home-quick" onClick={() => navigate({ name: 'lesson', id: all[Math.floor(Math.random() * all.length)].id, mode: 'decide' })}>
          <strong>{t('home.quick')}</strong>
          <span>{t('home.quickHint')}</span>
        </button>
        <button className="big" data-tour="home-progress" onClick={() => navigate({ name: 'progress' })}>
          <strong>{t('home.progress')}</strong>
          <span>{t('home.done', { done, total: all.length })} · {t('home.accuracy', { pct })}</span>
        </button>
      </div>
      <section className="card">
        <h3>{t('home.howTitle')}</h3>
        <ol>
          <li>{t('home.how1')}</li>
          <li>{t('home.how2')}</li>
          <li>{t('home.how3')}</li>
        </ol>
        <p className="muted small">{t('disclaimer.coach')}</p>
        <p className="muted small">{t('disclaimer.notMeasured')}</p>
      </section>
    </div>
  );
}
