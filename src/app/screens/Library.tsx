import { useMemo, useState } from 'react';
import { LIBRARY } from '../../content/library';
import { CATEGORIES, ERROR_VARIANTS, ScenarioSpec } from '../../engines/scenario';
import { useT } from '../i18n';
import { navigate } from '../router';
import { useStore } from '../store';

export function ScenarioTags({ s }: { s: ScenarioSpec }) {
  const t = useT();
  return (
    <div className="tags">
      <span className="tag strong">{t(`shot.${s.task.shot}`)}</span>
      <span className="tag">{'●'.repeat(s.learning.difficulty)}{'○'.repeat(3 - s.learning.difficulty)}</span>
      {s.learning.categories.map((c) => (
        <span key={c} className="tag">{t(`category.${c}`)}</span>
      ))}
      <span className="tag">{t(`goal.${s.task.goal}`)}</span>
      <span className={`tag ${s.learning.coachApproved ? 'ok' : 'pending'}`}>{s.learning.coachApproved ? t('library.approved') : t('library.pending')}</span>
    </div>
  );
}

export function Library() {
  const t = useT();
  const { summary, profile } = useStore();
  const [shot, setShot] = useState<string>('all');
  const [diff, setDiff] = useState<string>('all');
  const [cat, setCat] = useState<string>('all');
  const [err, setErr] = useState<string>('all');
  const list = useMemo(
    () =>
      LIBRARY.scenarios.filter(
        (s) =>
          (shot === 'all' || s.task.shot === shot) &&
          (diff === 'all' || String(s.learning.difficulty) === diff) &&
          (cat === 'all' || s.learning.categories.includes(cat as never)) &&
          (err === 'all' || s.learning.errorVariant === err),
      ),
    [shot, diff, cat, err],
  );

  return (
    <div className="page">
      <h1>{t('library.title')}</h1>
      <div className="filters">
        <label>
          {t('library.filterShot')}
          <select value={shot} onChange={(e) => setShot(e.target.value)}>
            <option value="all">{t('library.all')}</option>
            <option value="forehand">{t('shot.forehand')}</option>
            <option value="backhand">{t('shot.backhand')}</option>
          </select>
        </label>
        <label>
          {t('library.filterDifficulty')}
          <select value={diff} onChange={(e) => setDiff(e.target.value)}>
            <option value="all">{t('library.all')}</option>
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>{'●'.repeat(d)}</option>
            ))}
          </select>
        </label>
        <label>
          {t('library.filterCategory')}
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">{t('library.all')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`category.${c}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t('library.filterError')}
          <select value={err} onChange={(e) => setErr(e.target.value)}>
            <option value="all">{t('library.all')}</option>
            {ERROR_VARIANTS.map((v) => (
              <option key={v} value={v}>{t(`variant.${v}`)}</option>
            ))}
          </select>
        </label>
      </div>
      {list.length === 0 && <p className="muted">{t('library.empty')}</p>}
      <div className="cards">
        {list.map((s) => {
          const p = summary.perScenario[s.id];
          return (
            <article key={s.id} className="card">
              <div className="row-between">
                <h3>{s.title[profile.language] ?? s.title.ru}</h3>
                {p && <span className={`badge ${p.bestAllGood ? 'v-recommended' : 'v-acceptable'}`}>{p.bestAllGood ? t('library.done') : t('library.tried', { n: p.attempts })}</span>}
              </div>
              <p className="muted small">{s.description[profile.language] ?? s.description.ru}</p>
              <ScenarioTags s={s} />
              <div className="actions">
                <button className="primary" onClick={() => navigate({ name: 'lesson', id: s.id, mode: 'decide' })}>{t('library.learn')}</button>
                <button onClick={() => navigate({ name: 'lesson', id: s.id, mode: 'watch' })}>{t('library.watch')}</button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="muted small">{t('disclaimer.coach')}</p>
    </div>
  );
}
