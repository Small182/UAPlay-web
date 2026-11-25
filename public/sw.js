const CACHE = 'uaplay-shell-v0.5.31';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/provider-frame.js', '/episode-choices.js', '/voice-choices.js', '/desktop-layout.js', '/builtin-wallpapers.js', '/wallpapers/aurora.svg', '/wallpapers/mountains.svg', '/wallpapers/ocean.svg', '/wallpapers/space.svg', '/wallpapers/dunes.svg', '/wallpapers/geometry.svg', '/manifest.webmanifest', '/icons/icon.svg', '/data/demo.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});