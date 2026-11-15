/**
 * Anonymous, opt-in usage statistics.
 *
 *  - Nothing is collected or sent unless the learner has agreed AND the
 *    build has an analytics key (VITE_ANALYTICS_KEY). Builds without a key
 *    never show the question and never send anything.
 *  - No personal data: a random install id (deleted when consent is
 *    withdrawn), app/platform info and what happens in lessons. Event
 *    properties are restricted to short strings, numbers and booleans.
 *  - Transport: PostHog capture API (EU host by default), batched, kept
 *    across restarts while offline. No third-party SDK in the app.
 */
import { platformName } from '../platform/native';

export type Props = Record<string, string | number | boolean | null | undefined>;

interface QueuedEvent {
  event: string;
  timestamp: string;
  properties: Record<string, string | number | boolean>;
}

const KEY = import.meta.env.VITE_ANALYTICS_KEY as string | undefined;
const HOST = ((import.meta.env.VITE_ANALYTICS_HOST as string | undefined) || 'https://eu.i.posthog.com').replace(/\/$/, '');
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

const ID_KEY = 'tvc.aid';
const QUEUE_KEY = 'tvc.aq.v1';
const MAX_QUEUE = 300;
const FLUSH_EVERY_MS = 20_000;
const FLUSH_AT = 20;

let granted = false;
let context: Record<string, string> = {};
let queue: QueuedEvent[] = [];
let timer: number | null = null;
let sending = false;

export const analyticsConfigured = () => !!KEY;

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

function installId(): string {
  let id = load<string | null>(ID_KEY, null);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    save(ID_KEY, id);
  }
  return id;
}

/** Only short, non-identifying values leave the device. */
export function sanitize(props: Props = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || !/^[a-z_]{1,32}$/.test(k)) continue;
    if (typeof v === 'number') out[k] = Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
    else if (typeof v === 'boolean') out[k] = v;
    else out[k] = String(v).slice(0, 120);
  }
  return out;
}

export function setConsent(value: boolean) {
  granted = value && analyticsConfigured();
  if (!granted) {
    // Withdrawal: forget the install id and anything not yet sent.
    queue = [];
    save(QUEUE_KEY, []);
    try {
      localStorage.removeItem(ID_KEY);
    } catch {
      /* ignore */
    }
    if (timer) window.clearInterval(timer);
    timer = null;
    return;
  }
  queue = load<QueuedEvent[]>(QUEUE_KEY, []);
  if (!timer) timer = window.setInterval(flush, FLUSH_EVERY_MS);
}

export function setContext(c: Record<string, string>) {
  context = { ...context, ...c };
}

export function track(event: string, props?: Props) {
  if (!granted) return;
  queue.push({
    event,
    timestamp: new Date().toISOString(),
    properties: { ...sanitize(props), ...context, app_version: APP_VERSION, platform: platformName() },
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  save(QUEUE_KEY, queue);
  if (queue.length >= FLUSH_AT) flush();
}

export async function flush() {
  if (!granted || sending || queue.length === 0 || !KEY) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  sending = true;
  const batch = queue.slice(0, 100);
  const distinctId = installId();
  try {
    const res = await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        api_key: KEY,
        batch: batch.map((e) => ({ ...e, properties: { ...e.properties, distinct_id: distinctId, $process_person_profile: false } })),
      }),
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
      save(QUEUE_KEY, queue);
    }
  } catch {
    /* offline or blocked: keep the queue and retry later */
  } finally {
    sending = false;
  }
}
