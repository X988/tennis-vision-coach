/**
 * App-wide lifecycle signals, independent of the platform:
 *  - "background": the app was hidden (switched away, screen locked) —
 *    playback pauses and the voice stops;
 *  - back handlers: the Android back button / gesture asks the topmost
 *    handler first (tour, dialog), then falls back to history navigation.
 */
type BackHandler = () => boolean;

const backHandlers: BackHandler[] = [];

/** Register a handler for the system back action; return true from it to consume the event. */
export function onBack(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.lastIndexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

/** Runs the handlers from the most recent one; true if one of them handled the back action. */
export function dispatchBack(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return true;
  return false;
}

export const BACKGROUND_EVENT = 'tvc:background';

export function notifyBackground() {
  window.dispatchEvent(new Event(BACKGROUND_EVENT));
}

export function onBackground(fn: () => void): () => void {
  window.addEventListener(BACKGROUND_EVENT, fn);
  return () => window.removeEventListener(BACKGROUND_EVENT, fn);
}

/** Browsers: a hidden tab counts as going to the background. */
export function watchVisibility() {
  const on = () => {
    if (document.visibilityState === 'hidden') notifyBackground();
  };
  document.addEventListener('visibilitychange', on);
  return () => document.removeEventListener('visibilitychange', on);
}
