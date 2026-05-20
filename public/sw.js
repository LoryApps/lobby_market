// Lobby Market Service Worker — Web Push Notifications

const APP_NAME = 'Lobby Market'
const BASE_URL = self.location.origin

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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
