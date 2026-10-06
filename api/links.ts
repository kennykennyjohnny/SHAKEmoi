// SHAKEMOI - Liens d'un son sur chaque plateforme (remplace l'API Odesli,
// fermée au public : « PUBLIC_API_ACCESS_DEPRECATED »).
//
// GET /api/links?spotify=<url|id>&title=&artist=&isrc=
//   → { title, artist, cover, isrc, preview, links: { spotify, apple_music,
//       deezer, youtube_music, youtube }, exact: { … } }
//
// Chaîne de résolution, sans clé d'API (budget total 8 s) :
//   1. Spotify (proxy Supabase existant) : métadonnées + ISRC. S'il traîne,
//      Deezer / iTunes par titre + artiste partent sans l'attendre.
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

// ---- Appels aux sources : délai par appel, reprise courte sur le quota Deezer,
// et une raison d'échec par source pour le journal (logs Vercel). ----

/** Budget total de la fonction (limite Vercel : 15 s, vercel.json). */
const BUDGET_MS = 8000;

type Why = string; // 'ok' | 'introuvable' | 'délai' | 'quota' | 'HTTP 403' | 'réseau' | 'sans extrait'…

interface Fetched { data: any | null; why: Why }

async function getJson(url: string, init: RequestInit | undefined, deadline: number, ms = 4000): Promise<Fetched> {
  const left = Math.min(ms, deadline - Date.now());
  if (left < 300) return { data: null, why: 'délai' };
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(left) });
    if (!res.ok) return { data: null, why: `HTTP ${res.status}` };
    return { data: await res.json(), why: 'ok' };
  } catch (e: any) {
    return { data: null, why: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'délai' : 'réseau' };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Deezer répond 200 avec { error: { code: 4, message: "Quota limit exceeded" } }
// quand on dépasse 50 requêtes / 5 s (adresses Vercel partagées) : on attend un
// peu et on réessaie, deux fois au plus, sans dépasser le budget.
async function deezerJson(url: string, deadline: number): Promise<Fetched> {
  for (let attempt = 0; ; attempt++) {
    const r = await getJson(url, undefined, deadline, 3500);
    const code = r.data?.error?.code;
    if (code === 4 && attempt < 2 && deadline - Date.now() > 1500) { await sleep(400 + attempt * 500); continue; }
    if (code === 4) return { data: null, why: 'quota' };
    if (r.data?.error) return { data: null, why: code === 800 ? 'introuvable' : `erreur ${code ?? '?'}` };
    return r;
  }
}

function spotifyId(input: string | null): string | null {
  if (!input) return null;
  const m = input.match(/track[/:]([A-Za-z0-9]{22})/) || input.match(/^([A-Za-z0-9]{22})$/);
  return m ? m[1] : null;
}

async function spotifyProxy(body: object, deadline: number) {
  return getJson(`${SUPABASE_URL}/functions/v1/spotify-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  }, deadline, 3500);
}

interface SpotifyHit { title: string; artist: string; cover: string | null; isrc: string | null; preview: string | null; url: string }

async function fromSpotify(id: string | null, title: string, artist: string, deadline: number): Promise<{ hit: SpotifyHit | null; why: Why }> {
  let track: any = null;
  let why: Why = 'introuvable';
  if (id) {
    const r = await spotifyProxy({ action: 'track', query: id }, deadline);
    track = r.data;
    why = r.why;
  }
  if (!track?.id && title) {
    const r = await spotifyProxy({ action: 'search', query: `${title} ${artist}`.trim() }, deadline);
    track = pickBest<any>(r.data?.tracks?.items ?? [], title, artist, t => t.name, t => (t.artists ?? []).map((a: any) => a.name).join(' '));
    why = r.why === 'ok' ? (track ? 'ok' : 'introuvable') : r.why;
  }
  if (!track?.id) return { hit: null, why: why === 'ok' ? 'introuvable' : why };
  return {
    why: 'ok',
    hit: {
      title: track.name as string,
      artist: (track.artists ?? []).map((a: any) => a.name).join(', ') as string,
      cover: (track.album?.images?.[0]?.url ?? null) as string | null,
      isrc: (track.external_ids?.isrc ?? null) as string | null,
      preview: (track.preview_url ?? null) as string | null,
      url: `https://open.spotify.com/track/${track.id}`,
    },
  };
}

interface DeezerHit { id: string; url: string; preview: string | null }

