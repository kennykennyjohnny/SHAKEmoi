// SHAKEMOI - Recherche de GIF (M5).
// GET /api/gifs?q=chat  → { gifs: [{ id, preview, url, width, height }] }
// GET /api/gifs         → tendances
//
// Tenor (utilisé avant) a fermé son API : « Tenor API is discontinued ».
// Fournisseurs possibles, clé gratuite à mettre dans les variables Vercel :
//   - KLIPY_API_KEY  (remplaçant conseillé par Google : https://klipy.com/developers)
//   - GIPHY_API_KEY  (https://developers.giphy.com)
// Sans clé : 503 « not_configured » (l'appli affiche un message clair).

type Gif = { id: string; preview: string; url: string; width?: number; height?: number };

const json = (body: unknown, status = 200, cache = 'public, s-maxage=600') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

async function fromKlipy(key: string, q: string): Promise<Gif[]> {
  const base = `https://api.klipy.com/api/v1/${encodeURIComponent(key)}/gifs`;
  const url = q ? `${base}/search?q=${encodeURIComponent(q)}&per_page=24&locale=fr` : `${base}/trending?per_page=24&locale=fr`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`klipy ${res.status}`);
  const data = await res.json();
  const items: any[] = data?.data?.data ?? [];
  return items.map((g) => ({
    id: String(g.id ?? g.slug),
    preview: g.file?.sm?.gif?.url || g.file?.xs?.gif?.url || g.file?.md?.gif?.url,
    url: g.file?.md?.gif?.url || g.file?.hd?.gif?.url || g.file?.sm?.gif?.url,
    width: g.file?.md?.gif?.width, height: g.file?.md?.gif?.height,
  })).filter((g) => g.preview && g.url);
}

async function fromGiphy(key: string, q: string): Promise<Gif[]> {
  const base = 'https://api.giphy.com/v1/gifs';
  const url = q
    ? `${base}/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&lang=fr&rating=pg-13`
    : `${base}/trending?api_key=${key}&limit=24&rating=pg-13`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`giphy ${res.status}`);
  const data = await res.json();
  return (data?.data ?? []).map((g: any) => ({
    id: g.id,
    preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
    url: g.images?.fixed_width?.url || g.images?.downsized?.url || g.images?.original?.url,
    width: Number(g.images?.fixed_width?.width) || undefined,
    height: Number(g.images?.fixed_width?.height) || undefined,
  })).filter((g: Gif) => g.preview && g.url);
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 80);
  const klipy = process.env.KLIPY_API_KEY;
  const giphy = process.env.GIPHY_API_KEY;
  if (!klipy && !giphy) return json({ error: 'not_configured', gifs: [] }, 503, 'no-store');
  try {
    const gifs = klipy ? await fromKlipy(klipy, q) : await fromGiphy(giphy!, q);
    return json({ gifs });
  } catch (e) {
    // Un fournisseur en panne : on essaie l'autre s'il est configuré.
    try {
      if (klipy && giphy) return json({ gifs: await fromGiphy(giphy, q) });
    } catch { /* les deux en panne */ }
    return json({ error: 'unavailable', gifs: [] }, 502, 'no-store');
  }
}
