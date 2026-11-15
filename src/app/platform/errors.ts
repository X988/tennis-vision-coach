/**
 * Error capture: every uncaught error, rejected promise and React render
 * error lands in a small local log (last 30 entries). The learner can copy
 * it from Help -> "Report a problem"; when analytics is allowed, a short,
 * anonymous error event is also sent (see analytics.ts).
 */
export interface ErrorEntry {
  at: string;
  kind: 'error' | 'rejection' | 'render' | 'webgl';
  message: string;
  stack?: string;
  route: string;
}

const KEY = 'tvc.errors.v1';
const MAX = 30;
type Listener = (e: ErrorEntry) => void;
const listeners = new Set<Listener>();

function read(): ErrorEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function errorLog(): ErrorEntry[] {
  return read();
}

export function clearErrorLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function onError(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Errors that are noise, not bugs (e.g. a cancelled speech request or resize observer loops). */
const IGNORED = [/ResizeObserver loop/i, /interrupted/i, /AbortError/i];

export function reportError(kind: ErrorEntry['kind'], err: unknown) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  if (IGNORED.some((re) => re.test(e.message))) return;
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    kind,
    message: e.message.slice(0, 300),
    stack: e.stack?.split('\n').slice(0, 6).join('\n'),
    route: window.location.hash.replace(/\?.*$/, '') || '#/',
  };
  try {
    const log = [...read(), entry].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((l) => l(entry));
}

let installed = false;
export function installGlobalHandlers() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (ev) => reportError('error', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError('rejection', ev.reason));
}

/** Text for "Report a problem": app and device info plus the recent errors. No personal data. */
export function diagnostics(extra: Record<string, string>) {
  const lines = [
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    `userAgent: ${navigator.userAgent}`,
    `screen: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}`,
    '',
    ...read()
      .slice(-10)
      .map((e) => `[${e.at}] ${e.kind} ${e.route}: ${e.message}`),
  ];
  return lines.join('\n');
}

let webgl: boolean | null = null;
/** Whether this device can render the 3D court at all. */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}
