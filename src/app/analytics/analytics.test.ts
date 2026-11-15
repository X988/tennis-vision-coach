import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal('window', { setInterval: () => 1, clearInterval: () => undefined, matchMedia: undefined });
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('analytics', () => {
  it('sends nothing without a key, even with consent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const a = await import('./analytics');
    a.setConsent(true);
    a.track('lesson_open', { scenario: 'X' });
    await a.flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storage.has('tvc.aid')).toBe(false);
  });

  it('with a key: nothing before consent; batches after consent; forgets everything on withdrawal', async () => {
    vi.stubEnv('VITE_ANALYTICS_KEY', 'phc_test');
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const a = await import('./analytics');
    a.track('ignored');
    a.setConsent(true);
    a.track('lesson_open', { scenario: 'FH_MEDIUM_NEUTRAL_01', mode: 'decide' });
    await a.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.api_key).toBe('phc_test');
    expect(body.batch.map((e: { event: string }) => e.event)).toEqual(['lesson_open']);
    expect(body.batch[0].properties.distinct_id).toBe(storage.get('tvc.aid')!.replace(/"/g, ''));
    expect(body.batch[0].properties.$process_person_profile).toBe(false);
    a.setConsent(false);
    expect(storage.has('tvc.aid')).toBe(false);
    a.track('after_withdrawal');
    await a.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps events while offline and does not lose them on a failed request', async () => {
    vi.stubEnv('VITE_ANALYTICS_KEY', 'phc_test');
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchSpy);
    const a = await import('./analytics');
    a.setConsent(true);
    a.track('lesson_open');
    await a.flush();
    expect(JSON.parse(storage.get('tvc.aq.v1')!)).toHaveLength(1);
  });

  it('only short, safe property values leave the device', async () => {
    const { sanitize } = await import('./analytics');
    expect(sanitize({ scenario: 'A'.repeat(500), n: 1.23456, ok: true, 'Bad Key': 'x', empty: undefined })).toEqual({ scenario: 'A'.repeat(120), n: 1.235, ok: true });
  });
});
