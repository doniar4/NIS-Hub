# NIS Hub — честное промо

Сначала прочитайте [source-audit.md](source-audit.md). Показано проверенное production-состояние, не предполагаемые возможности кода. Каталог пуст; Reader/AI/SMS/переписки исключены.

## Готовый результат

[nis-hub-promo.mp4](nis-hub-promo.mp4) — 32 с, 1920×1080, 60 fps, без аудио. Полное декодирование, воспроизведение/перемотка в Chromium и визуальная проверка пройдены.

Использованный run: `assets/2026-09-30T03-31-28-757Z/`. В нём находятся manifest, реальные screenshots/recordings и итоговый contact sheet. Отчёт воспроизведения: [playback-verification.json](playback-verification.json).

## Точные команды

Из корня репозитория; требуются установленные зависимости проекта, Node.js и ffmpeg/ffprobe. Проверено с Homebrew ffmpeg 9.0.2.

```bash
# Только если инструменты отсутствуют:
brew install ffmpeg
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/nis-promo-browsers npx --no-install playwright install chromium

# Терминал 1 — отдельное окно для самостоятельного входа:
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/nis-promo-browsers node promo/open-demo.mjs

# Терминал 2 — после появления Dashboard безопасного тестового аккаунта:
PROMO_DEMO_CONFIRMED=1 node promo/capture.mjs
# Если съёмка прервалась, продолжите тот же run (не новая вкладка):
PROMO_DEMO_CONFIRMED=1 PROMO_RESUME=promo/assets/<run> node promo/capture.mjs

# Скрипт печатает MANIFEST=<путь>; используйте именно его:
bash promo/build-video.sh promo/assets/<run>/manifest.json
```

Пароль вводится только на сайте, не в чате/терминале/конфиге. Не используйте обычный пользовательский browser profile. Порт 9336 должен быть доступен только на loopback. Скрипт не экспортирует cookies или storageState.

На других машинах задайте абсолютные пути через `FFMPEG=/path/to/ffmpeg` и `FFPROBE=/path/to/ffprobe`. Chromium-окно нужно оставить открытым до завершения capture. Существующий итоговый MP4 автоматически не перезаписывается: сначала самостоятельно сохраните/переименуйте его. Новая съёмка создаёт датированную папку; `PROMO_RESUME` продолжает её по checkpoint, сохраняя уже снятые сцены. Закрытые экраны снимаются в существующей авторизованной вкладке, а не в новой вкладке или копии сессии. Перед съёмкой настоящий `/schedule` проверяется повторно.

## Выходные файлы

- `assets/<run>/route-log.json`: routes и результаты этапов, без credentials/network bodies.
- По сцене-записи: `start.png`, `end.png`, cropped JPEG frames, `frames.ffconcat`, `capture.mp4`. Welcome-hook использует настоящий `start.png` (captureKind=screenshot), не перерисованный интерфейс.
- `manifest.json` создаётся только после успешных семи сцен.
- `render-<timestamp>/`: редакционные PNG-титры и промежуточные сегменты; неудачные попытки не перезаписываются.
- `video-verification.json`: проверенные параметры конечного файла.
- `nis-hub-promo.mp4`: 32 секунды, 1920×1080, H.264/yuv420p, 60 fps, без музыки/аудио.

## Достоверность и приватность

Никаких fixtures, request mocks, setContent, подмены DOM или auth bypass. Только настоящие routes и clicks. Identity-зоны исключаются геометрически; полные compositor-кадры обрезаются в памяти до записи. HAR/trace/пароли/cookies не сохраняются. Отдельный анонимный контекст используется для welcome/themes/locales.

В Library намеренно проверяется пустой опубликованный каталог: появление новых книг требует нового аудита, а не автоматической съёмки непроверенного содержимого. Не ослабляйте assertions ради сборки. Tasks/книги не создаются, AI/SMS не вызываются, production-user data не используются.

60 fps — частота монтажного таймлайна. Compositor Chromium отдаёт кадры по изменению картинки; ffmpeg приводит footage к постоянной частоте и добавляет плавное движение. Native 60-fps съёмка интерфейса не заявляется. Монтаж сокращает время ожидания: вся записанная последовательность действий укладывается в сцену с удержанием последнего настоящего кадра. Это не демонстрация скорости сети или производительности приложения.

## Верификация

```bash
node --check promo/capture.mjs
node --check promo/render.mjs
node --check promo/open-demo.mjs
node --check promo/verify-video.mjs
npx --no-install eslint promo/*.mjs
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/nis-promo-browsers node promo/verify-video.mjs
bash -n promo/build-video.sh
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration -of json promo/nis-hub-promo.mp4
```

`verify-video.mjs` полностью декодирует MP4 через ffmpeg, затем открывает его в Chromium: проверяет реальное воспроизведение, размер/длительность, seek на 29 с и окончание. Отчёт: `playback-verification.json`.

Ожидается: 1920×1080, 60/1, 1920 кадров, 32 секунды. Вручную проверить screenshots и переходы на отсутствие имени/фото и вымышленных функций. Само приложение, БД/RLS, существующие пользовательские файлы вне `promo/` не меняются. Неудачные дубль/монтаж из этой работы изолированы в приватной временной папке, не удалены и не входят в итоговые assets.
