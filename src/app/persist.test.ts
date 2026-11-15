import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../content/library';
import { STATE_VERSION, defaults, migrate, restore } from './persist';

const first = LIBRARY.scenarios[0];

describe('saved state', () => {
  it('a fresh install gets defaults with analytics not yet asked', () => {
    const s = restore(null, first);
    expect(s).toEqual(defaults(first));
    expect(s.privacy.analytics).toBe('unset');
    expect(s.version).toBe(STATE_VERSION);
  });

  it('upgrades a v1 state (0.1–0.4) keeping the learner settings', () => {
    const v1 = {
      profile: { handedness: 'left', backhand: 'one_handed', heightCm: 190, level: 'advanced', language: 'ru' },
      settings: { camera: 'side', quality: 'low', rate: 0.25, layers: { ghost: false }, voice: { enabled: false, rate: 1.2 } },
      working: { lastLesson: { id: 'BH_WIDE_01', mode: 'watch' } },
      onboarding: { welcomeSeen: true, tourDone: true },
    };
    const s = restore(v1, first);
    expect(s.profile).toEqual(v1.profile);
    expect(s.settings.camera).toBe('side');
    expect(s.settings.rate).toBe(0.25);
    expect(s.settings.layers.ghost).toBe(false);
    expect(s.settings.layers.trail).toBe(true);
    expect(s.settings.voice).toEqual({ enabled: false, rate: 1.2 });
    expect(s.settings.theme).toBe('auto');
    expect(s.working.lastLesson).toEqual({ id: 'BH_WIDE_01', mode: 'watch' });
    expect(s.onboarding.tourDone).toBe(true);
    expect(migrate(v1).version).toBe(STATE_VERSION);
  });

  it('repairs damaged values field by field instead of resetting everything', () => {
    const s = restore(
      {
        version: 2,
        profile: { handedness: 'both', heightCm: 999, level: 'pro', language: 'ru' },
        settings: { camera: 42, rate: 7, voice: { rate: 'fast' }, theme: 'light' },
        working: { draft: { id: 'broken' }, lastLesson: 'x' },
        privacy: { analytics: 'granted' },
      },
      first,
    );
    expect(s.profile.handedness).toBe('right');
    expect(s.profile.heightCm).toBe(205);
    expect(s.profile.level).toBe('intermediate');
    expect(s.settings.camera).toBe('back');
    expect(s.settings.rate).toBe(1);
    expect(s.settings.voice.rate).toBe(1);
    expect(s.settings.theme).toBe('light');
    expect(s.working.draft.id).toBe('CUSTOM_01');
    expect(s.working.lastLesson).toBeNull();
    expect(s.privacy.analytics).toBe('granted');
  });

  it.each([undefined, 'garbage', 42, [], { version: 99 }])('never throws on %j', (raw) => {
    expect(() => restore(raw, first)).not.toThrow();
  });
});
