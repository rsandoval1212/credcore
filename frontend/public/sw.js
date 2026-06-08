/* CredCore Service Worker - app shell caching */
const CACHE_NAME = 'credcore-v1'
const APP_SHELL = ['/', '/index.html', '/logo.png']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL).catch(() => {})))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return  // no cachear escrituras

  const url = new URL(req.url)

  // No interceptar API ni media (los maneja Axios)
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/media/')) return

  // Estrategia: cache-first para assets, network-first para HTML
  const isHTML = req.mode === 'navigate' || req.destination === 'document'

  if (isHTML) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html') || caches.match('/'))
    )
    return
  }

  // Cache-first para JS/CSS/imágenes
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached
      return fetch(req).then(res => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {})
        }
        return res
      }).catch(() => cached || new Response('Offline', { status: 503 }))
    })
  )
})
