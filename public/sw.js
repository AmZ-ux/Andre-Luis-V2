/// <reference lib="webworker" />

const CACHE = 'v2'
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.svg']
const ASSETS = /\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/index.html')),
        ),
    )
    return
  }

  if (ASSETS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      }),
    )
  }
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data?.json() ?? { title: 'Transporte André Luis', body: '' }
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
    }
    event.waitUntil(self.registration.showNotification(data.title || 'Transporte André Luis', options))
  } catch {}
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = new URL(event.notification.data?.path || '/', self.location.origin)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const matchingClient = windowClients.find((c) => c.url === urlToOpen.href)
      if (matchingClient) return matchingClient.focus()
      return clients.openWindow(urlToOpen.href)
    }),
  )
})
