import { useEffect, useRef } from 'react';
import { onError } from '../platform/errors';
import { onBackground } from '../platform/events';
import { useStore } from '../store';
import { analyticsConfigured, flush, setConsent, setContext, track } from './analytics';

/** Connects consent and app context to the analytics module; sends app_open once per launch. */
export function AnalyticsBridge() {
  const { privacy, profile, settings } = useStore();
  const opened = useRef(false);
  const granted = privacy.analytics === 'granted' && analyticsConfigured();

  useEffect(() => {
    setConsent(granted);
    if (granted && !opened.current) {
      opened.current = true;
      track('app_open');
    }
  }, [granted]);

  useEffect(() => {
    setContext({ lang: profile.language, level: profile.level, hand: profile.handedness, backhand: profile.backhand, theme: settings.theme, voice: String(settings.voice.enabled) });
  }, [profile, settings.theme, settings.voice.enabled]);

  useEffect(() => onBackground(() => flush()), []);
  useEffect(() => onError((e) => track('error', { kind: e.kind, message: e.message, route: e.route })), []);
  return null;
}
