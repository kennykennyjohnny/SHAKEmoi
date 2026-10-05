import { test, expect } from '@playwright/test';
import { mockBackend, LEA } from './mock/backend';

// R1 : une seule fonction de date (formatPostDate) et la date dans le post ouvert.
const pid = (k: number) => `00000000-0000-4000-a000-${String(k).padStart(12, '0')}`;

test('formatPostDate : tous les cas', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const m: any = await import('/src/lib/dates.ts');
    const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    // Hier à 00:00:30 : toujours à plus de 24 h et à 1 jour de calendrier.
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0, 0, 30, 0);
    const old = new Date(); old.setDate(old.getDate() - 20);
    const lastYear = new Date(new Date().getFullYear() - 1, 8, 12, 21, 14);
    return {
      now: m.formatPostDate(ago(0)), min: m.formatPostDate(ago(5)), h: m.formatPostDate(ago(180)),
      yesterday: m.formatPostDate(y),
      days: m.formatPostDate(ago(60 * 24 * 4 + 30)), old: m.formatPostDate(old), lastYear: m.formatPostDate(lastYear),
      full: m.formatPostDateFull(lastYear), year: lastYear.getFullYear(),
    };
  });
  expect(r.now).toBe("à l'instant");
  expect(r.min).toBe('il y a 5 min');
  expect(r.h).toBe('il y a 3 h');
  expect(r.yesterday).toBe('hier');
  expect(r.days).toBe('il y a 4 j');
  expect(r.old).toMatch(/^\d{1,2} [a-zéû]+$/);
  expect(r.lastYear).toBe(`12 septembre ${r.year}`);
  expect(r.full).toBe(`12 septembre ${r.year} à 21:14`);
});

test('post ouvert : date qui suit le pager, toucher = date complète', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.evaluate((id) => { window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: `profile:${id}` })); }, LEA);
  // Pas de date sur les vignettes de la grille.
  const thumb = page.locator(`[data-thumb="${pid(0)}"]`);
  await expect(thumb).toBeVisible();
  await expect(thumb).not.toContainText(/il y a|hier/);
  await thumb.click();
  const active = page.locator('[role="dialog"][aria-label="Shake"] [aria-hidden="false"]');
  const date = active.locator('[data-post-date] button').first();
  await expect(date).toHaveText('il y a 1 h');
  await date.click();
  await expect(date).toHaveText(/^\d{1,2} [a-zéû]+ \d{4} à \d{2}:\d{2}$/);
  await page.screenshot({ path: 'docs/captures/R/r1-date-post.png' });
  await page.keyboard.press('ArrowRight');
  await expect(active.locator('h3')).toHaveText('Titre 2');
  await expect(active.locator('[data-post-date] button').first()).toHaveText('il y a 2 h');
});
