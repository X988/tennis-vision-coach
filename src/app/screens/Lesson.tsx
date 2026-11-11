import { useCallback, useEffect, useMemo, useState } from 'react';
import { LIBRARY } from '../../content/library';
import { Judgement, makeAttempt } from '../../engines/feedback';
import { T_OPPONENT } from '../../engines/plan';
import { DecisionKind, STANCES, Stance } from '../../engines/scenario';
import { useClock, useClockState, useMediaQuery, usePlan } from '../hooks';
import { useT } from '../i18n';
import { navigate } from '../router';
import { Marker } from '../scene/Overlays';
import { Stage } from '../scene/Stage';
import { Layers, useStore } from '../store';
import { DecisionSummary, PhaseBreakdown, StatusBadge } from '../ui/AnalysisPanel';
import { ComparePanel } from '../ui/ComparePanel';
import { DecisionFlow } from '../ui/DecisionFlow';
import { Timeline } from '../ui/Timeline';
import { CameraBar, LayerToggles } from '../ui/ViewControls';
import { ScenarioTags } from './Library';

const NO_LAYERS: Layers = { trail: true, bounce: true, footRoute: false, ghost: false, contactZone: false, direction: false };

export function Lesson({ id, mode }: { id: string; mode: 'watch' | 'decide' | 'compare' }) {
  const t = useT();
  const { profile, settings, setSettings, setLayers, working, setWorking, addAttempt } = useStore();
  const scenario = useMemo(() => (id === 'custom' ? working.draft : (LIBRARY.scenarios.find((s) => s.id === id) ?? null)), [id, working.draft]);
  const [explore, setExplore] = useState<Stance | null>(null);
  const [question, setQuestion] = useState<DecisionKind | null>(null);
  const [answered, setAnswered] = useState<Judgement[] | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const portrait = useMediaQuery('(max-aspect-ratio: 1/1)');

  const plan = usePlan(scenario, profile, { stance: mode === 'watch' ? explore : null });
  const recommended = usePlan(scenario, profile);
  const bad = usePlan(mode === 'compare' ? scenario : null, profile, { variant: scenario?.learning.errorVariant ?? null });
  const deciding = mode === 'decide' && !answered;
  const duration = plan ? (deciding ? plan.contact.t : Math.max(plan.duration, bad?.duration ?? 0)) : 1;
  const clock = useClock(duration, deciding ? 0.75 : settings.rate);
  // While deciding, the player stays in the ready position so the answer is not revealed.
  const shown = useMemo(() => (plan && deciding ? { ...plan, motion: freeze(plan.motion) } : plan), [plan, deciding]);

  useEffect(() => {
    if (id !== 'custom') setWorking({ lastLesson: { id, mode } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode]);

  // New scenario / mode / attempt: start from the beginning.
  useEffect(() => {
    setAnswered(null);
    setExplore(null);
    clock.loop = mode === 'decide';
    clock.seek(0);
    if (mode === 'decide') clock.play();
    else clock.pause();
  }, [id, mode, attemptKey, clock]);

  const onDone = useCallback(
    (js: Judgement[]) => {
      if (!recommended) return;
      setAnswered(js);
      addAttempt(makeAttempt(recommended, js));
      clock.loop = false;
      clock.seek(T_OPPONENT - 0.3);
      clock.play();
    },
    [recommended, addAttempt, clock],
  );

  if (!scenario || !plan || !shown || !recommended) {
    return (
      <div className="page">
        <p>404</p>
      </div>
    );
  }

  const idx = LIBRARY.scenarios.findIndex((s) => s.id === scenario.id);
  const next = LIBRARY.scenarios[(idx + 1) % LIBRARY.scenarios.length];
  const go = (m: typeof mode) => navigate({ name: 'lesson', id, mode: m });

  const markers: Marker[] =
    mode === 'decide' && (question === 'position' || answered?.some((j) => j.kind === 'position'))
      ? recommended.decision.position.map((o) => {
          const j = answered?.find((x) => x.kind === 'position');
          const tone = !j ? 'neutral' : o.verdict === 'recommended' ? 'good' : o.verdict === 'acceptable' ? 'ok' : 'bad';
          return { id: o.value, label: t(`posShort.${o.value}`), pos: o.candidate.pos, tone };
        })
      : [];

  const layers = deciding ? NO_LAYERS : settings.layers;
  const stageProps = { clock, view: settings.camera, layers, quality: settings.quality };

  return (
    <div className={`lesson ${portrait ? 'portrait' : ''}`}>
      <div className="lesson-main">
        <div className={`stages ${mode === 'compare' ? 'two' : ''}`}>
          {mode === 'compare' && bad ? (
            <>
              <Stage {...stageProps} plan={plan} label={t('lesson.compareCorrect')} tone="good" />
              <Stage {...stageProps} plan={bad} ghostPlan={plan} label={t('lesson.compareWrong', { name: t(`variant.${bad.variant}`) })} tone="bad" />
            </>
          ) : (
            <Stage {...stageProps} plan={shown} ghostPlan={explore ? recommended : plan} markers={markers} hideAnswer={deciding} />
          )}
        </div>
        <Timeline plan={plan} clock={clock} rate={settings.rate} onRate={(rate) => setSettings({ rate })} />
      </div>

      <aside className="lesson-side">
        <header className="lesson-head">
          <div className="row-between">
            <h2>{scenario.title[profile.language] ?? scenario.title.ru}</h2>
            <StatusBadge plan={recommended} />
          </div>
          <p className="muted small">{scenario.description[profile.language] ?? scenario.description.ru}</p>
          <ScenarioTags s={scenario} />
          <div className="tabs">
            {(['decide', 'watch', 'compare'] as const).map((m) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => go(m)}>
                {t(`lesson.mode${m[0].toUpperCase()}${m.slice(1)}`)}
              </button>
            ))}
          </div>
        </header>

        {mode === 'decide' && (
          <>
            <DecisionFlow key={`${id}-${attemptKey}-${profile.handedness}-${profile.level}`} plan={recommended} onQuestion={setQuestion} onDone={onDone} />
            {answered && (
              <div className="actions">
                <button onClick={() => setAttemptKey((k) => k + 1)}>{t('lesson.retry')}</button>
                <button onClick={() => go('watch')}>{t('lesson.toWatch')}</button>
                <button onClick={() => go('compare')}>{t('lesson.toCompare')}</button>
                {id !== 'custom' && (
                  <button className="primary" onClick={() => navigate({ name: 'lesson', id: next.id, mode: 'decide' })}>
                    {t('lesson.next')}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'compare' && bad && <ComparePanel good={plan} bad={bad} />}

        {mode === 'watch' && (
          <>
            <section>
              <h4>{t('lesson.stanceExplorer')}</h4>
              <div className="seg wrap">
                <button className={explore === null ? 'active' : ''} onClick={() => setExplore(null)}>
                  {t('lesson.stanceAuto')}
                </button>
                {STANCES.map((s) => (
                  <button key={s} className={explore === s ? 'active' : ''} onClick={() => setExplore(s)}>
                    {t(`stance.${s}`)}
                  </button>
                ))}
              </div>
              {explore && <p className="small muted">{t(`stance.desc.${explore}`)}</p>}
            </section>
            <WatchPhases plan={plan} clock={clock} />
            <DecisionSummary plan={plan} />
          </>
        )}

        {!deciding && (
          <section>
            <h4>{t('camera.title')}</h4>
            <CameraBar view={settings.camera} onView={(camera) => setSettings({ camera })} recommended={scenario.learning.cameras} />
            <h4>{t('layers.title')}</h4>
            <LayerToggles layers={settings.layers} onChange={setLayers} />
          </section>
        )}
        <p className="muted small">{t('disclaimer.placeholderModel')}</p>
      </aside>
    </div>
  );
}

function WatchPhases({ plan, clock }: { plan: NonNullable<ReturnType<typeof usePlan>>; clock: ReturnType<typeof useClock> }) {
  const t = useT();
  const { time } = useClockState(clock);
  return (
    <section>
      <h4>{t('lesson.modeWatch')}</h4>
      <PhaseBreakdown plan={plan} time={time} clock={clock} />
    </section>
  );
}

/** Motion plan with the player frozen in the ready position (decision mode must not reveal the answer). */
function freeze(m: NonNullable<ReturnType<typeof usePlan>>['motion']) {
  const first = <T extends { t: number }>(keys: T[]) => [keys[0]];
  return {
    ...m,
    feet: { left: [{ ...m.feet.left[0], end: Infinity }], right: [{ ...m.feet.right[0], end: Infinity }] },
    pelvisPath: [m.pelvisPath[0]],
    pelvisHeight: first(m.pelvisHeight),
    torsoFacing: first(m.torsoFacing),
    pelvisFacing: first(m.pelvisFacing),
    leanS: first(m.leanS),
    leanF: first(m.leanF),
    racket: first(m.racket),
  };
}
