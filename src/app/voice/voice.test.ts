import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../content/library';
import { judge } from '../../engines/feedback';
import { buildPlan } from '../../engines/plan';
import { DEFAULT_PROFILE } from '../../engines/profile';
import { translate } from '../i18n';
import { compareCue, phaseCue, primaryPhase, questionCue, resultCue, tourCue } from './narration';
import { PRIORITY, Speaker, SpeechBackend, forSpeech, speechLang } from './speaker';
import { TOUR_STEPS } from '../tour/steps';

const t = (key: string, params?: Record<string, string | number>) => translate('ru', key, params);
const scenario = LIBRARY.scenarios.find((s) => s.id === 'FH_MEDIUM_NEUTRAL_01')!;
const plan = buildPlan(scenario, DEFAULT_PROFILE);

class FakeBackend implements SpeechBackend {
  spoken: string[] = [];
  stops = 0;
  private finish: (() => void) | null = null;
  supported() {
    return true;
  }
  speak(text: string) {
    this.spoken.push(text);
    return new Promise<void>((r) => (this.finish = r));
  }
  stop() {
    this.stops++;
  }
  end() {
    this.finish?.();
  }
}

describe('Speaker priorities', () => {
  it('a phase name does not interrupt the explanation of an answer', () => {
    const b = new FakeBackend();
    const s = new Speaker(b);
    expect(s.say('Объяснение ответа', { priority: PRIORITY.lesson })).toBe(true);
    expect(s.say('Контакт', { priority: PRIORITY.cue })).toBe(false);
    expect(b.spoken).toEqual(['Объяснение ответа']);
  });

  it('a more important or equal cue replaces the current one', () => {
    const b = new FakeBackend();
    const s = new Speaker(b);
    s.say('Контакт', { priority: PRIORITY.cue });
    expect(s.say('Шаг обучения', { priority: PRIORITY.tour })).toBe(true);
    expect(b.stops).toBe(1);
    expect(b.spoken).toHaveLength(2);
  });

  it('low priority cues are spoken again once the important one has finished', async () => {
    const b = new FakeBackend();
    const s = new Speaker(b);
    s.say('Объяснение', { priority: PRIORITY.lesson });
    b.end();
    await Promise.resolve();
    expect(s.speaking).toBe(false);
    expect(s.say('Контакт', { priority: PRIORITY.cue })).toBe(true);
  });

  it('stop silences and frees the queue', () => {
    const b = new FakeBackend();
    const s = new Speaker(b);
    s.say('Длинный текст', { priority: PRIORITY.tour });
    s.stop();
    expect(s.speaking).toBe(false);
    expect(s.say('Контакт')).toBe(true);
  });
});

describe('speech text', () => {
  it('spells out symbols and terms a Russian voice reads badly', () => {
    expect(forSpeech('Split-step → «Разбор» на 0,25×')).toBe('сплит-степ , Разбор на 0,25 икс');
    expect(forSpeech('Свободно 360°')).toBe('Свободно 360 градусов');
  });

  it('picks the language from the text', () => {
    expect(speechLang('Контакт')).toBe('ru-RU');
    expect(speechLang('Обери рішення')).toBe('uk-UA');
    expect(speechLang('Contact')).toBe('en-US');
  });
});

describe('narration', () => {
  it('names only key phases at normal speed, all phases in slow motion, and explains when paused', () => {
    expect(phaseCue(t, 'contact', true, 1)).toBe('Контакт');
    expect(phaseCue(t, 'movement', true, 1)).toBeNull();
    expect(phaseCue(t, 'movement', true, 0.25)).toBe('К мячу');
    expect(phaseCue(t, 'contact', false, 1)).toContain('Встреча с мячом');
  });

  it('primary phase follows the timeline and reaches contact at the contact time', () => {
    expect(primaryPhase(plan, 0)?.id).toBe('ready');
    expect(primaryPhase(plan, plan.contact.t)?.id).toBe('contact');
    const turn = plan.phases.find((p) => p.id === 'read_turn')!;
    expect(primaryPhase(plan, turn.start + 0.01)?.id).toBe('read_turn');
    expect(primaryPhase(plan, plan.duration)?.id).toBe('recovery');
  });

  it('every phase has a spoken name', () => {
    for (const p of plan.phases) if (p.id !== 'feedback') expect(t(`voice.phase.${p.id}`)).not.toContain('voice.phase');
  });

  it('reads the question, the judgement with the recommended answer, and the comparison', () => {
    expect(questionCue(t, 'stance', 1, 2)).toBe('Вопрос 1 из 2. Какую стойку выбрать для удара?');
    const wrong = resultCue(t, [judge(plan, 'stance', 'closed')]);
    expect(wrong).toContain('Ваш ответ: Закрытая');
    expect(wrong).toContain('Рекомендуется: Полуоткрытая');
    const right = resultCue(t, [judge(plan, 'stance', plan.stance)]);
    expect(right).toContain('рекомендуется.');
    expect(right).not.toContain('Рекомендуется:');
    const bad = buildPlan(scenario, DEFAULT_PROFILE, { variant: 'late_prep' });
    expect(compareCue(t, bad)).toContain('Поздняя подготовка');
  });

  it('no narration text leaks an untranslated key', () => {
    const texts = [...TOUR_STEPS.map((s) => tourCue(t, s.id)), resultCue(t, [judge(plan, 'first_step', 'back')]), compareCue(t, buildPlan(scenario, DEFAULT_PROFILE, { variant: 'wrong_stance' }))];
    for (const x of texts) expect(x).not.toMatch(/\b(tour|voice|reason|variant|q|lesson)\.[a-z_]+/i);
  });
});
