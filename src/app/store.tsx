/**
 * App state: learner profile, view settings, working state (last lesson,
 * constructor draft) and progress. Settings live in localStorage (small,
 * synchronous), progress in IndexedDB (spec: "IndexedDB для прогресса").
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { AttemptRecord, ProgressSummary, summarize } from '../engines/feedback';
import { Profile } from '../engines/profile';
import { Layers, Onboarding, Persisted, Privacy, Settings, VoiceSettings, WorkingState, restore } from './persist';
import { LIBRARY } from '../content/library';

export type { CameraView, Consent, Layers, Onboarding, Privacy, Quality, Settings, Theme, VoiceSettings, WorkingState } from './persist';

const STORAGE_KEY = 'tvc.state.v1';
const PROGRESS_KEY = 'tvc.progress.v1';

function loadPersisted(): Persisted {
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    raw = null; // damaged JSON: start from defaults
  }
  return restore(raw, LIBRARY.scenarios[0]);
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
  setPrivacy: (p: Partial<Privacy>) => void;
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
      // Keep only well-formed records (an old or damaged entry must not break the Progress screen).
      .then((v) => Array.isArray(v) && setProgress(v.filter((r) => r && typeof r.scenarioId === 'string' && Array.isArray(r.results) && typeof r.at === 'string')))
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
      setPrivacy: (x) => setState((s) => ({ ...s, privacy: { ...s.privacy, ...x } })),
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
