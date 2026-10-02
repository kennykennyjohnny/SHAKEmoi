import { test, expect } from '@playwright/test';
import { mockBackend } from './mock/backend';

// Q14 : le nouveau tuto (6 écrans concrets, 3 gestes à faire), puis la
// configuration : appli d'écoute → 3 artistes (Q9) → 3 personnes (P29).
test('nouveau tuto, de bout en bout', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'téléphone');
  await mockBackend(page, { newUser: true });
  await page.goto('/');
  const shot = (n: string) => page.screenshot({ path: `e2e/screens/q14-${n}.png` });
  const next = () => page.getByRole('button', { name: /^Suivant/ }).click();

  await expect(page.getByRole('heading', { name: 'Partage le son du moment' })).toBeVisible();
  await page.waitForTimeout(1600); // la recherche se tape toute seule
  await expect(page.getByText('Meuda')).toBeVisible();
  await shot('1-partage');
  await next();

  await expect(page.getByRole('heading', { name: 'Réagis à la musique de tes potes' })).toBeVisible();
  await page.getByRole('button', { name: 'Double-tape pour liker' }).dblclick();
  await expect(page.getByText('Bien joué !')).toBeVisible();
  await shot('2-reagis');
  await next();

  await expect(page.getByRole('heading', { name: 'Les Shakes éphémères' })).toBeVisible();
  await page.waitForTimeout(500);
  await shot('3-ephemere');
  await next();

  await expect(page.getByRole('heading', { name: 'Tes cercles' })).toBeVisible();
  await page.waitForTimeout(1600);
  await shot('4-cercles');
  await page.getByRole('button', { name: 'Playlist du cercle' }).click();
  await expect(page.getByText(/Playlist du cercle · Tout écouter/)).toBeVisible();
  await page.waitForTimeout(400);
  await shot('4b-cercles-playlist');
  await next();

  await expect(page.getByRole('heading', { name: 'Ta flamme' })).toBeVisible();
  await page.getByRole('button', { name: 'Publier mon Shake' }).click();
  await expect(page.getByText('Bien joué !')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('5-flamme');
  await next();

  await expect(page.getByRole('heading', { name: 'Découvre' })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot('6-decouvre');
  await next();

  await expect(page.getByRole('heading', { name: 'Tu écoutes où ?' })).toBeVisible();
  await page.getByRole('button', { name: /Spotify/ }).first().click();
  await shot('7-appli');
  await page.getByRole('button', { name: /C’est parti/ }).click();

  await expect(page.getByRole('heading', { name: 'Choisis au moins 3 artistes que tu aimes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Encore 3' })).toBeDisabled();
  for (const n of ['Ninho', 'Aya Nakamura', 'SZA']) await page.getByRole('button', { name: n, exact: true }).click();
  await page.waitForTimeout(500);
  await shot('8-artistes');
  await page.getByRole('button', { name: /Continuer · 3/ }).click();

  await expect(page.getByText(/Suis au moins 3 personnes/)).toBeVisible();
  await shot('9-suis');
});
