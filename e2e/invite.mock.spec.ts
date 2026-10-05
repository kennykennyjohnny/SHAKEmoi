import { test, expect, type Browser } from '@playwright/test';
import { mockBackend, LEA } from './mock/backend';

// R8 : le lien d'invitation /i/<pseudo> ouvert depuis Instagram perdait
// l'invitation. Navigateur neuf à chaque fois (aucune trace d'une visite
// précédente), avec les vraies signatures des navigateurs intégrés.
const UA = {
  instaAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 Instagram 346.0.0.34.92 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; fr_FR; 634108199)',
  instaIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 346.0.2.27.88 (iPhone15,2; iOS 17_6; fr_FR; fr; scale=3.00; 1179x2556; 634256458)',
  // WhatsApp ouvre les liens dans Chrome (onglet personnalisé) : signature de Chrome.
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36',
};

async function freshPage(browser: Browser, ua: string, opts: Parameters<typeof mockBackend>[1] = {}) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const calls: string[] = [];
  await mockBackend(page, { visitor: true, calls, ...opts });
  return { ctx, page, calls };
}

async function signUp(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('Pseudo (ex. kenny.shake)').fill('nouveau');
  await page.getByPlaceholder('Email').fill('nouveau@exemple.test');
  await page.getByPlaceholder('Mot de passe').fill('motdepasse-essai-123');
  await page.locator('button[type="submit"]').click();
}

test.describe('R8 — invitation depuis Instagram', () => {
  test.skip(({ isMobile }) => !isMobile, 'téléphone');

  test('l’adresse garde l’invitation (sinon « Ouvrir dans Chrome » la perd)', async ({ browser }) => {
    const { ctx, page } = await freshPage(browser, UA.instaAndroid);
    await page.goto('/i/lea');
    await expect(page.getByText(/t'invite|t’invite/i).first()).toBeVisible();
    await page.waitForTimeout(1200);
    expect(page.url(), 'adresse après chargement').toMatch(/\/i\/lea|ref=lea/);
    await page.getByRole('button', { name: /Rejoindre/ }).first().click();
    await page.waitForTimeout(300);
    expect(page.url(), 'adresse après « Rejoindre »').toMatch(/ref=lea/);
    await ctx.close();
  });

  test('inscription : invitation transmise (compte + base) et acceptée', async ({ browser }) => {
    const { ctx, page, calls } = await freshPage(browser, UA.instaIphone);
    await page.goto('/i/lea');
    await page.getByRole('button', { name: /Rejoindre/ }).first().click();
    // « Rejoindre » ouvre directement l'inscription (plus la connexion).
    await expect(page.locator('button[type="submit"]')).toHaveText(/S'inscrire/);
    await signUp(page);
    await expect.poll(() => calls.find((c) => c.startsWith('rpc accept_invite')) || '').toContain('"p_inviter":"lea"');
    const signup = calls.find((c) => c.startsWith('signup')) || '';
    expect(signup).toContain('"referrer":"lea"');
    expect(signup).toMatch(/ref=lea/); // retour du mail de confirmation
    await ctx.close();
  });

  test('lien ouvert ensuite dans le vrai navigateur (?ref=) : invitation gardée', async ({ browser }) => {
    // Le navigateur externe ne partage rien avec celui d'Instagram : seule l'adresse compte.
    const { ctx, page, calls } = await freshPage(browser, UA.whatsappAndroid);
    await page.goto('/?ref=lea');
    await page.getByRole('button', { name: /S'inscrire|Créer un compte|Rejoindre/ }).first().click();
    if (await page.locator('button[type="submit"]').textContent() !== "S'inscrire") await page.getByRole('button', { name: "S'inscrire" }).last().click();
    await signUp(page);
    await expect.poll(() => calls.find((c) => c.startsWith('rpc accept_invite')) || '').toContain('"p_inviter":"lea"');
    await ctx.close();
  });

  test('bandeau « navigateur d’Instagram » : Android → Chrome avec l’invitation', async ({ browser }) => {
    const { ctx, page } = await freshPage(browser, UA.instaAndroid);
    await page.goto('/i/lea');
    const open = page.getByRole('link', { name: /Ouvrir dans Chrome/ });
    await expect(open).toBeVisible();
    const href = await open.getAttribute('href');
    expect(href).toMatch(/^intent:\/\/.*\/i\/lea\?ref=lea#Intent;scheme=https;package=com\.android\.chrome;/);
    await page.screenshot({ path: 'docs/captures/R/r8-bandeau-android.png' });
    await ctx.close();
  });

  test('bandeau « navigateur d’Instagram » : iPhone → mode d’emploi + Copier le lien', async ({ browser }) => {
    const { ctx, page } = await freshPage(browser, UA.instaIphone);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.goto('/i/lea');
    await expect(page.getByText(/Ouvrir dans le navigateur externe|Ouvrir dans Safari/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Copier le lien/ }).click();
    await expect(page.getByText(/Lien copié/)).toBeVisible();
    await page.screenshot({ path: 'docs/captures/R/r8-bandeau-iphone.png' });
    await ctx.close();
  });

  test('pas de bandeau dans un vrai navigateur', async ({ browser }) => {
    const { ctx, page } = await freshPage(browser, UA.whatsappAndroid);
    await page.goto('/i/lea');
    await expect(page.getByText(/t'invite|t’invite/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Ouvrir dans Chrome/ })).toHaveCount(0);
    await ctx.close();
  });

  test('déjà connecté : invitation acceptée puis profil ouvert', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: UA.instaAndroid, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const calls: string[] = [];
    await mockBackend(page, { calls });
    await page.goto('/i/lea');
    await expect.poll(() => calls.find((c) => c.startsWith('rpc accept_invite')) || '').toContain('"p_inviter":"lea"');
    await expect(page.getByRole('dialog').getByText('Léa').first()).toBeVisible();
    expect(LEA).toBeTruthy();
    await ctx.close();
  });
});

// Même contrôle pour tous les liens partagés : pour un visiteur, l'adresse
// reste celle du lien (c'est elle que « Ouvrir dans Chrome / Safari » emporte).
for (const path of ['/s/abcdef123', '/p/00000000-0000-4000-a000-000000000001', '/u/lea', '/c/ABCD2345?by=lea', '/m']) {
  test(`adresse gardée pour un visiteur : ${path}`, async ({ browser, isMobile }) => {
    test.skip(!isMobile, 'téléphone');
    const { ctx, page } = await freshPage(browser, UA.instaIphone);
    await page.goto(path);
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(path);
    await ctx.close();
  });
}
