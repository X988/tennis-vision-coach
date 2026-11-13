/**
 * App state: learner profile, view settings, working state (last lesson,
 * constructor draft) and progress. Settings live in localStorage (small,
 * synchronous), progress in IndexedDB (spec: "IndexedDB для прогресса").
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { AttemptRecord, ProgressSummary, summarize } from '../engines/feedback';
import { DEFAULT_PROFILE, Profile } from '../engines/profile';
import { CameraId, ScenarioSpec } from '../engines/scenario';
import { LIBRARY } from '../content/library';

export type CameraView = CameraId | 'contact';
export type Quality = 'auto' | 'high' | 'low';

export interface Layers {
  trail: boolean;
  bounce: boolean;
  footRoute: boolean;
  ghost: boolean;
  contactZone: boolean;
  direction: boolean;
}

export interface Settings {
  camera: CameraView;
  layers: Layers;
  quality: Quality;
  rate: number;
  voice: VoiceSettings;
}

export interface VoiceSettings {
  enabled: boolean;
  /** Speech rate, 1 = normal. */
  rate: number;
}

export interface WorkingState {
  lastLesson: { id: string; mode: string } | null;
  draft: ScenarioSpec;
}

const STORAGE_KEY = 'tvc.state.v1';
const PROGRESS_KEY = 'tvc.progress.v1';

const DEFAULT_SETTINGS: Settings = {
  camera: 'back',
  layers: { trail: true, bounce: true, footRoute: true, ghost: true, contactZone: true, direction: true },
  quality: 'auto',
  rate: 1,
  voice: { enabled: true, rate: 1 },
};

export interface Onboarding {
  /** The first-launch welcome has been shown. */
  welcomeSeen: boolean;
  /** The guided tour has been completed at least once. */
  tourDone: boolean;
}

interface Persisted {
  profile: Profile;
  settings: Settings;
  working: WorkingState;
  onboarding: Onboarding;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    profile: DEFAULT_PROFILE,
    settings: DEFAULT_SETTINGS,
    working: { lastLesson: null, draft: { ...LIBRARY.scenarios[0], id: 'CUSTOM_01', learning: { ...LIBRARY.scenarios[0].learning, coachApproved: false } } },
    onboarding: { welcomeSeen: false, tourDone: false },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      profile: { ...fallback.profile, ...p.profile },
      settings: { ...fallback.settings, ...p.settings, layers: { ...fallback.settings.layers, ...p.settings?.layers }, voice: { ...fallback.settings.voice, ...p.settings?.voice } },
      working: { ...fallback.working, ...p.working },
      onboarding: { ...fallback.onboarding, ...p.onboarding },
    };
  } catch {
    return fallback;
  }
}

interface Store extends Persisted {
  progress: AttemptRecord[];
  summary: ProgressSummary;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  setLayers: (l: Partial<Layers>) => void;
  setVoice: (v: Partial<VoiceSettings>) => void;
  setWorking: (w: Partial<WorkingState>) => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  addAttempt: (a: AttemptRecord) => void;
  resetProgress: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(loadPersisted);
  const [progress, setProgress] = useState<AttemptRecord[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode) — the app still works */
    }
  }, [state]);

  useEffect(() => {
    get<AttemptRecord[]>(PROGRESS_KEY)
      .then((v) => v && setProgress(v))
      .catch(() => undefined);
  }, []);

  const addAttempt = useCallback((a: AttemptRecord) => {
    setProgress((prev) => {
      const next = [...prev, a];
      set(PROGRESS_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress([]);
    del(PROGRESS_KEY).catch(() => undefined);
  }, []);

  const store = useMemo<Store>(
    () => ({
      ...state,
      progress,
      summary: summarize(progress),
      setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setSettings: (x) => setState((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      setLayers: (l) => setState((s) => ({ ...s, settings: { ...s.settings, layers: { ...s.settings.layers, ...l } } })),
      setVoice: (v) => setState((s) => ({ ...s, settings: { ...s.settings, voice: { ...s.settings.voice, ...v } } })),
      setWorking: (w) => setState((s) => ({ ...s, working: { ...s.working, ...w } })),
      setOnboarding: (o) => setState((s) => ({ ...s, onboarding: { ...s.onboarding, ...o } })),
      addAttempt,
      resetProgress,
    }),
    [state, progress, addAttempt, resetProgress],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
