import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { createBackend } from './backends';
import { VoiceContext, useVoice } from './context';
import { SayOptions, Speaker } from './speaker';

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { settings } = useStore();
  const [speaker] = useState(() => new Speaker(createBackend()));
  const supported = speaker.supported;
  const enabled = supported && settings.voice.enabled;
  const rate = settings.voice.rate;

  useEffect(() => {
    if (!enabled) speaker.stop();
  }, [enabled, speaker]);
  useEffect(() => () => speaker.stop(), [speaker]);

  const say = useCallback(
    (text: string, opts?: SayOptions) => {
      if (enabled) speaker.say(text, { rate, ...opts });
    },
    [enabled, rate, speaker],
  );
  const stop = useCallback(() => speaker.stop(), [speaker]);
  const api = useMemo(() => ({ supported, enabled, say, stop }), [supported, enabled, say, stop]);
  return <VoiceContext.Provider value={api}>{children}</VoiceContext.Provider>;
}

/** Sound on/off button for the navigation bar. */
export function VoiceToggle() {
  const t = useT();
  const { settings, setVoice } = useStore();
  const voice = useVoice();
  if (!voice.supported) return null;
  const on = settings.voice.enabled;
  return (
    <button
      className="voice-toggle"
      data-tour="voice-toggle"
      aria-pressed={on}
      title={on ? t('voice.turnOff') : t('voice.turnOn')}
      aria-label={on ? t('voice.turnOff') : t('voice.turnOn')}
      onClick={() => {
        setVoice({ enabled: !on });
        if (on) voice.stop();
      }}
    >
      <span aria-hidden>{on ? '🔊' : '🔇'}</span>
    </button>
  );
}
