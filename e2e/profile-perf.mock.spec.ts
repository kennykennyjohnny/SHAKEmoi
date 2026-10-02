import { test, expect, type Page } from '@playwright/test';
import { mockBackend, LEA, CIRCLE } from './mock/backend';

// Q5 : temps d'ouverture de l'aperçu de profil, 4G simulée (150 ms par requête).

async function measure(page: Page, open: () => Promise<void>, counter: { n: number }, label: string) {
  counter.n = 0;
  const t0 = Date.now();
  await open();
  const dialog = page.getByRole('dialog', { name: /Profil de/ });
  await expect(dialog.getByText('Léa', { exact: true })).toBeVisible();
  const tName = Date.now() - t0;
  await expect(dialog.getByText('15', { exact: true }).first()).toBeVisible();
  const tHeader = Date.now() - t0;
  await expect(dialog.getByText(/88/).first()).toBeVisible();
  await expect.poll(() => dialog.locator('img[src*="/img/300x300"]').evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0).length), { timeout: 20000 }).toBeGreaterThanOrEqual(9);
  const tFull = Date.now() - t0;
  console.log(`[Q5] ${test.info().project.name} ${label} : nom ${tName} ms · en-tête ${tHeader} ms · complet ${tFull} ms · ${counter.n} requêtes`);
}

test('aperçu de profil : temps jusqu’à l’affichage complet', async ({ page }) => {
  const counter = { n: 0 };
  await mockBackend(page, { latency: 150, counter });
  await page.goto('/');
  await page.waitForTimeout(2500); // l'appli a fini de démarrer

  // 1. Ouverture « à froid », sans rien savoir (lien, notification).
  await measure(page, () => page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA), counter, 'à froid');

  // 2. Rouvrir le même profil dans la minute : cache.
  await page.keyboard.press('Escape');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: /Profil de/ })).toHaveCount(0);
  await measure(page, () => page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA), counter, 'réouverture');
});

test('aperçu de profil : toucher un avatar (préchargement)', async ({ page }) => {
  const counter = { n: 0 };
  await mockBackend(page, { latency: 150, counter });
  await page.goto('/cercles/' + CIRCLE);
  const name = page.getByRole('button', { name: '@lea' }).last();
  await expect(name).toBeVisible();
  await page.waitForTimeout(1500);
  await measure(page, async () => {
    // Un vrai toucher : le doigt se pose (préchargement), ~120 ms, puis se lève.
    const box = (await name.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
  }, counter, 'toucher');
});
