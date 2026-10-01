import { test, expect } from '@playwright/test';

// P13 : sur ordinateur, cliquer à la suite sur 3 conversations / cercles de la
// colonne de gauche ouvre CHAQUE FOIS le bon (avant : la réponse la plus lente
// gagnait, ou l'écran restait sur l'ancien contenu).
// Demande un compte de test : E2E_EMAIL / E2E_PASSWORD (jamais un vrai compte).
for (const width of [1280, 1440]) {
  test(`colonne Messages/Cercles : 3 clics à la suite (${width} px)`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'ordinateur seulement');
    test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'E2E_EMAIL / E2E_PASSWORD non fournis');
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Se connecter|J.ai déjà un compte/ }).first().click();
    await page.getByPlaceholder(/mail/i).fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder(/mot de passe/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /Se connecter|Connexion/ }).last().click();

    const items = page.getByTestId('inbox-item');
    await expect(items.first()).toBeVisible({ timeout: 20_000 });
    const count = await items.count();
    test.skip(count < 3, 'le compte de test doit avoir au moins 3 conversations ou cercles');

    // Clics rapides, sans attendre : seul le dernier doit compter.
    for (const order of [[0, 1, 2], [2, 0, 1]]) {
      for (const i of order) await items.nth(i).click();
      const last = await items.nth(order[order.length - 1]).getAttribute('data-title');
      await expect(page.getByTestId('chat-title')).toHaveText(last!, { timeout: 10_000 });
    }
    // Puis un par un : chaque clic ouvre le bon.
    for (const i of [1, 2, 0]) {
      await items.nth(i).click();
      const title = await items.nth(i).getAttribute('data-title');
      await expect(page.getByTestId('chat-title')).toHaveText(title!, { timeout: 10_000 });
    }
  });
}
