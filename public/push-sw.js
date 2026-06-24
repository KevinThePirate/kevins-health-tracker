// Push-only service worker — registered at /kevins-health-tracker/push/
// Handles background push notifications even when the app is closed.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(
      data.title || "Kevin's Health Tracker",
      {
        body: data.body || 'Time to log yesterday — it only takes 30 seconds',
        icon: '/kevins-health-tracker/favicon.svg',
        badge: '/kevins-health-tracker/favicon.svg',
        tag: 'daily-reminder',
        data: { url: data.url || 'https://kevinthepirate.github.io/kevins-health-tracker/#/today' }
      }
    )
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || 'https://kevinthepirate.github.io/kevins-health-tracker/#/today'
  event.waitUntil(clients.openWindow(url))
})
