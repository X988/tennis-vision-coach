import type { Dict } from './ru';

/** English (partial — missing keys fall back to Russian). */
export const en: Dict = {
  app: { tagline: 'Interactive 3D trainer for game situations' },
  nav: { home: 'Home', library: 'Library', constructor: 'Builder', progress: 'Progress', profile: 'Profile', back: 'Back' },
  home: { start: 'Start training', continue: 'Continue lesson', quick: 'Quick scenario', progress: 'Your progress' },
  lesson: { modeWatch: 'Breakdown', modeDecide: 'Make a decision', modeCompare: 'Compare', next: 'Next scenario', retry: 'Retry' },
  stance: { open: 'Open', semi_open: 'Semi-open', neutral: 'Neutral', closed: 'Closed' },
  verdict: { recommended: 'Recommended', acceptable: 'Acceptable', not_recommended: 'Not recommended' },
  shot: { forehand: 'Forehand', backhand: 'Backhand' },
  camera: { title: 'Camera', top: 'Top', side: 'Side', back: 'Behind', opponent: 'Opponent view', free: 'Free 360°', contact: 'Focus on contact' },
  profile: { title: 'Learner profile', handedness: 'Dominant hand', language: 'Language', level: 'Level', height: 'Height' },
  handedness: { right: 'Right-handed', left: 'Left-handed' },
};
