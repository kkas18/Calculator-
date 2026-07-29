/* sw.js — Calculator app shell.
   Cache-first navigation with a quiet background refresh; stale-while-revalidate
   for everything else, including the opaque Google Fonts responses so the
   Fraunces/Manrope pairing survives offline. Bump VERSION to ship an update. */

var VERSION = 'calc-v1.0';
var SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png'
];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) {
        // allSettled: one missing optional asset must never fail the install
        return Promise.allSettled(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () {
        if (self.registration.navigationPreload) return self.registration.navigationPreload.disable();
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function cachePut(req, res) {
  var copy = res.clone();
  caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigations: serve the shell instantly, refresh it in the background.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('index.html', { ignoreSearch: true })
        .then(function (hit) { return hit || caches.match('./', { ignoreSearch: true }); })
        .then(function (hit) {
          var net = fetch(req).then(function (res) {
            if (res && res.ok) cachePut('index.html', res);
            return res;
          }).catch(function () { return null; });
          if (hit) return hit;                       // never stall on a weak link
          return net.then(function (r) { return r || new Response('Offline', { status: 503 }); });
        })
    );
    return;
  }

  var sameOrigin = url.origin === self.location.origin;
  var isFont = FONT_HOSTS.indexOf(url.hostname) !== -1;
  if (!sameOrigin && !isFont) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        // status 0 == opaque (the font files); still worth keeping
        if (res && (res.ok || res.status === 0)) cachePut(req, res);
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
