/* かけいぼ Service Worker（vite.config.ts のプラグインが dist/sw.js として出力する） */
const VERSION = '__VERSION__';
const APP_CACHE = `kakeibo-app-${VERSION}`;
const RUNTIME_CACHE = 'kakeibo-runtime-v1'; // OCRデータ・フォント（バージョンを跨いで保持）
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('kakeibo-app-') && k !== APP_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 画面遷移：ネット優先、だめならキャッシュした index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true, ignoreVary: true }).then((r) => r || caches.match('./'))),
    );
    return;
  }

  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);
  const isRuntime = path.startsWith('tesseract/') || /\.(woff2?)$/.test(path);

  // キャッシュ優先（無ければ取得してキャッシュ）
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (isRuntime || path.startsWith('assets/'))) {
          const copy = res.clone();
          caches.open(isRuntime ? RUNTIME_CACHE : APP_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
