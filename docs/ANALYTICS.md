# Аналитика

Анонимная статистика использования, **только с согласия** пользователя (opt-in), без личных данных.

## Как включить

1. Зарегистрируйтесь в [PostHog](https://posthog.com) (бесплатно до 1 млн событий в месяц), регион **EU**.
2. Скопируйте *Project API key* (`phc_…`). Это публичный ключ записи, он не даёт доступа к данным.
3. GitHub → Settings → Secrets and variables → Actions:
   - секрет `ANALYTICS_KEY` = `phc_…`;
   - при регионе US: переменная `ANALYTICS_HOST` = `https://us.i.posthog.com`.
4. Следующая сборка (APK/AAB) спросит согласие при первом запуске; уже установившим — баннер на главной.

Локально: `VITE_ANALYTICS_KEY=phc_… npm run build`.

## Что отправляется

Каждое событие: случайный `distinct_id` установки, `app_version`, `platform` (android/ios/web), `lang`, `level`, `hand`, `backhand`, `theme`, `voice`. Профили людей не создаются (`$process_person_profile: false`).

| Событие | Свойства | Зачем |
| --- | --- | --- |
| `app_open` | — | Активные пользователи, версии |
| `screen_view` | `screen` | Какие экраны используют |
| `welcome` | `action` (tour / skip) | Сколько начинают обучение |
| `tour_start`, `tour_step`, `tour_end` | `step`, `id`, `completed`, `steps` | Где бросают обучение |
| `lesson_open` | `scenario`, `mode`, `training` | Популярность сценариев и режимов |
| `question_answered` | `scenario`, `kind`, `verdict`, `training` | Какие решения трудные |
| `lesson_result` | `scenario`, `correct`, `acceptable`, `wrong`, `training` | Сложность сценариев |
| `compare_open` | `scenario`, `variant` | Интерес к сравнению |
| `stance_explore` | `scenario`, `stance` | Изучение стоек |
| `camera_change`, `layer_toggle`, `rate_change` | `view` / `layer`, `on` / `rate` | Как смотрят разбор |
| `voice_toggle` | `on` | Нужна ли озвучка |
| `library_filter` | `filter`, `value` | Как ищут сценарии |
| `constructor_load`, `constructor_export` | `scenario` | Использование конструктора |
| `profile_change` | `field`, `value` (рост округлён до 5 см) | Состав аудитории |
| `quality_degraded` | — | Слабые устройства (авто-снижение графики) |
| `error` | `kind`, `message`, `route` | Ошибки приложения |

## Полезные отчёты в PostHog

- **Воронка обучения:** `welcome(action=tour)` → `tour_step(step=6)` → `tour_end(completed=true)`.
- **Воронка урока:** `lesson_open(mode=decide)` → `question_answered` → `lesson_result`.
- **Сложность сценариев:** `lesson_result`, разбивка по `scenario`, среднее `wrong`.
- **Удержание:** Retention по `app_open`.
- **Ошибки:** тренд `error` по `app_version`.

## Устройство

`src/app/analytics/analytics.ts` — очередь событий в `localStorage` (переживает перезапуск и отсутствие сети), отправка пакетами по 20 событий / раз в 20 секунд / при сворачивании приложения через PostHog Batch API. Без SDK. Отзыв согласия удаляет идентификатор и неотправленную очередь. Тесты — `analytics.test.ts`, e2e проверяет, что сборка без ключа не делает внешних запросов.
