import { test, expect } from '@playwright/test';
import { mockBackend } from './mock/backend';

// Q8 : l'onglet Découvrir (une lecture, raisons, Shaker, Pas pour moi, Tout écouter).
test('Découvrir', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/top');
  await page.getByRole('button', { name: 'Découvrir', exact: true }).click();
  await expect(page.getByText('MELROSE PLACE')).toBeVisible();
  await expect(page.getByText('Parce que tu as shaké Tiakola').first()).toBeVisible();
  await expect(page.getByText('Aimé par Bapt · 92 % compatibles').first()).toBeVisible();
  await page.waitForTimeout(400); // fin du glissement de l'onglet
  await page.screenshot({ path: `e2e/screens/q8-decouvrir-${test.info().project.name}.png` });
  // Pas pour moi : la ligne disparaît.
  await page.getByRole('button', { name: 'Pas pour moi' }).first().click();
  await expect(page.getByText('MELROSE PLACE')).toHaveCount(0);
  // Shaker : publié.
  await page.getByRole('button', { name: 'Shaker' }).first().click();
  await expect(page.getByText('Shaké', { exact: true }).first()).toBeVisible();
  // Une autre série.
  await page.getByRole('button', { name: /Une autre série/ }).click();
  await expect(page.getByText('Coco (série 2)')).toBeVisible();
});

// Q9 : « Mes artistes préférés » (même écran que l'étape du tuto).
test('Choisis tes artistes', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/profil');
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('button', { name: /Mes artistes préférés/ }).click();
  await expect(page.getByRole('button', { name: 'Ninho', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ninho', exact: true }).click();
  // Les artistes proches apparaissent juste à côté.
  await expect(page.getByRole('button', { name: 'Gazo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aya Nakamura', exact: true }).click();
  await page.getByRole('button', { name: 'Bad Bunny', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ninho', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `e2e/screens/q9-artistes-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Enregistrer' }).last().click();
  await expect(page.getByRole('heading', { name: 'Mes artistes préférés' })).toHaveCount(0);
});
