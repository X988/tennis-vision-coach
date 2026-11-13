import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../../content/library';
import { ru } from '../i18n/ru';
import { STEP_ROUTES, TOUR_LESSON_ID, TOUR_STEPS } from './steps';

const tourTexts = ru.tour as unknown as Record<string, { title?: string; text?: string }>;

describe('guided tour', () => {
  it('every step has a title and an explanation', () => {
    for (const s of TOUR_STEPS) {
      expect(tourTexts[s.id]?.title, s.id).toBeTruthy();
      expect(tourTexts[s.id]?.text, s.id).toBeTruthy();
    }
  });

  it('step ids are unique and every step except the last highlights something', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    for (const s of TOUR_STEPS.slice(0, -1)) expect(s.target, s.id).toBeTruthy();
    expect(TOUR_STEPS.some((s) => s.id === 'voice')).toBe(true);
  });

  it('visits every screen and uses an existing lesson', () => {
    expect(LIBRARY.scenarios.some((s) => s.id === TOUR_LESSON_ID)).toBe(true);
    const routes = new Set(STEP_ROUTES.map((r) => r.replace(/\?.*/, '').replace(/^#\/?/, '').split('/')[0]));
    for (const screen of ['', 'lesson', 'constructor', 'library', 'progress', 'profile']) expect(routes).toContain(screen);
    for (const mode of ['decide', 'watch', 'compare']) expect(STEP_ROUTES.some((r) => r.endsWith(`mode=${mode}`))).toBe(true);
  });
});
