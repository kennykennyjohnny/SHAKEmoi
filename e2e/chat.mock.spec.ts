import { test, expect } from '@playwright/test';
import { mockBackend, CIRCLE } from './mock/backend';

// Q6 + Q13 : une conversation garde son adresse, se rouvre à l'actualisation,
// et s'ouvre directement sur le DERNIER message (photos comprises).

async function lastMessageVisible(page: import('@playwright/test').Page) {
  const box = page.locator('[data-chat-scroll]');
  await expect(box).toBeVisible();
  // Laisse les photos (chargées avec retard) finir de pousser le contenu.
  await page.waitForTimeout(2500);
  return box.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

test('conversation privée : actualiser reste dessus, ouverte en bas', async ({ page }) => {
  const { unhandled } = await mockBackend(page, { log: true });
  await page.goto('/messages');
  await page.getByText('Léa', { exact: true }).first().click();
  await expect(page).toHaveURL(/\/messages\/lea$/);
  expect(await lastMessageVisible(page)).toBeLessThan(4);

  await page.reload();
  await expect(page).toHaveURL(/\/messages\/lea$/);
  await expect(page.getByText('@lea').first()).toBeVisible();
  expect(await lastMessageVisible(page)).toBeLessThan(4);
  console.log('non simulé :', [...unhandled].join('\n'));
});

test('cercle : actualiser reste dessus, ouvert en bas', async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/cercles/${CIRCLE}`);
  await expect(page.getByText('Les potes').first()).toBeVisible();
  expect(await lastMessageVisible(page)).toBeLessThan(4);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/cercles/${CIRCLE}$`));
  expect(await lastMessageVisible(page)).toBeLessThan(4);
});

test('profil, aperçu et post : actualiser garde l’écran', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/profil');
  await page.reload();
  await expect(page).toHaveURL(/\/profil$/);
  await page.goto('/post/00000000-0000-4000-a000-000000000000');
  await expect(page.getByText('Titre 1').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Titre 1').first()).toBeVisible();
});
