import { defineConfig } from 'vite'
import path from 'path'
import { readFileSync } from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
// Version affichée dans les signalements de bug (P15) et envoyée à Sentry (P16) :
// version du paquet + début du commit Vercel.
const appVersion = `${pkg.version}${process.env.VERCEL_GIT_COMMIT_SHA ? `+${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ''}`

// P16 : les fichiers source (source maps) partent chez Sentry au build Vercel,
// SEULEMENT si le jeton est configuré ; ils sont ensuite retirés du site publié.
const sentryUpload = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)

export default defineConfig({
  base: '/', // Pour shakemoi.fr (domaine custom)
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(sentryUpload ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: appVersion },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      telemetry: false,
    })] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Cartes des sources : seulement pour Sentry (supprimées après l'envoi).
    sourcemap: sentryUpload ? 'hidden' : false,
  },
})
