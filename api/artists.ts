// SHAKEMOI - Artistes pour « Choisis au moins 3 artistes que tu aimes » (Q9).
// Deezer ne peut pas être appelé directement depuis le navigateur (CORS) :
// ce relais le fait, avec un cache CDN (les réponses changent peu).
//   GET /api/artists?q=tiakola         → recherche
//   GET /api/artists?related=<id>      → 4 artistes proches (« comme Spotify »)
//   GET /api/artists?family=Rap|mix    → artistes populaires en France par famille
// Réponse : { artists: [{ id, name, picture }] } (photo 250 px : légère en 4G).

type Artist = { id: string; name: string; picture: string | null };

const json = (body: unknown, status = 200, cache = 'public, s-maxage=86400, stale-while-revalidate=604800') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

// Populaires en France, par famille (même découpage que la base : genre_family).
// Les classements Deezer dépendent du pays du serveur : une liste choisie est plus sûre.
const POPULAR: Record<string, string[]> = {
  'Rap': ['Ninho', 'Jul', 'Tiakola', 'Gazo', 'SDM', 'Werenoi', 'PLK', 'Damso', 'Orelsan', 'Hamza', 'Niska', 'Booba'],
  'Afro': ['Aya Nakamura', 'Burna Boy', 'Wizkid', 'Tayc', 'Rema', 'Dadju', 'Ayra Starr', 'Fally Ipupa', 'Tems', 'Asake', 'Davido', 'Joé Dwèt Filé'],
  'Latin': ['Bad Bunny', 'Karol G', 'Feid', 'Rauw Alejandro', 'Peso Pluma', 'Rosalía', 'J Balvin', 'Shakira', 'Myke Towers', 'Quevedo', 'Ozuna', 'Anuel AA'],
  'R&B': ['SZA', 'The Weeknd', 'Frank Ocean', 'Daniel Caesar', 'Brent Faiyaz', 'Summer Walker', 'Giveon', 'Kehlani', 'Chris Brown', 'H.E.R.', 'Lithe', 'Bryson Tiller'],
  'Pop': ['Taylor Swift', 'Dua Lipa', 'Billie Eilish', 'Sabrina Carpenter', 'Angèle', 'Stromae', 'Clara Luciani', 'Harry Styles', 'Olivia Rodrigo', 'Pierre Garnier', 'Zaho de Sagazan', 'Chappell Roan'],
  'Électro': ['David Guetta', 'DJ Snake', 'Fred again..', 'Daft Punk', 'Justice', 'Calvin Harris', 'Kungs', 'Martin Garrix', 'Disclosure', 'Kavinsky', 'Bob Sinclar', 'Charlotte de Witte'],
  'Rock': ['Arctic Monkeys', 'Imagine Dragons', 'Coldplay', 'Måneskin', 'Indochine', 'The Strokes', 'Tame Impala', 'Muse', 'Red Hot Chili Peppers', 'Linkin Park', 'Gorillaz', 'Nirvana'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const toArtist = (a: any): Artist | null => (a?.id && a?.name ? { id: String(a.id), name: a.name, picture: a.picture_medium || a.picture || null } : null);

async function dz(path: string): Promise<any> {
  const r = await fetch(`https://api.deezer.com${path}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.error ? null : j;
}

async function byName(name: string): Promise<Artist | null> {
  const j = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=5`);
  const list: any[] = j?.data || [];
  return toArtist(list.find((a) => norm(a.name) === norm(name)) || list[0]);
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim().slice(0, 60);
  const related = (p.get('related') || '').trim();
  const family = (p.get('family') || '').trim();
  try {
    if (q) {
      const j = await dz(`/search/artist?q=${encodeURIComponent(q)}&limit=12`);
      return json({ artists: (j?.data || []).map(toArtist).filter(Boolean) }, 200, 'public, s-maxage=3600');
    }
    if (/^\d{1,12}$/.test(related)) {
      const j = await dz(`/artist/${related}/related?limit=4`);
      return json({ artists: (j?.data || []).map(toArtist).filter(Boolean) });
    }
    if (family) {
      const names = family === 'mix'
        // Un mélange : les 4 premiers de chaque famille, entrelacés.
        ? [0, 1, 2, 3].flatMap((i) => Object.values(POPULAR).map((l) => l[i]))
        : POPULAR[family] || [];
      const found = await Promise.all(names.map((n) => byName(n).catch(() => null)));
      return json({ artists: found.filter(Boolean), families: Object.keys(POPULAR) });
    }
    return json({ families: Object.keys(POPULAR) });
  } catch {
    return json({ error: 'unavailable', artists: [] }, 502, 'no-store');
  }
}
