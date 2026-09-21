// Service Worker
// A versão é atualizada automaticamente pelo deploy.yml a cada push no GitHub Pages.
const CACHE_VERSION = '21.09.2026-0852';
const CACHE_NAME = `album-baron-${CACHE_VERSION}`;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './fotos/manifest.json',
  './fotos/familia.mp3',
  './fotos/capa.webp'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.all(
        CORE.map(url => fetch(url, { cache: 'reload' }).then(res => res.status === 200 && c.put(url, res)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // HTML: network-first (garante versão nova do app)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then(res => {
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(r => r || caches.match('./index.html'))
      )
    );
    return;
  }

  // manifest.json das fotos: network-first — assim uma foto nova aparece
  // assim que o manifest for publicado, sem esperar o app inteiro atualizar.
  // A chave do cache ignora a query (?t=...), senão o fallback offline não
  // encontra a entrada e o cache cresce a cada abertura.
  if (url.pathname.endsWith('/fotos/manifest.json')) {
    const key = url.origin + url.pathname;
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then(res => {
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(key, copy));
        }
        return res;
      }).catch(() => caches.match(key))
    );
    return;
  }

  // Mídia (/fotos/): cache-first — toca na hora, offline ou online.
  // 'reload' força ignorar o cache HTTP do disco quando não achou em CacheStorage,
  // senão o navegador pode devolver uma versão antiga da imagem por baixo do pano.
  if (url.pathname.includes('/fotos/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request, { cache: 'reload' }).then(res => {
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Resto (css/js/imagens locais): cache-first com atualização em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request, { cache: 'reload' }).then(res => {
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
