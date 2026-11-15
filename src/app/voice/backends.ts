import { Capacitor } from '@capacitor/core';
import { SpeechBackend } from './speaker';

/** Browsers and iOS Safari: the built-in Web Speech API. */
class WebSpeech implements SpeechBackend {
  supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  speak(text: string, lang: string, rate: number) {
    return new Promise<void>((resolve) => {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      const prefix = lang.slice(0, 2).toLowerCase();
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  stop() {
    window.speechSynthesis.cancel();
  }
}

/**
 * Android app: the system WebView has no Web Speech API, so the device's
 * text-to-speech engine is used through a Capacitor plugin (works offline).
 */
class NativeSpeech implements SpeechBackend {
  private plugin = import('@capacitor-community/text-to-speech').then((m) => m.TextToSpeech);

  supported() {
    return true;
  }

  async speak(text: string, lang: string, rate: number) {
    try {
      const tts = await this.plugin;
      await tts.speak({ text, lang, rate, pitch: 1, volume: 1, category: 'playback' });
    } catch {
      /* no voice installed for this language: stay silent, the text is on screen */
    }
  }

  stop() {
    this.plugin.then((tts) => tts.stop()).catch(() => undefined);
  }
}

export function createBackend(): SpeechBackend {
  return Capacitor.isNativePlatform() ? new NativeSpeech() : new WebSpeech();
}
