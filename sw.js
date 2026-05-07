// AI App Dojo - Service Worker
// バージョンを変えるとキャッシュが更新される
const CACHE_VERSION = 'dojo-v6'; // ← 更新するたびにここを変える
const ASSETS_TO_CACHE = [
  './',
  './dojo.html',
  './terms.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// インストール時：必要なファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch((err) => {
          console.log('Cache failed for:', url, err);
        }))
      );
    })
  );
  self.skipWaiting();
});

// アクティブ化時：古いキャッシュを全削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// フェッチ時：ネットワーク優先 → 失敗時だけキャッシュ（オフライン対応）
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // APIリクエストは絶対にキャッシュしない
  const url = new URL(event.request.url);
  if (
    url.pathname.includes('/api/') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('workers.dev')
  ) {
    return;
  }

  event.respondWith(
    // ネットワーク優先：まず最新を取りに行く
    fetch(event.request)
      .then((response) => {
        // 取得成功 → キャッシュを最新に更新してから返す
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワーク失敗（オフライン）→ キャッシュから返す
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // HTMLリクエストならdojo.htmlをフォールバック
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./dojo.html');
          }
        });
      })
  );
});
