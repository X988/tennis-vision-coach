/**
 * The guided tour: an ordered list of steps. Each step may navigate to a
 * route, highlight one element (`data-tour="<target>"`) and wait until the
 * learner has done something (`until` selector appears).
 * Texts live in i18n under `tour.<id>.title` / `tour.<id>.text`.
 */
export const TOUR_LESSON_ID = 'FH_MEDIUM_NEUTRAL_01';

export interface TourStep {
  id: string;
  route?: string;
  target?: string;
  /** The step is complete when this selector matches; until then the learner acts inside the highlight. */
  until?: string;
}

const lesson = (mode: string) => `#/lesson/${TOUR_LESSON_ID}?mode=${mode}`;

export const TOUR_STEPS: TourStep[] = [
  { id: 'nav', route: '#/', target: 'nav' },
  { id: 'homeStart', target: 'home-start' },
  { id: 'homeQuick', target: 'home-quick' },
  { id: 'homeProgress', target: 'home-progress' },
  { id: 'stage', route: lesson('decide'), target: 'stage' },
  { id: 'decide', target: 'decision', until: '[data-tour="result"]' },
  { id: 'result', target: 'result' },
  { id: 'play', target: 'btn-play' },
  { id: 'frameBack', target: 'btn-frame-back' },
  { id: 'frameFwd', target: 'btn-frame-fwd' },
  { id: 'phaseBack', target: 'btn-phase-back' },
  { id: 'phaseFwd', target: 'btn-phase-fwd' },
  { id: 'track', target: 'tl-track' },
  { id: 'time', target: 'tl-time' },
  { id: 'rate', target: 'rate' },
  { id: 'tabs', target: 'tabs' },
  { id: 'stanceExplorer', route: lesson('watch'), target: 'stance-explorer' },
  { id: 'phaseList', target: 'phase-list' },
  { id: 'analysis', target: 'analysis' },
  { id: 'cameras', target: 'camera-bar' },
  { id: 'layers', target: 'layers' },
  { id: 'compareStages', route: lesson('compare'), target: 'stages' },
  { id: 'comparePanel', target: 'compare-panel' },
  { id: 'ctorForm', route: '#/constructor', target: 'ctor-form' },
  { id: 'ctorActions', target: 'ctor-actions' },
  { id: 'filters', route: '#/library', target: 'filters' },
  { id: 'card', target: 'card-actions' },
  { id: 'progress', route: '#/progress', target: 'page' },
  { id: 'profile', route: '#/profile', target: 'profile-form' },
  { id: 'help', target: 'nav-help' },
  { id: 'finish', route: '#/' },
];

/** Route in effect at each step (a step without its own route stays on the previous one). */
export const STEP_ROUTES: string[] = TOUR_STEPS.reduce<string[]>((acc, s, i) => {
  acc.push(s.route ?? acc[i - 1] ?? '#/');
  return acc;
}, []);
