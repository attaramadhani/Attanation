/**
 * ATTA DocStudio Pro — Service Worker (Versi 3+: "Kertas dan Tinta")
 * Brand: ATTA NATION
 */

const APP_VERSION = '1.0.0';
const CACHE_NAME = `atta-docstudio-pwa-${APP_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/pdf-loader.mjs',
  './js/pdf-render.js',
  './js/vendor/pdfjs/pdf.min.mjs',
  './js/vendor/pdfjs/pdf.worker.min.mjs',
  './js/vendor/pdfjs/wasm/jbig2.wasm',
  './js/vendor/pdfjs/wasm/jbig2_nowasm_fallback.js',
  './js/vendor/pdfjs/wasm/openjpeg.wasm',
  './js/vendor/pdfjs/wasm/openjpeg_nowasm_fallback.js',
  './js/vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb',
  './js/vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf',
  './js/vendor/pdfjs/standard_fonts/FoxitSerif.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitFixed.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitSymbol.pfb',
  './js/vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf',
  './js/vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf',
  './js/vendor/pdfjs/standard_fonts/FoxitDingbats.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb',
  './js/vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb',
  './js/vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
  './js/db.js',
  './js/tools-engine.js',
  './js/app.js',
  './js/settings.js',
  './js/config.js',
  './js/i18n.js',
  './js/account.js',
  './js/vendor/dexie.min.js',
  './js/vendor/jszip.min.js',
  './js/vendor/pdf-lib.min.js',
  './assets/fonts/SchibstedGrotesk-Latin.woff2',
  './assets/brand/symbol-white.svg',
  './assets/brand/symbol-black.svg',
  './assets/brand/logo-white.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('atta-docstudio-pwa-') && key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: APP_VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Server akun dan alamat luar tidak pernah disimpan di cache
  if (url.origin !== self.location.origin || url.pathname.endsWith('.php')) return;

  // Info versi selalu diambil dari jaringan agar cek update akurat
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(
        () => new Response(JSON.stringify({ offline: true }), { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});
