/**
 * Saved app state: format version, migrations and validation. Pure
 * functions (no storage access) so every upgrade path is unit tested.
 * Anything unreadable falls back to defaults field by field — an app update
 * or a damaged value never loses the rest of the learner's settings.
 */
import { DEFAULT_PROFILE, Profile } from '../engines/profile';
import { ScenarioSpec, validateScenario } from '../engines/scenario';

export const STATE_VERSION = 2;

export type CameraView = 'top' | 'side' | 'back' | 'opponent' | 'free' | 'contact';
export type Quality = 'auto' | 'high' | 'low';
export type Theme = 'auto' | 'dark' | 'light';
export type Consent = 'unset' | 'granted' | 'denied';

export interface Layers {
  trail: boolean;
  bounce: boolean;
  footRoute: boolean;
  ghost: boolean;
  contactZone: boolean;
  direction: boolean;
}

export interface VoiceSettings {
  enabled: boolean;
  /** Speech rate, 1 = normal. */
  rate: number;
}

export interface Settings {
  camera: CameraView;
  layers: Layers;
  quality: Quality;
  rate: number;
  voice: VoiceSettings;
  theme: Theme;
}

export interface WorkingState {
  lastLesson: { id: string; mode: string } | null;
  draft: ScenarioSpec;
}

export interface Onboarding {
  /** The first-launch welcome has been shown. */
  welcomeSeen: boolean;
  /** The guided tour has been completed at least once. */
  tourDone: boolean;
}

export interface Privacy {
  /** Anonymous usage statistics: asked on first launch, opt-in. */
  analytics: Consent;
}

export interface Persisted {
  version: number;
  profile: Profile;
  settings: Settings;
  working: WorkingState;
  onboarding: Onboarding;
  privacy: Privacy;
}

export const DEFAULT_SETTINGS: Settings = {
  camera: 'back',
  layers: { trail: true, bounce: true, footRoute: true, ghost: true, contactZone: true, direction: true },
  quality: 'auto',
  rate: 1,
  voice: { enabled: true, rate: 1 },
  theme: 'auto',
};

export function defaults(firstScenario: ScenarioSpec): Persisted {
  return {
    version: STATE_VERSION,
    profile: DEFAULT_PROFILE,
    settings: DEFAULT_SETTINGS,
    working: { lastLesson: null, draft: { ...firstScenario, id: 'CUSTOM_01', learning: { ...firstScenario.learning, coachApproved: false } } },
    onboarding: { welcomeSeen: false, tourDone: false },
    privacy: { analytics: 'unset' },
  };
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** Upgrades older saved formats to the current one. */
export function migrate(raw: unknown): Raw {
  const s = { ...obj(raw) };
  const version = typeof s.version === 'number' ? s.version : 1;
  if (version < 2) {
    // v1 (0.1–0.4) had no version, theme or privacy; layers/voice could be missing.
    s.settings = { ...obj(s.settings), theme: 'auto' };
    s.privacy = { analytics: 'unset' };
  }
  s.version = STATE_VERSION;
  return s;
}

/** Reads a saved state (any version, possibly damaged) into a valid one. */
export function restore(raw: unknown, firstScenario: ScenarioSpec): Persisted {
  const d = defaults(firstScenario);
  const s = migrate(raw);
  const p = obj(s.profile);
  const st = obj(s.settings);
  const lay = obj(st.layers);
  const voice = obj(st.voice);
  const w = obj(s.working);
  const ob = obj(s.onboarding);
  const pr = obj(s.privacy);
  const last = obj(w.lastLesson);
  const draft = validateScenario(w.draft);
  return {
    version: STATE_VERSION,
    profile: {
      handedness: oneOf(p.handedness, ['right', 'left'] as const, d.profile.handedness),
      backhand: oneOf(p.backhand, ['two_handed', 'one_handed'] as const, d.profile.backhand),
      heightCm: num(p.heightCm, 140, 205, d.profile.heightCm),
      level: oneOf(p.level, ['beginner', 'intermediate', 'advanced'] as const, d.profile.level),
      language: oneOf(p.language, ['ru', 'uk', 'en'] as const, d.profile.language),
    },
    settings: {
      camera: oneOf(st.camera, ['top', 'side', 'back', 'opponent', 'free', 'contact'] as const, d.settings.camera),
      layers: Object.fromEntries(Object.entries(d.settings.layers).map(([k, v]) => [k, bool(lay[k], v)])) as unknown as Layers,
      quality: oneOf(st.quality, ['auto', 'high', 'low'] as const, d.settings.quality),
      rate: oneOf(st.rate as never, [0.1, 0.25, 0.5, 1, 2] as never[], d.settings.rate as never),
      voice: { enabled: bool(voice.enabled, d.settings.voice.enabled), rate: num(voice.rate, 0.7, 1.5, d.settings.voice.rate) },
      theme: oneOf(st.theme, ['auto', 'dark', 'light'] as const, d.settings.theme),
    },
    working: {
      lastLesson: typeof last.id === 'string' && typeof last.mode === 'string' ? { id: last.id, mode: last.mode } : null,
      draft: draft.ok ? draft.value : d.working.draft,
    },
    onboarding: { welcomeSeen: bool(ob.welcomeSeen, false), tourDone: bool(ob.tourDone, false) },
    privacy: { analytics: oneOf(pr.analytics, ['unset', 'granted', 'denied'] as const, 'unset') },
  };
}
