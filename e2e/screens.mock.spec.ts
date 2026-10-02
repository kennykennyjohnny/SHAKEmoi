import { test, type Page } from '@playwright/test';
import { mockBackend } from './mock/backend';

// Captures d'écran pour relire les changements (pas d'assertion).
// SCREENS="nom=chemin,autre=chemin2" npm run test:mock -- e2e/screens.mock.spec.ts
// (« accueil » = la page d'accueil ; chemins sans « / » au début.)
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/screens/mock-${test.info().project.name}-${name}.png` });

test('captures', async ({ page }) => {
  test.skip(!process.env.SCREENS, 'SCREENS=… pour produire les captures');
  const { unhandled } = await mockBackend(page, { log: true });
  for (const item of (process.env.SCREENS || '').split(',')) {
    const [label, path] = item.split('=');
    if (!path) continue;
    await page.goto('/' + (path === 'accueil' ? '' : path));
    await page.waitForTimeout(Number(process.env.SCREENS_WAIT || 1500));
    await shot(page, label);
  }
  if (unhandled.size) console.log('Non simulé :\n' + [...unhandled].join('\n'));
});
