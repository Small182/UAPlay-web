# UAPlay Web · PWA для iOS, Android і браузерів

**UAPlay Web v0.4.0** — незалежний вебпорт [UAPlay для Nintendo Switch](https://github.com/Small182/UAPlay-nx). Мета — адаптивний україномовний каталог із TMDB, локальним вибраним, IPTV та браузерним плеєром, що розгортається на Cloudflare Workers. Цей репозиторій не містить змін до `UAPlay-nx`.

## Можливості v0.4.0

- Switch-style інтерфейс: верхня навігація, герой-блок 222 px, ряд постерів і бірюзовий акцент, повноекранні екрани вибору джерел і картки фільму. Нижня панель підказок Switch-кнопок прибрана на вебі, щоб не займати місце.
- Фільми, серіали, аніме, мультфільми, пошук TMDB, детальна інформація, сезони й серії (для підключеного TMDB).
- Демонстраційний каталог зі знімка даних UAPlay-nx, коли ключ TMDB відсутній. Це **не** поточна база й не заміна TMDB.
- Вибране, прогрес відтворення, збережені адреси потоків, налаштування кольору акценту — локально в браузері (`localStorage`).
- Браузерний плеєр: прямі посилання на MP4 та HLS HTTPS. Safari на iOS відтворює HLS нативно; інші браузери пробують завантажити `hls.js` із CDN. Сторонні потоки можуть блокуватися CORS, обмеженнями сервісу, кодеками або недоступністю джерела.
- IPTV: відкриті M3U плейлисти iptv-org для кількох країн, обмежені HTTPS-потоками. Список каналів не гарантує можливість відтворення.
- PWA-маніфест, іконки для iOS, service worker для кешування інтерфейсу й демоданих (не відеофайлів).
- Відображення доступних легальних провайдерів перегляду за даними TMDB, якщо вони є.

> **Поточні обмеження:** доступні джерела UASerials, Eneyida, UAFilm, Mikai й AnimeON та серверний парсер прямих MP4/HLS і дозволених вбудованих плеєрів/плейлистів. Є вибір знайдених потоків і варіантів серій. Це **не гарантує** відтворення: джерела можуть захищати сторінки, вимагати авторизацію, змінювати плеєри, а браузер — блокувати потоки через CORS, кодеки, DRM чи referrer. Movy з локальним проксі, libmpv і завантаження на SD **не перенесені**. API та UI перевірені локальними тестами, але реальне відео на опублікованому Cloudflare+iOS ще не підтверджено.

## Пряма публікація ZIP у Cloudflare Pages

**Найпростіший шлях — окремий архів `UAPlay-web-cloudflare-pages-v0.4.0.zip`**. У нього вже входять `index.html`, PWA-ресурси, `_worker.js` з API. Не завантажуйте ZIP із вихідним кодом через drag-and-drop: його файли лежать не у корені.

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → **Direct Upload / Drag and drop**.
2. Завантажте саме `UAPlay-web-cloudflare-pages-v0.4.0.zip` (не розпаковуючи, якщо форма приймає ZIP).
3. Створіть проєкт та дочекайтеся успішного Deploy.
4. У проєкті **Settings → Variables and Secrets** додайте секрет `TMDB_API_KEY` (TMDB API v3, той самий тип, що на Switch) **або** `TMDB_TOKEN` (TMDB API Read Access Token v4), а для SubDL за бажанням `SUBDL_TOKEN`. Потім виконайте новий Deploy, якщо Cloudflare не застосував секрети до поточної версії.
5. Перевірте `/api/health`, `/api/providers` на вашому домені `pages.dev`. Без ключа TMDB каталог працює в деморежимі. У браузері перевірте `/api/health`: `tmdbConfigured: true` означає лише наявність ключа, а роботу зовнішнього TMDB підтверджує запит `/api/catalog?section=movies`.

Cloudflare Pages підтримує один файл `_worker.js` у Advanced Mode в архіві Direct Upload, на відміну від каталогу `/functions` (не компілюється під час drag-and-drop). Worker обробляє `/api/*`, усі інші шляхи передає `env.ASSETS.fetch(request)`.

Для такого архіву виконайте `npm run build:pages` (потрібен Python 3). **Не кладіть ключі в архів або GitHub.**

## Локальний запуск

Потрібен Node.js 20+ (рекомендовано 22).

```bash
npm install
cp .dev.vars.example .dev.vars
# Вкажіть TMDB_API_KEY (v3, 32 символи) або TMDB_TOKEN (v4) у .dev.vars
npm run dev
```

Відкрийте адресу локального Wrangler, зазвичай `http://localhost:8787`. Якщо токена немає, сайт відкриє демокаталог. Для запуску лише HTML/CSS/JS без API можна використати `npm run serve:static` (порт 8080, деморежим).

Перевірка API:

```bash
npm run check
```

## Деплой у Cloudflare Workers

У вашому Cloudflare обліковому записі має бути увімкнено Workers. Назва Worker: `uaplay-web`. Після входу через `npx wrangler login`:

```bash
npm install
npx wrangler deploy
npx wrangler secret put TMDB_API_KEY
```

У команді `secret put` вставте свій **TMDB API Key v3 (32 шістнадцяткові символи)**. Замість нього можна використати `TMDB_TOKEN` із токеном v4. Він залишається на сервері, не потрапляє в клієнтський JavaScript. Після цього сайт зможе завантажувати актуальні дані TMDB. URL після деплою буде показано Wrangler (зазвичай `https://uaplay-web.<your-subdomain>.workers.dev`). Не варто додавати токен до `wrangler.jsonc` чи комітів.

Cloudflare Workers **Static Assets** віддає `public/`, а маршрути `/api/*` обробляє `src/worker.js` (див. `wrangler.jsonc`).

## GitHub (окремий репозиторій)

1. Використовуйте створений репозиторій `Small182/UAPlay-web`.
2. Із цієї папки запустіть:

```bash
git init -b main
git add .
git commit -m "UAPlay Web PWA v0.4.0"
git remote add origin https://github.com/Small182/UAPlay-web.git
git push -u origin main
```

3. В `Settings → Secrets and variables → Actions` репозиторію задайте секрети `CLOUDFLARE_API_TOKEN` (токен з обмеженим доступом Workers Scripts:Edit) та `CLOUDFLARE_ACCOUNT_ID`. GitHub Actions запускає перевірки та публікує сайт під час push у `main`.
4. TMDB_API_KEY (v3) або TMDB_TOKEN (v4) додайте **безпосередньо до Worker**, наприклад `npx wrangler secret put TMDB_API_KEY`, або через Cloudflare Dashboard → Worker → Settings → Variables and Secrets. Це інший секрет, ніж обліковий токен GitHub Actions.

Якщо локальний репозиторій уже існує, не виконуйте повторно `git init` і обережно перевірте віддалений `origin`.

## Як додати на iPhone

1. Відкрийте **розгорнутий HTTPS-сайт** у Safari.
2. Натисніть «Поділитися» → «На початковий екран» → «Додати».
3. UAPlay запускається з власної іконки в окремому вікні. Для перегляду потоків потрібен доступ до інтернету, лише оболонка і демодані кешуються офлайн.

## Додаткові API зі Switch

- `/api/providers` — список 7 доступних джерел і їхніх можливостей.
- `/api/providers/search?provider=mikai&q=...` — серверний пошук у джерелі за назвою; потрібне ім’я джерела.
- `/api/providers/media?provider=mikai&id=...` — спроба отримати прямі MP4/HLS із структурованих API Mikai/AnimeON або дозволених HTML/iframe сторінок п’яти інших джерел; вибір потоків і серій у вебінтерфейсі.
- `/api/wallpapers?q=...` — публічні SFW-зображення Wallhaven.
- `/api/subtitles?type=movie&id=123&language=uk` — пошук текстових субтитрів через SubDL (`SUBDL_TOKEN` у Cloudflare Secrets).
- `/api/switch-release` — поточний реліз UAPlay-nx із GitHub.
- `/api/catalog`, `/api/search`, `/api/title/*`, `/api/iptv` — каталог та IPTV, як у попередній версії.

Це адаптація API, а не байтове копіювання C/libcurl. Якість стороннього пошуку без живого доступу до джерел не підтверджена.

## Керування у вебверсії

- Дотик/клік на постер, вкладку чи кнопку — відповідна дія; гортання постерів пальцем/мишею.
- У плеєрі дотик або клік на відео показує/ховає панель із перемотуванням, кнопками ◀ ▶ та Play/Pause.
- Клавіатура в плеєрі: `Пробіл`/`K` — пауза; `←`/`→` — ±10 с; `↑`/`↓` — ±60 с; `F` — повний екран; `M` — звук; `Esc` — закрити.
- Загальні клавіші: `Tab` / `Shift+Tab` для навігації фокусом, `Enter` для активації кнопок, `/` — пошук; на головній `↑`/`↓` перемикає добірку.
- Декоративну нижню панель `L/R/A/B/X` з Nintendo Switch в вебверсії прибрано: всі дії доступні через мишу, екран чи клавіатуру.

## Безпека та обмеження

- API не є універсальним proxy: сервер викликає лише заздалегідь визначені зовнішні джерела (TMDB, IPTV-org, SubDL, Wallhaven, GitHub та названі сервіси пошуку). Токен TMDB зберігається у Worker secrets.
- Клієнт надсилає відео напряму до введеної користувачем HTTPS-адреси. Це **не** обхід CORS, DRM, авторизації чи політик відеосервісу.
- IPTV-канали завантажуються з [iptv-org](https://github.com/iptv-org/iptv), незалежного стороннього каталогу. Доступність залежить від джерел та прав на контент.
- Без акаунта вибране/історія живуть тільки в конкретному браузері й можуть зникнути після очищення даних Safari.
- UAPlay не розповсюджує відеоконтент. Використовуйте лише легальні потоки та відео, на перегляд яких маєте право.
- Атрибуція TMDB: *This product uses the TMDB API but is not endorsed or certified by TMDB.*

## Структура

```
public/               PWA-інтерфейс, CSS, JS, іконки, демодані, SW
src/worker.js          Cloudflare Worker API
wrangler.jsonc         Конфігурація Workers Static Assets
tests/                 API тести на node:test
.github/workflows/     Автоматична перевірка й деплой
```

## Ліцензія

Вміст цього прототипу розроблений спеціально для UAPlay Web. Дані TMDB, логотипи та постери мають власні умови використання; права на них не переходять до цього проєкту.
