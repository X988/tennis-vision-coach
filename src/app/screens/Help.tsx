import { useT } from '../i18n';
import { useTour } from '../tour/context';

function Item({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <li className="help-item">
      <span className="help-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <div className="small muted">{text}</div>
      </div>
    </li>
  );
}

/** Reference of every control. The texts are the same as in the guided tour. */
export function Help() {
  const t = useT();
  const tour = useTour();
  const fromTour = (icon: string, id: string) => <Item key={id} icon={icon} title={t(`tour.${id}.title`)} text={t(`tour.${id}.text`)} />;
  return (
    <div className="page narrow">
      <h1>{t('help.title')}</h1>
      <p className="muted">{t('help.lead')}</p>
      <button className="primary" onClick={tour.start} data-tour="restart-tour">
        {t('help.restart')}
      </button>

      <section className="card">
        <h3>{t('help.playback')}</h3>
        <ul className="help-list">
          {fromTour('▶', 'play')}
          {fromTour('◀︎', 'frameBack')}
          {fromTour('▶︎|', 'frameFwd')}
          {fromTour('⏮', 'phaseBack')}
          {fromTour('⏭', 'phaseFwd')}
          {fromTour('▬', 'track')}
          {fromTour('⏱', 'time')}
          {fromTour('1×', 'rate')}
        </ul>
      </section>

      <section className="card">
        <h3>{t('help.modes')}</h3>
        <ul className="help-list">
          {fromTour('?', 'decide')}
          {fromTour('✓', 'result')}
          {fromTour('≡', 'phaseList')}
          {fromTour('👣', 'stanceExplorer')}
          {fromTour('⇄', 'compareStages')}
          {fromTour('Δ', 'comparePanel')}
          {fromTour('∑', 'analysis')}
        </ul>
      </section>

      <section className="card">
        <h3>{t('help.cameras')}</h3>
        <ul className="help-list">{fromTour('◉', 'cameras')}</ul>
        <h3>{t('help.layers')}</h3>
        <ul className="help-list">{fromTour('☰', 'layers')}</ul>
      </section>

      <section className="card">
        <h3>{t('help.colors')}</h3>
        <ul className="help-list">
          <Item icon="●" title={t('verdict.recommended')} text={t('help.cOk')} />
          <Item icon="●" title={t('verdict.acceptable')} text={t('help.cMid')} />
          <Item icon="●" title={t('verdict.not_recommended')} text={t('help.cBad')} />
          <Item icon="◌" title={t('layers.ghost')} text={t('help.cGhost')} />
          <Item icon="★" title={t('camera.title')} text={t('help.cStar')} />
          <Item icon="!" title={t('library.pending')} text={t('help.cPending')} />
        </ul>
      </section>

      <section className="card">
        <h3>{t('help.gestures')}</h3>
        <ul>
          <li>{t('help.g1')}</li>
          <li>{t('help.g2')}</li>
          <li>{t('help.g3')}</li>
        </ul>
        <h3>{t('help.keys')}</h3>
        <ul>
          <li>{t('help.k1')}</li>
          <li>{t('help.k2')}</li>
          <li>{t('help.k3')}</li>
        </ul>
      </section>

      <section className="card">
        <h3>{t('nav.constructor')} · {t('nav.library')}</h3>
        <ul className="help-list">
          {fromTour('✎', 'ctorForm')}
          {fromTour('⤓', 'ctorActions')}
          {fromTour('⚲', 'filters')}
          {fromTour('▤', 'card')}
        </ul>
      </section>
      <p className="muted small">{t('disclaimer.coach')}</p>
    </div>
  );
}
