import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set base to '/kevins-health-tracker/' if deploying to github.com/<user>/kevins-health-tracker
// Change to '/' if using a custom domain or deploying to a root repo
export default defineConfig({
  base: '/kevins-health-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: "Kevin's Health Tracker",
        short_name: 'HealthTracker',
        description: 'Personal daily health, habits and mood tracker',
        theme_color: '#14b8a6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/kevins-health-tracker/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ahcwmhgzjvulwixnbcya\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 10 }
          }
        ]
      }
    })
  ]
})
