import type { Dict } from './ru';

/** Ukrainian (partial — missing keys fall back to Russian). */
export const uk: Dict = {
  app: { tagline: 'Інтерактивний 3D-тренажер ігрових ситуацій' },
  nav: { home: 'Головна', library: 'Бібліотека', constructor: 'Конструктор', progress: 'Прогрес', profile: 'Профіль', back: 'Назад' },
  home: { start: 'Почати тренування', continue: 'Продовжити урок', quick: 'Швидкий сценарій', progress: 'Ваш прогрес' },
  lesson: { modeWatch: 'Розбір', modeDecide: 'Обери рішення', modeCompare: 'Порівняння', next: 'Наступний сценарій', retry: 'Ще раз' },
  stance: { open: 'Відкрита', semi_open: 'Напіввідкрита', neutral: 'Нейтральна', closed: 'Закрита' },
  verdict: { recommended: 'Рекомендовано', acceptable: 'Допустимо', not_recommended: 'Не рекомендовано' },
  shot: { forehand: 'Форхенд', backhand: 'Бекхенд' },
  profile: { title: 'Профіль учня', handedness: 'Провідна рука', language: 'Мова', level: 'Рівень', height: 'Зріст' },
  handedness: { right: 'Правша', left: 'Шульга' },
};
