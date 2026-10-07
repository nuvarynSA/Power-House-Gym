import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'powerhouse-logo.png'],
        manifest: {
          name: 'PowerHouse Gym - Sistema de Invitados',
          short_name: 'PHG Invitados',
          description: 'Sistema de gestión de invitados para PowerHouse Gym',
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'favicon.ico',
              sizes: '48x48',
              type: 'image/x-icon'
            },
            {
              src: 'powerhouse-logo.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'powerhouse-logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'powerhouse-logo.png',
              sizes: '2240x1784',
              type: 'image/png',
              purpose: 'any'
            }
          ],
          categories: ['business', 'productivity'],
          lang: 'es',
          dir: 'ltr'
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'localhost',
      '.trycloudflare.com',
      '.cloudflare.com'
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'localhost',
      '.trycloudflare.com',
      '.cloudflare.com'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})

