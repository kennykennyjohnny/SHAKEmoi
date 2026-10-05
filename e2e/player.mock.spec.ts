import { test, expect, type Page } from '@playwright/test';
import { mockBackend, CIRCLE } from './mock/backend';

// R5 : le lecteur de l'appli. « Tout écouter » dans la playlist d'un cercle →
// on va sur le fil puis le profil : la barre reste et enchaîne ; pause depuis
// la barre ; toucher la barre ramène à la playlist, sur le son en cours.
const bar = (page: Page) => page.locator('[data-global-player]');
const state = (page: Page) => page.evaluate(async () => (await import('/src/lib/preview.ts')).getPreviewState());

test('lecteur global : playlist → fil → profil → retour', async ({ page, isMobile }) => {
  await mockBackend(page);
  await page.goto(`/cercles/${CIRCLE}/playlist`);
  await page.getByRole('button', { name: /Tout écouter/ }).click();
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toContainText('Son 39');
  await expect(page.getByRole('status').filter({ hasText: 'Lecture · Playlist Les potes' })).toBeVisible();
  await expect.poll(async () => (await state(page)).playing).toBe(true);
  await page.screenshot({ path: `docs/captures/R/r5-barre-playlist-${isMobile ? 'mobile' : 'ordi'}.png` });

  // Autre onglet, puis un autre encore : la barre suit, la lecture continue et enchaîne.
  await page.locator('header').getByRole('button', { name: 'Accueil' }).click();
  await expect(bar(page)).toBeVisible();
  if (isMobile) {
    await page.locator('nav').getByRole('button', { name: 'Profil' }).click();
    await expect(bar(page)).toBeVisible();
    await page.screenshot({ path: 'docs/captures/R/r5-barre-profil.png' });
  }
  // Le son suivant enchaîne tout seul (extraits de 3 s sur le banc).
  await expect(bar(page)).toContainText('Son 38', { timeout: 8000 });
  await expect.poll(async () => (await state(page)).playing).toBe(true);

  // Pause depuis la barre.
  await bar(page).getByRole('button', { name: 'Pause' }).click();
  await expect.poll(async () => (await state(page)).playing).toBe(false);

  // Toucher la barre : retour à la playlist du cercle, le son en cours en surbrillance.
  await bar(page).getByRole('button', { name: /Revenir à Playlist Les potes/ }).click();
  await expect(page).toHaveURL(new RegExp(`/cercles/${CIRCLE}/playlist$`));
  await expect(page.locator('[aria-current="true"]').filter({ hasText: 'Son 38' })).toBeVisible();
});

test('un seul lecteur : un son lancé ailleurs remplace la file, pas de barre fantôme', async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/cercles/${CIRCLE}/playlist`);
  await page.getByRole('button', { name: /Tout écouter/ }).click();
  await expect(bar(page)).toContainText('Son 39');
  // Un son joué hors de toute file (un essai dans le composeur, par ex.).
  await page.evaluate(async (u) => { (await import('/src/lib/preview.ts')).playPreview('compose-x', u); }, 'https://mock.shakemoi.test/audio/z.wav');
  await expect(bar(page)).toHaveCount(0);
});

test('fin de la file : « Fin de la lecture », Rejouer', async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/cercles/${CIRCLE}/playlist`);
  // Le dernier son de la playlist : la file s'arrête après lui.
  await page.getByRole('button', { name: /Son 5\b/ }).first().click();
  await expect(bar(page)).toContainText('Fin de la lecture', { timeout: 8000 });
  await page.screenshot({ path: 'docs/captures/R/r5-fin-de-lecture.png' });
  await bar(page).getByRole('button', { name: 'Rejouer' }).click();
  await expect(bar(page)).toContainText('Son 39');
});

test('À suivre : glisser la barre vers le haut, retirer, déplacer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'geste : téléphone');
  await mockBackend(page);
  await page.goto(`/cercles/${CIRCLE}/playlist`);
  await page.getByRole('button', { name: /Tout écouter/ }).click();
  await expect(bar(page)).toContainText('Son 39');
  const box = (await bar(page).boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y - 30, { steps: 6 });
  await page.mouse.up();
  const sheet = page.getByRole('dialog', { name: 'À suivre' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('li')).toHaveCount(4);
  await sheet.getByRole('button', { name: 'Descendre Son 38' }).click();
  await expect(sheet.locator('li').first()).toContainText('Son 27');
  await sheet.getByRole('button', { name: 'Retirer Son 27' }).click();
  await expect(sheet.locator('li')).toHaveCount(3);
  await page.screenshot({ path: 'docs/captures/R/r6-a-suivre.png' });
});
