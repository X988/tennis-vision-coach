# Публикация в Google Play и App Store

Что уже готово в репозитории и что можете сделать только вы (аккаунты, ключи, оплата).

## Сборки

| Что | Где | Для чего |
| --- | --- | --- |
| Тестовый APK (`*-test.apk`) | Releases → `apk-N`, Actions → Android → `test-apk` | Установка на свой телефон, показ тренеру |
| Релизный AAB (`*-release.aab`) | Actions → Android → `google-play-aab` (появляется после настройки ключа) | Загрузка в Google Play |
| Проверка iOS | Actions → iOS | Проект компилируется для iPhone/iPad |

- Android: Capacitor 8, target/compile SDK **36**, minSdk 24 (Android 7.0+).
- Версия: `versionName` = `version` из `package.json`; `versionCode` = номер сборки × 10 (растёт с каждой сборкой, как требует Play).
- iOS: минимум iOS 15; есть `PrivacyInfo.xcprivacy` и `ITSAppUsesNonExemptEncryption = false`.

## Google Play

1. **Аккаунт разработчика** — play.google.com/console, разовый взнос $25, проверка личности. Для личного аккаунта Google требует закрытое тестирование (12+ тестировщиков, 14 дней) до выхода в продакшен.
2. **Ключ загрузки (upload key)** — один раз на своём компьютере (нужна Java):
   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.jks > upload.jks.b64   # macOS: base64 -i upload.jks -o upload.jks.b64
   ```
   **Храните `upload.jks` и пароль надёжно** (менеджер паролей + резервная копия). В репозиторий не кладите.
3. **Секреты GitHub** — Settings → Secrets and variables → Actions → New repository secret:
   - `ANDROID_KEYSTORE_BASE64` — содержимое `upload.jks.b64`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`
4. Запустите Actions → **Android** → *Run workflow* и скачайте артефакт `google-play-aab`.
5. В Play Console: создайте приложение (`com.tennisvisioncoach.app`), включите **Play App Signing** (по умолчанию), загрузите AAB в трек *Internal testing*, затем *Closed testing*.
6. **Обязательные разделы Play Console**:
   - *Privacy policy* — публичная ссылка (см. ниже «Политика конфиденциальности»).
   - *Data safety* — ответы ниже.
   - *Content rating* — анкета IARC: обучающее спортивное приложение, без насилия, без общения пользователей, без покупок → рейтинг «3+ / Для всех».
   - *Target audience* — 13+ (или «18+», если не хотите требований Families Policy).
   - *Ads* — «Нет рекламы».
   - *Store listing* — название, описания, иконка 512×512 (`assets/icon-only.png`), feature graphic 1024×500, скриншоты телефона (минимум 2) и планшета.

### Ответы для раздела Data safety

| Вопрос | Ответ |
| --- | --- |
| Собирает ли приложение данные? | Да — только если включена аналитика (ключ `ANALYTICS_KEY` задан) |
| Типы | *App activity → App interactions*; *App info and performance → Crash logs, Diagnostics* |
| Связаны с пользователем? | Нет (случайный идентификатор установки, без аккаунта) |
| Обязательно? | Нет, по согласию (opt-in) |
| Цель | Analytics, App functionality (поиск ошибок) |
| Передача третьим лицам | Нет (PostHog — обработчик данных по поручению) |
| Шифрование при передаче | Да (HTTPS) |
| Можно удалить? | Да: «Конфиденциальность → Удалить все мои данные», отзыв согласия удаляет идентификатор |

Если аналитика не настроена — «Приложение не собирает данные».

## App Store (iPhone / iPad)

Собрать и отправить в App Store можно только на **Mac с Xcode 16+**.

1. Аккаунт **Apple Developer Program** ($99/год).
2. На Mac: `npm ci && npm run build:ios`, затем откройте `ios/App/App.xcodeproj` в Xcode.
3. *Signing & Capabilities* → выберите свою команду (Team); Bundle ID `com.tennisvisioncoach.app`.
4. В App Store Connect создайте приложение с тем же Bundle ID.
5. Xcode → *Product → Archive* → *Distribute App* → App Store Connect → TestFlight → ревью.
6. **App Privacy** в App Store Connect: «Usage Data → Product Interaction» и «Diagnostics → Crash Data», не связаны с пользователем, не для отслеживания (совпадает с `PrivacyInfo.xcprivacy`). Без ключа аналитики — «Data Not Collected».
7. Скриншоты: iPhone 6.9" и iPad 13".

Голос на iOS работает через системный синтез речи (плагин Capacitor), ничего дополнительно настраивать не нужно.

## Политика конфиденциальности

Текст — `docs/PRIVACY.md` (тот же, что на экране «Конфиденциальность» в приложении). Для магазинов нужна **публичная ссылка**:
- репозиторий публичный → ссылка на файл в GitHub;
- иначе — опубликуйте текст на своём сайте, в Google Docs («Опубликовать в интернете») или на GitHub Pages.

Укажите адрес поддержки: переменная `SUPPORT_EMAIL` (Settings → Secrets and variables → Actions → *Variables*) — он появится на экране «Конфиденциальность».

## Аналитика

См. `docs/ANALYTICS.md`. Без секрета `ANALYTICS_KEY` приложение ничего не отправляет и не спрашивает согласие.

## Что ещё нужно до коммерческого релиза

- Проверка методики и 12 сценариев тренером (`coachApproved: true`) — см. `docs/ACCEPTANCE.md`.
- Тест на реальных устройствах: слабый Android (2–3 ГБ ОЗУ), современный Android, iPhone, iPad.
- Материалы магазина: тексты, скриншоты, feature graphic.
- Перевод на английский и украинский (сейчас частичный), если продавать за пределами русскоязычной аудитории.
