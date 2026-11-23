# UAPlay Web · PWA для iOS, Android і браузерів

**UAPlay Web v0.2.0** — незалежний вебпорт [UAPlay для Nintendo Switch](https://github.com/Small182/UAPlay-nx). Мета — адаптивний україномовний каталог із TMDB, локальним вибраним, IPTV та браузерним плеєром, що розгортається на Cloudflare Workers. Цей репозиторій не містить змін до `UAPlay-nx`.

## Можливості v0.2.0

- Switch-style інтерфейс: оригінальна верхня навігація, герой-блок висотою 222 px, ряд постерів, панель кнопок, бірюзовий акцент та адаптація для iPhone.
- Фільми, серіали, аніме, мультфільми, пошук TMDB, детальна інформація, сезони й серії (для підключеного TMDB).
- Демонстраційний каталог зі знімка даних UAPlay-nx, коли ключ TMDB відсутній. Це **не** поточна база й не заміна TMDB.
- Вибране, прогрес відтворення, збережені адреси потоків, три кольори акценту — локально в браузері (`localStorage`).
- Браузерний плеєр: прямі посилання на MP4 та HLS HTTPS. Safari на iOS відтворює HLS нативно; інші браузери пробують завантажити `hls.js` із CDN. Сторонні потоки можуть блокуватися CORS, обмеженнями сервісу, кодеками або недоступністю джерела.
- IPTV: відкриті M3U плейлисти iptv-org для кількох країн, обмежені HTTPS-потоками. Список каналів не гарантує можливість відтворення.
- PWA-маніфест, іконки для iOS, service worker для кешування інтерфейсу й демоданих (не відеофайлів).
- Відображення доступних легальних провайдерів перегляду за даними TMDB, якщо вони є.

> **Не реалізовано в v0.1.0:** автоматичний пошук відеопотоків у джерелах Switch-версії (UAFlix, UASerials тощо), перенесення `libmpv`, автоматичне завантаження відео, синхронізація акаунтів. Плеєр вимагає пряме HTTPS-посилання або IPTV-потік. Це ранній робочий прототип, не повний функціональний аналог Switch.

## Локальний запуск

Потрібен Node.js 20+ (рекомендовано 22).

```bash
npm install
cp .dev.vars.example .dev.vars
# Вкажіть власний TMDB API Read Access Token у .dev.vars
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
npx wrangler secret put TMDB_TOKEN
```

У команді `secret put` вставте **TMDB API Read Access Token (v4)**. Він залишається на сервері, не потрапляє в клієнтський JavaScript. Після цього сайт зможе завантажувати актуальні дані TMDB. URL після деплою буде показано Wrangler (зазвичай `https://uaplay-web.<your-subdomain>.workers.dev`). Не варто додавати токен до `wrangler.jsonc` чи комітів.

Cloudflare Workers **Static Assets** віддає `public/`, а маршрути `/api/*` обробляє `src/worker.js` (див. `wrangler.jsonc`).

## GitHub (окремий репозиторій)

1. Використовуйте створений репозиторій `Small182/UAPlay-web`.
2. Із цієї папки запустіть:

```bash
git init -b main
git add .
git commit -m "Initial UAPlay Web PWA v0.1.0"
git remote add origin https://github.com/Small182/UAPlay-web.git
git push -u origin main
```

3. У `Settings → Secrets and variables → Actions` цього репозиторію задайте секрети `CLOUDFLARE_API_TOKEN` (токен з обмеженим доступом Workers Scripts:Edit) та `CLOUDFLARE_ACCOUNT_ID`. GitHub Actions запускає перевірки та публікує сайт під час push у `main`.
4. Якщо секрети Cloudflare ще не задано, GitHub Actions виконує тільки тести й пропускає публікацію. TMDB_TOKEN додайте **безпосередньо до Worker**, наприклад `npx wrangler secret put TMDB_TOKEN`, або через Cloudflare Dashboard → Worker → Settings → Variables and Secrets. Це інший секрет, ніж обліковий токен GitHub Actions.

Якщо локальний репозиторій уже існує, не виконуйте повторно `git init` і обережно перевірте віддалений `origin`.

## Як додати на iPhone

1. Відкрийте **розгорнутий HTTPS-сайт** у Safari.
2. Натисніть «Поділитися» → «На початковий екран» → «Додати».
3. UAPlay запускається з власної іконки в окремому вікні. Для перегляду потоків потрібен доступ до інтернету, лише оболонка і демодані кешуються офлайн.

## Безпека та обмеження

- API не є універсальним proxy: зовнішній сервер викликає лише TMDB та IPTV-org. Токен TMDB зберігається у Worker secrets.
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