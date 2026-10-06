import { test, expect, type Page } from '@playwright/test';
import { mockBackend } from './mock/backend';

// Correctif 06/10 — sons illisibles.
//  S3 : un extrait mort se répare tout seul (résolution sans cache, base mise à jour) ;
//       sur un toucher, jamais de saut au son suivant à cause d'une erreur.
//  S5 : recherche sans extrait → bouton « Écouter sur … », aucune ouverture automatique.
//  S2 : une réponse sans extrait n'est pas gardée : après « fermer / rouvrir », ça rejoue.
const MOCK = 'https://mock.shakemoi.test';
const state = (page: Page) => page.evaluate(async () => {
  const p = await import('/src/lib/preview.ts');
  const pl = await import('/src/lib/player.ts');
  return { ...p.getPreviewState(), url: p.getCurrentPreviewUrl(), failedId: pl.getPlayer().failedId, index: pl.getPlayer().index };
});

/** /api/links et iTunes simulés : `preview` = ce que renvoie la résolution. */
async function mockLinks(page: Page, preview: () => string | null, seen: string[] = []) {
  await page.route('https://www.shakemoi.fr/api/links**', (route) => {
    seen.push(route.request().url());
    const p = preview();
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ title: 'X', artist: 'Y', cover: null, isrc: null, preview: p, previewSource: p ? 'deezer' : null, links: {}, exact: {} }),
    });
  });
  await page.route('https://itunes.apple.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"results":[]}' }));
  // Extrait mort (lien expiré, 404).
  await page.route(`${MOCK}/dead/**`, (route) => route.fulfill({ status: 404, body: 'gone' }));
}

const playTwo = (page: Page, first: string) => page.evaluate(async (u) => {
  const pl = await import('/src/lib/player.ts');
  return pl.playQueue([
    { id: 'post-a', title: 'Son A', artist: 'Artiste A', previewUrl: u, spotifyId: 'a'.repeat(22) },
    { id: 'post-b', title: 'Son B', artist: 'Artiste B', previewUrl: 'https://mock.shakemoi.test/audio/long-b.wav' },
  ], 0, { kind: 'feed', label: 'Fil' });
}, first);

test('extrait mort en base : réparé, joué, écrit en base', async ({ page }) => {
  const calls: string[] = [];
  const seen: string[] = [];
  await mockBackend(page, { calls });
  await mockLinks(page, () => `${MOCK}/audio/long-repare.wav`, seen);
  await page.goto('/');
  await playTwo(page, `${MOCK}/dead/a.mp3`);
  await expect.poll(async () => (await state(page)).url).toBe(`${MOCK}/audio/long-repare.wav`);
  await expect.poll(async () => (await state(page)).playing).toBe(true);
  expect((await state(page)).key).toBe('post-a'); // pas de saut au son B
  expect(seen.some((u) => u.includes('fresh='))).toBe(true); // résolution sans cache
  await expect.poll(() => calls.find((c) => c.startsWith('rpc repair_song_preview')) || '').toContain('long-repare.wav');
  // L'adresse morte est oubliée sur le téléphone.
  const dead = await page.evaluate(() => localStorage.getItem('shakemoi_dead_previews_v1') || '');
  expect(dead).toContain('/dead/a.mp3');
});

test('toucher : extrait mort et rien trouvé → « Écouter sur … », pas de saut', async ({ page }) => {
  await mockBackend(page);
  await mockLinks(page, () => null);
  await page.goto('/');
  await playTwo(page, `${MOCK}/dead/a.mp3`);
  await expect.poll(async () => (await state(page)).failedId).toBe('post-a');
  const s = await state(page);
  expect(s.index).toBe(0);
  expect(s.key).not.toBe('post-b');
});

test('enchaînement : un son illisible est sauté (et seulement là)', async ({ page }) => {
  await mockBackend(page);
  await mockLinks(page, () => null);
  await page.goto('/');
  await page.evaluate(async () => {
    const pl = await import('/src/lib/player.ts');
    await pl.playQueue([
      { id: 'post-0', title: 'Son 0', artist: 'A', previewUrl: 'https://mock.shakemoi.test/audio/z0.wav' },
      { id: 'post-a', title: 'Son A', artist: 'A', previewUrl: 'https://mock.shakemoi.test/dead/a.mp3' },
      { id: 'post-b', title: 'Son B', artist: 'B', previewUrl: 'https://mock.shakemoi.test/audio/long-b.wav' },
    ], 0, { kind: 'feed', label: 'Fil' });
  });
  // z0 dure 3 s, puis A (mort, irréparable) est sauté : B joue.
  await expect.poll(async () => (await state(page)).key, { timeout: 12000 }).toBe('post-b');
});

test('son touché absent de la file : jamais le 1er son à sa place', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  const ok = await page.evaluate(async () => {
    const pl = await import('/src/lib/player.ts');
    return pl.playQueue([{ id: 'post-0', title: 'Son 0', artist: 'A', previewUrl: 'https://mock.shakemoi.test/audio/z0.wav' }], -1, { kind: 'feed', label: 'Fil' });
  });
  expect(ok).toBe(false);
  expect((await state(page)).key).toBeNull();
});

async function searchAndTap(page: Page) {
  await page.route(`${MOCK}/functions/v1/spotify-proxy`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tracks: { items: [{ id: 'r'.repeat(22), name: 'Son rare', artists: [{ name: 'Inconnu' }], album: { name: 'A', images: [] }, preview_url: null, external_urls: { spotify: 'https://open.spotify.com/track/' + 'r'.repeat(22) } }] } }),
  }));
  await page.goto('/recherche');
  await page.getByPlaceholder(/Rechercher un son/).fill('son rare');
  const row = page.getByRole('heading', { name: 'Son rare' });
  await expect(row).toBeVisible({ timeout: 15000 });
  await page.locator('button:has(img[alt="Son rare"])').click();
}

test('recherche : son rare sans extrait → bouton, aucune ouverture automatique', async ({ page }) => {
  await mockBackend(page);
  await mockLinks(page, () => null);
  let popups = 0;
  page.on('popup', () => { popups++; });
  await searchAndTap(page);
  const btn = page.getByRole('button', { name: /Écouter sur Spotify/ });
  await expect(btn).toBeVisible();
  await page.waitForTimeout(800);
  expect(popups).toBe(0);
  await expect(page).toHaveURL(/\/recherche/);
  // Aucune réponse sans extrait gardée sur le téléphone.
  const cache = await page.evaluate(() => localStorage.getItem('shakemoi_links_cache_v3') || '{}');
  expect(cache).toBe('{}');
  await page.screenshot({ path: 'docs/captures/S/s5-recherche-sans-extrait.png' });
});

test('fermer / rouvrir : un ancien échec ne bloque plus', async ({ page }) => {
  await mockBackend(page);
  let preview: string | null = null;
  await mockLinks(page, () => preview);
  await searchAndTap(page);
  await expect(page.getByRole('button', { name: /Écouter sur Spotify/ })).toBeVisible();
  // La source revient (quota levé) ; on « ferme et rouvre » l'appli.
  preview = `${MOCK}/audio/long-r.wav`;
  await page.reload();
  await searchAndTap(page);
  await expect.poll(async () => (await state(page)).playing).toBe(true);
  expect((await state(page)).key).toBe('search-' + 'r'.repeat(22));
});
