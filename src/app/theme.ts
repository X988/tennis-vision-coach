import { useEffect, useState } from 'react';
import { useStore } from './store';

export type ResolvedTheme = 'dark' | 'light';

/** The theme in effect: the learner's choice, or the system setting when "auto". */
export function useResolvedTheme(): ResolvedTheme {
  const { settings } = useStore();
  const [systemLight, setSystemLight] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const on = () => setSystemLight(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  if (settings.theme === 'auto') return systemLight ? 'light' : 'dark';
  return settings.theme;
}

/** Colours of the 3D scene's sky and fog per theme. */
export const SKY: Record<ResolvedTheme, string> = { dark: '#0d1420', light: '#cfe1f2' };
