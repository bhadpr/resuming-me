import { execSync } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** Web builds have no store version, so events carry the build date and commit instead. */
function webBuildVersion(): string {
  const day = new Date().toISOString().slice(0, 10)
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    return sha ? `web-${day}-${sha}` : `web-${day}`
  } catch {
    return `web-${day}`
  }
}

/**
 * The marketing site serves /media in production. While developing, serve the same files here
 * (with byte ranges, which video seeking needs) so the clips play without a deploy.
 */
function devMedia(): Plugin {
  const dir = join(process.cwd(), 'marketing', 'public', 'media')
  return {
    name: 'dev-media',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/media', (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        if (!/^[\w.-]+\.(mp4|webp)$/.test(name)) return next()
        const file = join(dir, name)
        let size: number
        try {
          size = statSync(file).size
        } catch {
          return next()
        }
        const type = name.endsWith('.mp4') ? 'video/mp4' : 'image/webp'
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
        if (!range) {
          res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' })
          createReadStream(file).pipe(res)
          return
        }
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
        const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        })
        createReadStream(file, { start, end }).pipe(res)
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(webBuildVersion()),
  },
  // Avoid clashing with other local Vite apps on 5173 (IPv4 vs IPv6 localhost).
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  plugins: [
    react(),
    devMedia(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'logo.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
      ],
      manifest: {
        id: '/',
        name: 'Resuming',
        short_name: 'Resuming',
        description:
          'Everything in one gentle list: habits, reminders, meetups, health, holidays and games. Free, no ads.',
        theme_color: '#fff4e8',
        background_color: '#fff4e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/today',
        categories: ['lifestyle', 'productivity', 'health'],
        // Screenshots (narrow form_factor) deferred — add when device captures exist.
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Indic fonts load per script via unicode-range; precaching would send all four to everyone.
        globIgnores: ['**/noto-sans-*.woff2'],
        // This URL is a static page for Play. The app shell must not replace it.
        navigateFallbackDenylist: [/^\/delete-account\/?$/],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
