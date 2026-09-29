// SHAKEMOI - Liens d'un son sur chaque plateforme (remplace l'API Odesli,
// fermée au public : « PUBLIC_API_ACCESS_DEPRECATED »).
//
// GET /api/links?spotify=<url|id>&title=&artist=&isrc=
//   → { title, artist, cover, isrc, preview, links: { spotify, apple_music,
//       deezer, youtube_music, youtube }, exact: { … } }
//
// Chaîne de résolution, sans clé d'API :
//   1. Spotify (proxy Supabase existant) : métadonnées + ISRC.
//   2. Deezer : par ISRC (correspondance exacte), sinon recherche vérifiée.
//   3. Apple Music : recherche iTunes vérifiée (titre ET artiste).
//   4. YouTube Music : pas d'API publique → page de recherche (le son y est en tête).
// Toute plateforme non trouvée retombe sur sa page de recherche : un bouton
// « Écouter sur … » mène toujours quelque part.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';

type Platform = 'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'youtube';

const PREVIEW_ORIGIN = 'https://www.shakemoi.fr';

interface Resolved {
  title: string | null;
  artist: string | null;
  cover: string | null;
  isrc: string | null;
  preview: string | null;
  previewSource: 'spotify' | 'deezer' | 'itunes' | null;
  links: Record<Platform, string | null>;
  exact: Record<Platform, boolean>;
}

// Comparaison tolérante (accents, ponctuation, casse, « feat. », « - Remastered »…).
function norm(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]\s*/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\b(feat|ft)\b.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sameSong(t1: string, a1: string, t2: string, a2: string): boolean {
  const T1 = norm(t1), T2 = norm(t2), A1 = norm(a1), A2 = norm(a2);
  if (!T1 || !T2) return false;
  const titleOk = T1 === T2 || T1.includes(T2) || T2.includes(T1);
  const artistOk = !A1 || !A2 || A1.includes(A2) || A2.includes(A1)
    || A1.split(' ').some(w => w.length > 2 && A2.split(' ').includes(w));
  return titleOk && artistOk;
}

// Parmi les candidats qui correspondent, préfère la version originale : titre
// identique d'abord, et pas de remix / live / version accélérée si on n'en a
// pas demandé.
const VARIANT = /(remix|live|acoustic|acoustique|sped up|slowed|instrumental|karaoke|version|edit)/i;
function pickBest<T>(items: T[], title: string, artist: string, t: (x: T) => string, a: (x: T) => string): T | null {
  const ok = items.filter(x => sameSong(t(x), a(x), title, artist));
  const wantVariant = VARIANT.test(title);
  const score = (x: T) =>
    (t(x).trim().toLowerCase() === title.trim().toLowerCase() ? 2 : 0) +
    (wantVariant || !VARIANT.test(t(x)) ? 1 : 0);
  return ok.sort((x, y) => score(y) - score(x))[0] ?? null;
}

async function getJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4500) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function spotifyId(input: string | null): string | null {
  if (!input) return null;
  const m = input.match(/track[/:]([A-Za-z0-9]{22})/) || input.match(/^([A-Za-z0-9]{22})$/);
  return m ? m[1] : null;
}

async function spotifyProxy(body: object) {
  return getJson(`${SUPABASE_URL}/functions/v1/spotify-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

async function fromSpotify(id: string | null, title: string, artist: string) {
  let track: any = null;
  if (id) track = await spotifyProxy({ action: 'track', query: id });
  if (!track?.id && title) {
    const res = await spotifyProxy({ action: 'search', query: `${title} ${artist}`.trim() });
    track = pickBest<any>(res?.tracks?.items ?? [], title, artist, t => t.name, t => (t.artists ?? []).map((a: any) => a.name).join(' '));
  }
  if (!track?.id) return null;
  return {
    title: track.name as string,
    artist: (track.artists ?? []).map((a: any) => a.name).join(', ') as string,
    cover: (track.album?.images?.[0]?.url ?? null) as string | null,
    isrc: (track.external_ids?.isrc ?? null) as string | null,
    preview: (track.preview_url ?? null) as string | null,
    url: `https://open.spotify.com/track/${track.id}`,
  };
}

async function fromDeezer(isrc: string | null, title: string, artist: string) {
  if (isrc) {
    const t = await getJson(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`);
    if (t?.id && !t.error) return { id: String(t.id), url: `https://www.deezer.com/track/${t.id}`, preview: t.preview || null };
  }
  if (!title) return null;
  const res = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(`${title} ${artist}`)}&limit=10`);
  const t = pickBest<any>(res?.data ?? [], title, artist, d => d.title, d => d.artist?.name || '');
  return t ? { id: String(t.id), url: `https://www.deezer.com/track/${t.id}`, preview: t.preview || null } : null;
}

async function fromItunes(title: string, artist: string) {
  if (!title) return null;
  for (const country of ['FR', 'US']) {
    const res = await getJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}&media=music&entity=song&limit=15&country=${country}`,
    );
    const t = pickBest<any>(res?.results ?? [], title, artist, r => r.trackName, r => r.artistName);
    if (t) {
      return {
        url: String(t.trackViewUrl || '').replace(/[?&]uo=\d+/, '') || null,
        preview: t.previewUrl || null,
        cover: t.artworkUrl100 ? String(t.artworkUrl100).replace('100x100', '600x600') : null,
      };
    }
  }
  return null;
}

function searchLinks(title: string, artist: string): Record<Platform, string> {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    apple_music: `https://music.apple.com/fr/search?term=${q}`,
    deezer: `https://www.deezer.com/search/${q}`,
    youtube_music: `https://music.youtube.com/search?q=${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
  };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  let title = (q.get('title') || '').slice(0, 200);
  let artist = (q.get('artist') || '').slice(0, 200);
  let isrc = q.get('isrc');

  const spotify = await fromSpotify(spotifyId(q.get('spotify')), title, artist);
  if (spotify) {
    title = title || spotify.title;
    artist = artist || spotify.artist;
    isrc = isrc || spotify.isrc;
  }

  const [deezer, itunes] = await Promise.all([fromDeezer(isrc, title, artist), fromItunes(title, artist)]);
  const search = searchLinks(title, artist);

  // Extrait, dans l'ordre (M1) : Spotify, puis Deezer (adresse stable
  // /api/preview, l'extrait Deezer signé expirant au bout d'une heure), puis iTunes.
  const deezerPreview = deezer?.preview && deezer.id ? `${PREVIEW_ORIGIN}/api/preview?deezer=${deezer.id}` : null;
  const preview = spotify?.preview ?? deezerPreview ?? itunes?.preview ?? null;
  const previewSource = spotify?.preview ? 'spotify' : deezerPreview ? 'deezer' : itunes?.preview ? 'itunes' : null;

  const body: Resolved = {
    title: title || null,
    artist: artist || null,
    cover: spotify?.cover ?? itunes?.cover ?? null,
    isrc: isrc ?? null,
    preview,
    previewSource,
    links: {
      spotify: spotify?.url ?? search.spotify,
      apple_music: itunes?.url ?? search.apple_music,
      deezer: deezer?.url ?? search.deezer,
      youtube_music: search.youtube_music,
      youtube: search.youtube,
    },
    exact: {
      spotify: !!spotify?.url,
      apple_music: !!itunes?.url,
      deezer: !!deezer?.url,
      youtube_music: false,
      youtube: false,
    },
  };

  // Les liens d'un son ne bougent pas (l'extrait Deezer passe par une adresse
  // stable) : une semaine en cache CDN.
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
