// 오프라인 캐시: 한 번 열면 인터넷 없이도 실행. build.sh가 VERSION을 자동으로 올림.
const VERSION = 'lunar-202611081425';
const FILES = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/days.js', 'js/lunar.js', 'manifest.webmanifest',
  'fonts/NanumPenScript.ttf', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
