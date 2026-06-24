import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
      }
    })
  ]
})
