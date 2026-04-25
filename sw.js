// AI App Dojo - Service Worker
// バージョンを変えるとキャッシュが更新される
const CACHE_VERSION = 'dojo-v1';
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
      // 個別にキャッシュ追加（一つ失敗しても他は続ける）
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch((err) => {
          console.log('Cache failed for:', url, err);
        }))
      );
    })
  );
  self.skipWaiting();
});

// アクティブ化時：古いキャッシュを削除
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

// フェッチ時：キャッシュ優先・なければネットワーク
self.addEventListener('fetch', (event) => {
  // GETリクエストのみ対応
  if (event.request.method !== 'GET') return;

  // バックエンドAPIへのリクエストはキャッシュしない（常にネットワーク）
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/') || url.hostname.includes('anthropic') || url.hostname.includes('workers.dev')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 成功したレスポンスのみキャッシュ
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // オフライン時、HTMLリクエストならdojo.htmlを返す
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./dojo.html');
        }
      });
    })
  );
});
