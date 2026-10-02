import { defineConfig, devices } from '@playwright/test';

// Tests de fumée SHAKEmoi : téléphone (390 px) + ordinateur.
// Par défaut contre le site en ligne ; E2E_BASE_URL=http://localhost:5173 pour le local.
export default defineConfig({
  testDir: './e2e',
  // Les tests sur base simulée ont leur propre config (playwright.mock.config.ts).
  testIgnore: /.*.mock.spec.ts/,
  timeout: 45_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://www.shakemoi.fr',
    locale: 'fr-FR',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
