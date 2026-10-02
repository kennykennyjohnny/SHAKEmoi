import { defineConfig, devices } from '@playwright/test';

// Tests « connecté » sur une base simulée (e2e/mock/backend.ts) : l'appli
// tourne en local avec une adresse Supabase factice, rien ne touche la vraie base.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.mock\.spec\.ts/,
  timeout: 45_000,
  retries: 1, // gestes chronométrés : une machine chargée peut fausser une vitesse
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', locale: 'fr-FR', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: 'https://mock.shakemoi.test', VITE_SUPABASE_ANON_KEY: 'mock-anon-key' },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
