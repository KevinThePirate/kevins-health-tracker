import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

// ── Push notification received from server ────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  const title = data.title || "Kevin's Health Tracker"
  const options = {
    body: data.body || "Time to log yesterday — it only takes 30 seconds",
    icon: '/kevins-health-tracker/favicon.svg',
    badge: '/kevins-health-tracker/favicon.svg',
    tag: 'daily-reminder',
    requireInteraction: false,
    data: { url: data.url || 'https://kevinthepirate.github.io/kevins-health-tracker/#/today' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Tap on notification opens the app ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || 'https://kevinthepirate.github.io/kevins-health-tracker/#/today'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('kevins-health-tracker') && 'focus' in client) {
          return client.navigate(url).then(c => c.focus())
        }
      }
      return clients.openWindow(url)
    })
  )
})
