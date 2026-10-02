import { test, expect, type Page } from '@playwright/test';
import { mockBackend, LEA } from './mock/backend';
import { swipe } from './mock/touch';

// Q1 : l'aperçu de profil se ferme en le glissant vers le bas (seulement si le
// contenu est tout en haut), sinon il revient en place.

const openPreview = async (page: Page) => {
  await page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA);
  const d = page.getByRole('dialog', { name: /Profil de/ });
  await expect(d.getByText('15', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(400);
  return d;
};

test.describe('glisser pour fermer', () => {
  test.skip(({ isMobile }) => !isMobile, 'geste tactile : téléphone');

  test('aperçu de profil', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    const sel = '[role="dialog"][aria-label^="Profil de"]';

    // Petit glissé : il revient en place.
    let d = await openPreview(page);
    await swipe(page, sel, { x: 200, y: 450 }, { x: 200, y: 510 });
    await page.waitForTimeout(500);
    await expect(d).toBeVisible();
    expect(await d.evaluate((el) => el.style.transform)).toBe('');

    // Contenu défilé : glisser vers le bas fait défiler, ne ferme pas.
    await d.locator('.overflow-y-auto').first().evaluate((el) => { el.scrollTop = 300; });
    await swipe(page, sel, { x: 200, y: 450 }, { x: 200, y: 750 });
    await page.waitForTimeout(500);
    await expect(d).toBeVisible();

    // Tout en haut, grand glissé : fermé, l'adresse revient.
    await d.locator('.overflow-y-auto').first().evaluate((el) => { el.scrollTop = 0; });
    await swipe(page, sel, { x: 200, y: 450 }, { x: 200, y: 750 });
    await expect(page.getByRole('dialog', { name: /Profil de/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/u\//);

    // Geste rapide et court : fermé aussi.
    d = await openPreview(page);
    await swipe(page, sel, { x: 200, y: 450 }, { x: 200, y: 570 }, 3, 4);
    await expect(page.getByRole('dialog', { name: /Profil de/ })).toHaveCount(0);
  });
});
