import { test, expect, type Page } from '@playwright/test';
import { mockBackend, LEA } from './mock/backend';
import { swipe } from './mock/touch';

// Q2 : dans un post ouvert depuis une grille, passer au suivant / précédent
// (glisser, flèches, clavier), résistance au bout, fermer en glissant vers le bas.
const pid = (k: number) => `00000000-0000-4000-a000-${String(k).padStart(12, '0')}`;
const activeTitle = (page: Page) => page.locator('[role="dialog"][aria-label="Shake"] [aria-hidden="false"] h3');

async function openFirstPost(page: Page) {
  await mockBackend(page);
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA);
  const thumb = page.locator(`[data-thumb="${pid(0)}"]`);
  await expect(thumb).toBeVisible();
  await thumb.click();
  await expect(activeTitle(page)).toHaveText('Titre 1');
  await expect(page).toHaveURL(new RegExp(`/post/${pid(0)}$`));
  await page.waitForTimeout(400);
}

test('flèches et clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'ordinateur');
  await openFirstPost(page);
  await expect(page.getByRole('button', { name: 'Shake précédent' })).toHaveCount(0); // au début : pas de flèche gauche
  await page.getByRole('button', { name: 'Shake suivant' }).click();
  await expect(activeTitle(page)).toHaveText('Titre 2');
  await expect(page).toHaveURL(new RegExp(`/post/${pid(1)}$`));
  await page.keyboard.press('ArrowRight');
  await expect(activeTitle(page)).toHaveText('Titre 3');
  await page.keyboard.press('ArrowLeft');
  await expect(activeTitle(page)).toHaveText('Titre 2');
  // Retour : le post se ferme, on est sur l'aperçu de profil.
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Shake' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Profil de/ })).toBeVisible();
});

test('glisser : suivant, précédent, bout de liste, fermer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'téléphone');
  await openFirstPost(page);
  const sel = '[role="dialog"][aria-label="Shake"]';
  // Au début : glisser vers la droite résiste, on reste sur le 1er.
  await swipe(page, sel, { x: 100, y: 500 }, { x: 330, y: 505 });
  await page.waitForTimeout(450);
  await expect(activeTitle(page)).toHaveText('Titre 1');
  // Vers la gauche : le suivant.
  await swipe(page, sel, { x: 330, y: 500 }, { x: 60, y: 505 });
  await expect(activeTitle(page)).toHaveText('Titre 2');
  await swipe(page, sel, { x: 330, y: 500 }, { x: 60, y: 505 });
  await expect(activeTitle(page)).toHaveText('Titre 3');
  // Vers la droite : le précédent.
  await swipe(page, sel, { x: 60, y: 500 }, { x: 330, y: 505 });
  await expect(activeTitle(page)).toHaveText('Titre 2');
  await page.waitForTimeout(400);
  // En plein geste vers le bas : le post suit le doigt, rétrécit, la grille réapparaît.
  await swipe(page, sel, { x: 200, y: 300 }, { x: 200, y: 520 }, 10, 12, false);
  await page.screenshot({ path: 'e2e/screens/q2-glisser-bas.png' });
  await page.evaluate(() => { const t = document.querySelector('[role="dialog"][aria-label="Shake"]')!; t.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true })); });
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: 'Shake' })).toBeVisible(); // relâché sans finir : revient
  // Vers le bas depuis la pochette : fermé, la vignette du post vu est à l'écran.
  await swipe(page, sel, { x: 200, y: 300 }, { x: 200, y: 650 });
  await expect(page.getByRole('dialog', { name: 'Shake' })).toHaveCount(0);
  await expect(page.locator(`[data-thumb="${pid(1)}"]`)).toBeInViewport();
});
