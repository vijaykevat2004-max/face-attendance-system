const CACHE_NAME = 'realize-attendance-static-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve static assets from cache, network first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache authenticated API responses
  if (url.pathname.startsWith('/api/')) {
    // Network only for API calls
    event.respondWith(fetch(event.request))
    return
  }

  // Cache first for static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.startsWith('/_next/static/'))) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Network first for everything else (HTML pages)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && (url.pathname === '/' || url.pathname.startsWith('/employee'))) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Message event - handle skip waiting and clear cache on logout
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
  if (event.data === 'clearCache') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((name) => caches.delete(name))
    })
  }
})