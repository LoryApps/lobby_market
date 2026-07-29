// Lobby Market Service Worker — Push Notifications + Offline Cache

const APP_NAME = 'Lobby Market'
const BASE_URL = self.location.origin

// ─── Cache configuration ──────────────────────────────────────────────────────

const CACHE_VERSION = 'v3'
const STATIC_CACHE  = `lm-static-${CACHE_VERSION}`
const API_CACHE     = `lm-api-${CACHE_VERSION}`
const OFFLINE_URL   = '/offline.html'

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  OFFLINE_URL,
]

// URL patterns to never cache (auth, push, write operations)
const NO_CACHE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/push\//,
  /\/api\/votes?\//,
  /\/api\/arguments\/[^/]+\/vote/,
  /supabase\.co/,
]

// API routes worth caching with stale-while-revalidate (read-only public data)
const API_SWR_PATTERNS = [
  /\/api\/topics\/browse/,
  /\/api\/trending/,
  /\/api\/laws/,
  /\/api\/categories/,
  /\/api\/leaderboard/,
  /\/api\/stats\//,
  /\/api\/tags\//,
]

// ─── Install — pre-cache the offline fallback ─────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ─── Activate — prune stale caches ───────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch strategy ───────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin or Supabase CDN requests
  if (!request.url.startsWith(BASE_URL) && !url.hostname.endsWith('.supabase.co')) {
    return
  }

  // Skip non-GET requests entirely (POST/PATCH/DELETE go straight to network)
  if (request.method !== 'GET') return

  // Skip explicitly non-cacheable patterns
  if (NO_CACHE_PATTERNS.some((p) => p.test(request.url))) return

  // ── API routes: stale-while-revalidate for whitelisted endpoints ──────────

  if (url.pathname.startsWith('/api/')) {
    if (API_SWR_PATTERNS.some((p) => p.test(request.url))) {
      event.respondWith(staleWhileRevalidate(request, API_CACHE, 5 * 60))
    }
    // Other API routes: network-only (no event.respondWith → browser default)
    return
  }

  // ── Static assets: cache-first (JS/CSS/fonts/images are content-addressed)

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── Navigation requests: network-first, fall back to offline page ─────────

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }
})

// ─── Strategy helpers ─────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/assets/') ||
    /\.(woff2?|ttf|otf|ico|png|jpg|jpeg|webp|svg|gif)$/.test(pathname)
  )
}

/** Cache-first: serve from cache if present, else fetch and cache. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Asset not available offline.', { status: 503 })
  }
}

/** Stale-while-revalidate: serve cached immediately, refresh in background.
 *  maxAgeSeconds: if the cached entry is older, skip it and fetch fresh. */
async function staleWhileRevalidate(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    // Check age header to decide whether the stale entry is usable
    const dateHeader = cached.headers.get('date')
    const age = dateHeader
      ? (Date.now() - new Date(dateHeader).getTime()) / 1000
      : 0
    if (!dateHeader || age < maxAgeSeconds) {
      return cached
    }
    // Entry is too stale — wait for the network
  }

  const fresh = await fetchPromise
  return fresh || cached || new Response(null, { status: 503 })
}

/** Network-first navigation: try network, serve offline.html on failure. */
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request)
    return response
  } catch {
    // Record which page the user was trying to reach so the offline page
    // can redirect back on reconnect (via sessionStorage set on the SW client).
    const cache = await caches.open(STATIC_CACHE)
    const offline = await cache.match(OFFLINE_URL)
    return offline || new Response('<h1>Offline</h1>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

// ─── Push event handler ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: APP_NAME, body: event.data ? event.data.text() : 'New activity in the Lobby.' }
  }

  const title   = data.title   || APP_NAME
  const body    = data.body    || 'New activity in the Lobby.'
  const url     = data.url     || '/'
  const icon    = data.icon    || '/assets/logo-mark.png'
  const badge   = data.badge   || '/assets/logo-mark.png'
  const tag     = data.tag     || 'lobby-market'
  const actions = data.actions || []

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url },
    actions,
    renotify: !!data.renotify,
    requireInteraction: !!data.requireInteraction,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ─── Notification click handler ───────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = (event.notification.data && event.notification.data.url)
    ? new URL(event.notification.data.url, BASE_URL).href
    : BASE_URL

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one matches the URL
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      // Focus any open Lobby Market tab
      for (const client of clients) {
        if (client.url.startsWith(BASE_URL) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open a new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
