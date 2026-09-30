import { test, expect, type Page } from '@playwright/test';

// Parcours sans compte (+ connexion si E2E_EMAIL / E2E_PASSWORD sont fournis).
const SONG_SLUG = process.env.E2E_SONG_SLUG || '0sg80xj4vj';
const PROFILE = process.env.E2E_PROFILE || 'kenny';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screens/${test.info().project.name}-${name}.png`, fullPage: false });
}

test('accueil sans compte', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('img[alt="SHAKEmoi"]').first()).toBeVisible();
  // Pas de défilement horizontal parasite.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, 'accueil');
  expect(errors).toEqual([]);
});

test('lien de son partagé', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`/s/${SONG_SLUG}`);
  await expect(page.getByText(/On t.a partagé ce son/)).toBeVisible();
  const spotify = page.getByRole('link', { name: /Écouter sur Spotify/ });
  await expect(spotify).toBeVisible();
  await expect(spotify).toHaveAttribute('href', /^https:\/\/(open\.spotify\.com|www\.deezer\.com|music\.apple\.com)/);
  await shot(page, 'son-partage');
  expect(errors).toEqual([]);
});

test('profil public', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`/u/${PROFILE}`);
  await expect(page.getByText(`@${PROFILE}`).first()).toBeVisible();
  await shot(page, 'profil-public');
  expect(errors).toEqual([]);
});

test('ancien lien de profil avec majuscules', async ({ page }) => {
  await page.goto(`/u/${PROFILE.charAt(0).toUpperCase()}${PROFILE.slice(1)}`);
  await expect(page.getByText(`@${PROFILE}`).first()).toBeVisible();
});

test('aperçu de lien (carte de partage)', async ({ request }) => {
  const res = await request.get(`/s/${SONG_SLUG}`, { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toMatch(/og:image/);
});

test('connexion avec le compte de test', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'E2E_EMAIL / E2E_PASSWORD non fournis');
  await page.goto('/');
  await page.getByRole('button', { name: /Se connecter|J.ai déjà un compte/ }).first().click();
  await page.getByPlaceholder(/mail/i).fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder(/mot de passe/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /Se connecter|Connexion/ }).last().click();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible({ timeout: 20_000 });
  await shot(page, 'connecte');
});
