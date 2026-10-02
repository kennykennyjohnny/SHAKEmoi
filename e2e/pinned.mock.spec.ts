import { test, expect } from '@playwright/test';
import { mockBackend, LEA } from './mock/backend';

// Q11 : un Shake épinglé passe en tête de la grille, avec l'épingle violette ;
// le passage d'un post à l'autre (Q2) suit cet ordre.
const pid = (k: number) => `00000000-0000-4000-a000-${String(k).padStart(12, '0')}`;

test('Shake épinglé en tête de grille', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA);
  const thumbs = page.locator('[data-thumb]');
  await expect(thumbs.first()).toHaveAttribute('data-thumb', pid(5));
  await expect(thumbs.first().getByLabel('Épinglé')).toBeVisible();
  await expect(thumbs.nth(1)).toHaveAttribute('data-thumb', pid(0));
  await expect(page.locator('[data-thumb] [aria-label="Épinglé"]')).toHaveCount(1);
  // Ouvert sur l'épinglé, le suivant est le plus récent des autres.
  await thumbs.first().click();
  const title = page.locator('[role="dialog"][aria-label="Shake"] [aria-hidden="false"] h3');
  await expect(title).toHaveText('Titre 6');
  await page.keyboard.press('ArrowRight');
  await expect(title).toHaveText('Titre 1');
});
