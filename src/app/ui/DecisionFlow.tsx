import { useEffect, useMemo, useState } from 'react';
import { Judgement, judge, questionOptions } from '../../engines/feedback';
import { Plan } from '../../engines/plan';
import { DecisionKind, Stance } from '../../engines/scenario';
import { reasonText, useT } from '../i18n';
import { optionLabel } from '../format';
import { useVoice } from '../voice/context';
import { questionCue, resultCue } from '../voice/narration';
import { PRIORITY } from '../voice/speaker';
import { StanceIcon } from './StanceIcon';

const ARROWS: Record<string, string> = {
  forward: '↑', back: '↓', left: '←', right: '→', forward_left: '↖', forward_right: '↗', back_left: '↙', back_right: '↘', stay: '•',
};

interface Props {
  plan: Plan;
  onQuestion: (kind: DecisionKind | null) => void;
  onDone: (judgements: Judgement[]) => void;
  /** False in training mode, where the attempt is not recorded. */
  saved?: boolean;
  /** Read questions and the judgement aloud (off while the guided tour is talking). */
  narrate?: boolean;
}

export function DecisionFlow({ plan, onQuestion, onDone, saved = true, narrate = true }: Props) {
  const voice = useVoice();
  const t = useT();
  const kinds = plan.scenario.learning.decisions;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<Judgement[]>([]);
  const finished = results.length === kinds.length;
  const kind = kinds[Math.min(index, kinds.length - 1)];
  const options = useMemo(() => questionOptions(plan, kind), [plan, kind]);

  useEffect(() => onQuestion(finished ? null : kind), [kind, finished, onQuestion]);
  useEffect(() => {
    if (!narrate) return;
    if (finished) voice.say(resultCue(t, results), { priority: PRIORITY.lesson });
    else voice.say(questionCue(t, kind, index + 1, kinds.length), { priority: PRIORITY.lesson });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, finished, narrate, voice.enabled]);

  const submit = () => {
    if (!picked) return;
    const next = [...results, judge(plan, kind, picked)];
    setResults(next);
    setPicked(null);
    if (next.length === kinds.length) onDone(next);
    else setIndex(index + 1);
  };

  if (finished) {
    return (
      <div className="decision" data-tour="result">
        <h3>{t('lesson.resultTitle')}</h3>
        {results.map((j) => (
          <div key={j.kind} className={`judgement v-${j.verdict}`}>
            <div className="row-between">
              <strong>{t(`q.${j.kind}`)}</strong>
              <span className={`badge v-${j.verdict}`}>{t(`verdict.${j.verdict}`)}</span>
            </div>
            <div className="small">
              {optionLabel(t, j.kind, j.value)}
              {j.verdict !== 'recommended' && <> → {t('lesson.recommendedIs', { value: optionLabel(t, j.kind, j.recommended) })}</>}
            </div>
            {j.acceptable.length > 0 && <div className="small muted">{t('lesson.alsoOk', { values: j.acceptable.map((v) => optionLabel(t, j.kind, v)).join(', ') })}</div>}
            <ul className="reasons">
              {j.reasons.map((r, i) => (
                <li key={i}>{reasonText(t, r)}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="muted small">{saved ? `${t('lesson.saved')} · ` : ''}{t('disclaimer.notMeasured')}</p>
      </div>
    );
  }

  return (
    <div className="decision" data-tour="decision">
      <p className="muted small">{t('lesson.decideIntro')}</p>
      <div className="muted small">{t('lesson.question', { n: index + 1, total: kinds.length })}</div>
      <h3>{t(`q.${kind}`)}</h3>
      <div className={`options ${kind === 'first_step' ? 'grid3' : ''}`}>
        {options.map((o) => (
          <button key={o.value} className={`option ${picked === o.value ? 'picked' : ''}`} onClick={() => setPicked(o.value)}>
            {kind === 'stance' && <StanceIcon stance={o.value as Stance} size={44} />}
            {kind === 'first_step' && <span className="arrow">{ARROWS[o.value]}</span>}
            <span>{optionLabel(t, kind, o.value)}</span>
          </button>
        ))}
      </div>
      <button className="primary wide" disabled={!picked} onClick={submit}>
        {index + 1 === kinds.length ? t('lesson.showDemo') : t('lesson.answer')}
      </button>
    </div>
  );
}
