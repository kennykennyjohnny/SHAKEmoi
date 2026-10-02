import { test } from '@playwright/test';
import { mockBackend } from './mock/backend';

// Captures d'écran pour relire les changements (pas d'assertion).
const shot = (page: import('@playwright/test').Page, name: string) =>
  page.screenshot({ path: `e2e/screens/mock-${test.info().project.name}-${name}.png` });

test('captures', async ({ page }) => {
  test.skip(!process.env.SCREENS, 'SCREENS=1 pour produire les captures');
  await mockBackend(page);
  const list = (process.env.SCREENS || '').split(',');
  for (const name of list) {
    const [label, path] = name.split('=');
    if (!path) continue;
    await page.goto('/' + (path === 'accueil' ? '' : path));
    await page.waitForTimeout(1500);
    await shot(page, label);
  }
});
