import { test, expect, type Page } from '@playwright/test';
import { mockBackend, MOCK_HOST } from './mock/backend';

// R7 : le son d'un Shake éphémère part tout seul à l'ouverture, enchaîne sur
// le suivant, se coupe pour une story sans son, reprend ce qui jouait avant à
// la fermeture ; « son coupé » vaut pour la session ; repli « Toucher pour le son ».
const sid = (i: number) => `story-00000000-0000-4000-b000-00000000000${i}`;
const state = (page: Page) => page.evaluate(async () => (await import('/src/lib/preview.ts')).getPreviewState());

async function setup(page: Page) {
  await mockBackend(page, { stories: true });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Shakes éphémères de Léa/ })).toBeVisible();
  await page.waitForTimeout(800); // extraits préparés à l'affichage de la barre
}

test('son automatique, enchaînement, sans son, reprise à la fermeture', async ({ page }) => {
  await setup(page);
  // Un son jouait avant (une playlist, par ex.).
  await page.getByRole('button', { name: /Shakes éphémères de Léa/ }).hover();
  await page.evaluate(async (u) => { (await import('/src/lib/preview.ts')).playPreview('playlist-x', u); }, `${MOCK_HOST}/audio/9.wav`);
  await expect.poll(async () => (await state(page)).playing).toBe(true);

  await page.getByRole('button', { name: /Shakes éphémères de Léa/ }).click();
  await expect.poll(async () => { const s = await state(page); return `${s.key} ${s.playing}`; }, { timeout: 3000 }).toBe(`${sid(0)} true`);
  await page.screenshot({ path: 'docs/captures/R/r7-story-son.png' });

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => { const s = await state(page); return `${s.key} ${s.playing}`; }, { timeout: 3000 }).toBe(`${sid(1)} true`);

  // Story sans son : le son de la précédente s'arrête.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(page)).key, { timeout: 3000 }).toBeNull();

  // Fermeture : la « playlist » reprend.
  await page.keyboard.press('Escape');
  await expect.poll(async () => { const s = await state(page); return `${s.key} ${s.playing}`; }, { timeout: 3000 }).toBe('playlist-x true');
});

test('son coupé : gardé pour la story suivante', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /Shakes éphémères de Léa/ }).click();
  await expect.poll(async () => (await state(page)).playing, { timeout: 3000 }).toBe(true);
  await page.getByRole('button', { name: 'Couper le son' }).click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => { const s = await state(page); return `${s.key} ${s.muted}`; }, { timeout: 3000 }).toBe(`${sid(1)} true`);
  await page.getByRole('button', { name: 'Activer le son' }).click();
  await expect.poll(async () => (await state(page)).muted).toBe(false);
});

test('lecture automatique refusée : « Toucher pour le son »', async ({ page }) => {
  await setup(page);
  // Le navigateur refuse toute lecture qui ne vient pas d'un toucher.
  await page.evaluate(() => {
    const real = HTMLMediaElement.prototype.play;
    (window as any).__realPlay = real;
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('refusé', 'NotAllowedError')); };
  });
  await page.getByRole('button', { name: /Shakes éphémères de Léa/ }).click();
  const btn = page.getByRole('button', { name: /Toucher pour le son/ });
  await expect(btn).toBeVisible();
  await page.screenshot({ path: 'docs/captures/R/r7-toucher-pour-le-son.png' });
  await page.evaluate(() => { HTMLMediaElement.prototype.play = (window as any).__realPlay; });
  await btn.click();
  await expect.poll(async () => { const s = await state(page); return `${s.key} ${s.playing}`; }, { timeout: 3000 }).toBe(`${sid(0)} true`);
  await expect(btn).toHaveCount(0);
});
