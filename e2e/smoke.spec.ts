import { expect, test } from '@playwright/test';
import { answerAll, skipOnboarding, stubSpeech, watchErrors } from './helpers';

test.describe('first launch', () => {
  test('welcome, profile answers and the full guided tour', async ({ page }) => {
    const errors = watchErrors(page);
    await stubSpeech(page);
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Левша' }).click();
    await dialog.getByRole('button', { name: /Пройти обучение/ }).click();

    for (let guard = 0; guard < 60; guard++) {
      const card = page.locator('.tour-card');
      await expect(card).toBeVisible();
      if (await card.locator('.tour-wait').isVisible()) {
        await answerAll(page);
        await expect(card.locator('.tour-wait')).toBeHidden();
        continue;
      }
      // Every explanation step highlights a real control on screen (except the final one).
      const last = await card.getByRole('button', { name: /Готово/ }).isVisible();
      const title = await card.locator('h3').textContent();
      if (!last) await expect(page.locator('.tour-ring'), `step «${title}» highlights a control`).toBeVisible();
      await card.locator('.tour-actions button.primary').click();
      if (last) break;
    }
    await expect(page.locator('.tour')).toHaveCount(0);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('tvc.state.v1')!));
    expect(state.onboarding).toEqual({ welcomeSeen: true, tourDone: true });
    expect(state.profile.handedness).toBe('left');
    // Training mode: the tour's lesson is not counted as progress.
    await page.goto('/#/progress');
    await expect(page.getByText(/Пока нет пройденных упражнений/)).toBeVisible();
    // The tour was read aloud.
    expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length)).toBeGreaterThan(10);
    errors.check();
  });
});

test.describe('returning learner', () => {
  test.beforeEach(async ({ page }) => {
    await stubSpeech(page);
    await skipOnboarding(page);
  });

  test('lesson: answer, see the demonstration, progress is saved', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#/library');
    await page.locator('.card').first().getByRole('button', { name: 'Урок' }).click();
    await expect(page.locator('.stage canvas')).toBeVisible();
    await answerAll(page);
    await expect(page.locator('[data-tour="result"]')).toBeVisible();
    await page.getByRole('button', { name: 'Пошаговый разбор' }).click();
    await expect(page.locator('[data-tour="phase-list"]')).toBeVisible();
    await page.keyboard.press('c');
    await expect(page.locator('.tl-time')).toHaveText('контакт');
    await page.getByRole('button', { name: 'Сравнение' }).click();
    await expect(page.locator('.stage canvas')).toHaveCount(2);
    await page.goto('/#/progress');
    await expect(page.locator('.stat.attempts .stat-v')).toHaveText('1');
    errors.check();
  });

  test('every screen opens without errors', async ({ page }) => {
    const errors = watchErrors(page);
    for (const [hash, text] of [
      ['#/', 'Начать тренировку'],
      ['#/library', 'Библиотека сценариев'],
      ['#/constructor', 'Конструктор ситуации'],
      ['#/progress', 'Прогресс'],
      ['#/profile', 'Профиль ученика'],
      ['#/help', 'Справка'],
      ['#/privacy', 'Конфиденциальность'],
      ['#/lesson/NOPE?mode=watch', 'Сценарий не найден'],
    ]) {
      await page.goto(`/${hash}`);
      await expect(page.getByText(text).first()).toBeVisible();
    }
    errors.check();
  });

  test('settings survive a restart; light theme applies', async ({ page }) => {
    await page.goto('/#/profile');
    await page.getByRole('button', { name: /Светлое/ }).click();
    await page.getByRole('button', { name: 'Продвинутый' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Продвинутый' })).toHaveClass(/active/);
  });

  test('a damaged saved state does not break the app', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tvc.state.v1', '{not json'));
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('builds without an analytics key never ask for consent or send anything', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) requests.push(r.url());
    });
    await page.goto('/');
    await page.goto('/#/library');
    await expect(page.getByText('Разрешить')).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});
