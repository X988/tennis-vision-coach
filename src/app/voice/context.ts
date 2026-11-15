import { createContext, useContext } from 'react';
import { SayOptions } from './speaker';

export interface VoiceApi {
  /** The device can synthesise speech. */
  supported: boolean;
  /** Supported and switched on by the learner. */
  enabled: boolean;
  say: (text: string, opts?: SayOptions) => void;
  stop: () => void;
}

export const VoiceContext = createContext<VoiceApi>({ supported: false, enabled: false, say: () => undefined, stop: () => undefined });
export const useVoice = () => useContext(VoiceContext);
