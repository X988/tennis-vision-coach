/**
 * Speech output with priorities. A cue of lower priority never interrupts a
 * more important one that is still being spoken (a phase name must not cut
 * off the explanation of the learner's answer); an equal or higher one
 * replaces it. Backend-agnostic, so it can be unit tested.
 */
export interface SpeechBackend {
  supported(): boolean;
  /** Resolves when the utterance has finished (or failed). */
  speak(text: string, lang: string, rate: number): Promise<void>;
  stop(): void;
}

export const PRIORITY = { cue: 1, phase: 2, lesson: 3, tour: 4 } as const;

export interface SayOptions {
  priority?: number;
  rate?: number;
}

export class Speaker {
  private current: { priority: number; token: number } | null = null;
  private token = 0;

  constructor(private backend: SpeechBackend) {}

  get supported() {
    return this.backend.supported();
  }

  get speaking() {
    return this.current !== null;
  }

  /** Returns false if the text was dropped (unsupported, empty or something more important is speaking). */
  say(text: string, { priority = PRIORITY.cue, rate = 1 }: SayOptions = {}): boolean {
    const spoken = forSpeech(text);
    if (!spoken || !this.backend.supported()) return false;
    if (this.current && this.current.priority > priority) return false;
    if (this.current) this.backend.stop();
    const token = ++this.token;
    this.current = { priority, token };
    const done = () => {
      if (this.current?.token === token) this.current = null;
    };
    this.backend.speak(spoken, speechLang(spoken), rate).then(done, done);
    return true;
  }

  stop() {
    this.token++;
    this.current = null;
    if (this.backend.supported()) this.backend.stop();
  }
}

/** Language tag for the synthesiser, from the text itself (dictionaries may fall back to Russian). */
export function speechLang(text: string): string {
  if (/[іїєґ]/i.test(text)) return 'uk-UA';
  if (/[а-яё]/i.test(text)) return 'ru-RU';
  return 'en-US';
}

const REPLACEMENTS: [RegExp, string][] = [
  [/split-step/gi, 'сплит-степ'],
  [/(\d)\s*×/g, '$1 икс'],
  [/360°/g, '360 градусов'],
  [/(\d)°/g, '$1 градусов'],
  [/\b3D\b/g, 'три дэ'],
  [/\bJSON\b/g, 'джейсон'],
  [/≈/g, 'примерно'],
  [/→/g, ', '],
  [/[«»"()]/g, ''],
  [/\s·\s/g, ', '],
  [/\s[—–]\s/g, ', '],
  [/\s+/g, ' '],
];

/** Text as it should be pronounced: symbols and English terms a Russian voice reads badly are spelled out. */
export function forSpeech(text: string): string {
  let out = text;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out.trim();
}