async function deezerByIsrc(isrc: string, deadline: number): Promise<{ hit: DeezerHit | null; why: Why }> {
  const r = await deezerJson(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`, deadline);
  const t = r.data;
  if (!t?.id) return { hit: null, why: r.why === 'ok' ? 'introuvable' : r.why };
  return { hit: { id: String(t.id), url: `https://www.deezer.com/track/${t.id}`, preview: t.preview || null }, why: t.preview ? 'ok' : 'sans extrait' };
}

async function deezerBySearch(title: string, artist: string, deadline: number): Promise<{ hit: DeezerHit | null; why: Why }> {
  if (!title) return { hit: null, why: 'pas de titre' };
  const r = await deezerJson(`https://api.deezer.com/search?q=${encodeURIComponent(`${title} ${artist}`)}&limit=10`, deadline);
  const t = pickBest<any>(r.data?.data ?? [], title, artist, d => d.title, d => d.artist?.name || '');
  if (!t) return { hit: null, why: r.why === 'ok' ? 'introuvable' : r.why };
  return { hit: { id: String(t.id), url: `https://www.deezer.com/track/${t.id}`, preview: t.preview || null }, why: t.preview ? 'ok' : 'sans extrait' };
}

interface ItunesHit { url: string | null; preview: string | null; cover: string | null }

async function fromItunes(title: string, artist: string, deadline: number): Promise<{ hit: ItunesHit | null; why: Why }> {
  if (!title) return { hit: null, why: 'pas de titre' };
  let why: Why = 'introuvable';
  for (const country of ['FR', 'US']) {
    const r = await getJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}&media=music&entity=song&limit=15&country=${country}`,
      undefined, deadline, 3500,
    );
    if (r.why !== 'ok') { why = r.why; continue; }
    const t = pickBest<any>(r.data?.results ?? [], title, artist, x => x.trackName, x => x.artistName);
    if (t) {
      return {
        why: t.previewUrl ? 'ok' : 'sans extrait',
        hit: {
          url: String(t.trackViewUrl || '').replace(/[?&]uo=\d+/, '') || null,
          preview: t.previewUrl || null,
          cover: t.artworkUrl100 ? String(t.artworkUrl100).replace('100x100', '600x600') : null,
        },
      };
    }
  }
  return { hit: null, why };
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
  const t0 = Date.now();
  const deadline = t0 + BUDGET_MS;
  const q = new URL(req.url).searchParams;
  const askedTitle = (q.get('title') || '').slice(0, 200);
  const askedArtist = (q.get('artist') || '').slice(0, 200);
  let title = askedTitle;
  let artist = askedArtist;
  let isrc = q.get('isrc');

  // Spotify d'abord (métadonnées + ISRC). S'il traîne (> 1,5 s) et qu'on a déjà
  // le titre et l'artiste, Deezer et iTunes partent en parallèle sans l'attendre :
  // un proxy Spotify lent ne fait plus échouer le reste.
  // Spotify : 4,5 s au plus, pour laisser à Deezer / iTunes le temps de répondre.
  const spotifyP = fromSpotify(spotifyId(q.get('spotify')), title, artist, Math.min(deadline, t0 + 4500));
  let deezerSearchP: Promise<{ hit: DeezerHit | null; why: Why }> | null = null;
  let itunesP: Promise<{ hit: ItunesHit | null; why: Why }> | null = null;
  if (title) {
    const quick = await Promise.race([spotifyP, sleep(1500).then(() => null)]);
    if (!quick) {
      deezerSearchP = deezerBySearch(title, artist, deadline);
      itunesP = fromItunes(title, artist, deadline);
    }
  }
  const sp = await spotifyP;
  const spotify = sp.hit;
  if (spotify) {
    title = title || spotify.title;
    artist = artist || spotify.artist;
    isrc = isrc || spotify.isrc;
  }

  // Deezer : par ISRC (correspondance exacte) en priorité, sinon recherche
  // titre + artiste vérifiée (déjà lancée si Spotify traînait). iTunes en parallèle.
  itunesP = itunesP ?? fromItunes(title, artist, deadline);
  const NO_ISRC = { hit: null, why: 'pas d\'ISRC' } as { hit: DeezerHit | null; why: Why };
  const byIsrc = isrc ? await deezerByIsrc(isrc, deadline) : NO_ISRC;
  const bySearch = byIsrc.hit?.preview
    ? { hit: null, why: 'inutile' } as { hit: DeezerHit | null; why: Why }
    : await (deezerSearchP ?? deezerBySearch(title, artist, deadline));
  const it = await itunesP;
  const deezer = byIsrc.hit?.preview ? byIsrc.hit : bySearch.hit?.preview ? bySearch.hit : byIsrc.hit ?? bySearch.hit;
  const itunes = it.hit;
  const search = searchLinks(title, artist);

  // Extrait, dans l'ordre (M1) : Spotify, puis Deezer (adresse stable
  // /api/preview, l'extrait Deezer signé expirant au bout d'une heure), puis iTunes.
  const deezerPreview = deezer?.preview && deezer.id ? `${PREVIEW_ORIGIN}/api/preview?deezer=${deezer.id}` : null;
  const preview = spotify?.preview ?? deezerPreview ?? itunes?.preview ?? null;
  const previewSource = spotify?.preview ? 'spotify' : deezerPreview ? 'deezer' : itunes?.preview ? 'itunes' : null;
  const why = { spotify: sp.why, deezer_isrc: byIsrc.why, deezer_recherche: bySearch.why, itunes: it.why };

  const body: Resolved & { why: typeof why } = {
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
    // Pourquoi chaque source a échoué (diagnostic, aussi dans les logs Vercel).
    why,
  };

  // Journal : une ligne par résolution sans extrait ou avec une source en
  // erreur (délai, quota, HTTP…) — visible dans Vercel → Logs.
  const transient = Object.values(why).some((w) => w === 'délai' || w === 'quota' || w === 'réseau' || w.startsWith('HTTP') || w.startsWith('erreur'));
  if (!preview || transient) {
    console.log(`[links] ${preview ? `extrait ${previewSource}` : 'SANS EXTRAIT'} · « ${askedTitle || title} » — ${askedArtist || artist} · ${JSON.stringify(why)} · ${Date.now() - t0} ms`);
  }

  // Cache : long SEULEMENT quand un extrait est trouvé (les liens d'un son ne
  // bougent pas, l'extrait Deezer passe par une adresse stable). Sans extrait,
  // 5 min au plus : un raté passager (quota, délai) ne doit jamais devenir un
  // son muet pendant des semaines.
  const cacheControl = preview && !transient
    ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
    : preview
      ? 'public, max-age=3600, s-maxage=86400'
      : 'public, max-age=0, s-maxage=300';
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl,
    },
  });
}
