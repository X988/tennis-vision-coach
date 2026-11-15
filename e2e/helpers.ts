import { Page, expect } from '@playwright/test';

/** A speech synthesiser that records what the app says instead of playing it. */
export async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    const synth = {
      getVoices: () => [{ lang: 'ru-RU' }],
      speak(u: { text: string; onend?: () => void }) {
        w.__spoken.push(u.text);
        setTimeout(() => u.onend?.(), 30);
      },
      cancel() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (this: { text: string }, text: string) {
      this.text = text;
    };
  });
}

/** Start as a returning learner: welcome and tour already seen. */
export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('tvc.state.v1')) localStorage.setItem('tvc.state.v1', JSON.stringify({ version: 2, onboarding: { welcomeSeen: true, tourDone: true } }));
  });
}

/** Collects uncaught page errors; call `check()` at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return { check: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** Answers every question of a lesson with the first option. */
export async function answerAll(page: Page) {
  const decision = page.locator('[data-tour="decision"]');
  while (await decision.isVisible().catch(() => false)) {
    await decision.locator('.option').first().click();
    await decision.locator('button.primary').click();
    await page.waitForTimeout(300);
  }
}
