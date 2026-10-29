/* Bermi service worker — install + a small offline shell.
 *
 * What it does NOT do: it never caches /api/ responses. Plans, money, health,
 * faith, notes and chats are private and live only on the server, so they are
 * not available offline — the app says so instead of showing stale data.
 *
 * Updates: a new worker waits until the person taps "Reload" in the app (the
 * page posts SKIP_WAITING), so a deploy never swaps code under an open form. */
const CACHE = 'bermi-v2'
const SHELL = ['/', '/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // Pages: network first; if offline, the cached app shell, then a plain page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !url.pathname.startsWith('/admin')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match('/offline.html'))),
    )
    return
  }

  // Fingerprinted build assets never change, so cache-first is safe.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
