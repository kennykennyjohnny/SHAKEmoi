// SHAKEMOI — profils d'artistes pour la compatibilité musicale (P25 / N6).
// Pour chaque artiste partagé dans l'appli et pas encore connu :
//   1. genres fins Spotify (« french rap », « pop urbaine »…) ;
//   2. Deezer : artistes proches (Tiakola → Gazo, Leto…) et genre de l'album
//      en secours si Spotify n'a rien.
// Résultat rangé en base (artist_profiles) : on ne recherche jamais deux fois.
// Appelée par la base (tâche planifiée) avec le secret du coffre.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SPOTIFY_CLIENT_ID = 'c26941b671a940ef93bd386d6f4c8c82';
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET') || '';

let token: { value: string; exp: number } | null = null;
async function spotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_SECRET) return null;
  if (token && token.exp > Date.now()) return token.value;
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}` },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) return null;
  const j = await r.json();
  token = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return token.value;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function spotifyArtist(name: string) {
  const t = await spotifyToken();
  if (!t) return null;
  const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:${name}`)}&type=artist&limit=5&market=FR`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) return null;
  const items = (await r.json()).artists?.items || [];
  // Le bon artiste : même nom (sans accents), sinon le plus populaire.
  const exact = items.find((a: any) => norm(a.name) === norm(name));
  const a = exact || items[0];
  return a ? { id: a.id as string, name: a.name as string, genres: (a.genres || []) as string[] } : null;
}

async function deezerArtist(name: string) {
  const s = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`).then((r) => r.json()).catch(() => null);
  const list = s?.data || [];
  const a = list.find((x: any) => norm(x.name) === norm(name)) || list[0];
  if (!a) return null;
  const [rel, top] = await Promise.all([
    fetch(`https://api.deezer.com/artist/${a.id}/related?limit=10`).then((r) => r.json()).catch(() => null),
    fetch(`https://api.deezer.com/artist/${a.id}/top?limit=3`).then((r) => r.json()).catch(() => null),
  ]);
  let genres: string[] = [];
  const albumId = top?.data?.[0]?.album?.id;
  if (albumId) {
    const alb = await fetch(`https://api.deezer.com/album/${albumId}`).then((r) => r.json()).catch(() => null);
    genres = (alb?.genres?.data || []).map((g: any) => String(g.name));
  }
  return { id: String(a.id), related: (rel?.data || []).map((x: any) => String(x.name)), genres };
}

Deno.serve(async (req) => {
  try {
    const { data: cfg } = await db.rpc('push_internal_config');
    if (!cfg?.hook_secret || req.headers.get('x-push-secret') !== cfg.hook_secret) return new Response('forbidden', { status: 403 });
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 25, 60);
    const { data: missing, error } = await db.rpc('artists_to_enrich', { p_limit: limit });
    if (error) throw error;
    let done = 0;
    for (const row of missing || []) {
      const name: string = row.name;
      const [sp, dz] = await Promise.all([spotifyArtist(name).catch(() => null), deezerArtist(name).catch(() => null)]);
      const genres = [...new Set([...(sp?.genres || []), ...(sp?.genres?.length ? [] : dz?.genres || [])].map((g) => g.toLowerCase()))];
      await db.from('artist_profiles').upsert({
        artist_key: row.artist_key,
        name: sp?.name || name,
        spotify_id: sp?.id || null,
        deezer_id: dz?.id || null,
        genres,
        related: (dz?.related || []).map((r: string) => r.toLowerCase()),
        source: sp?.genres?.length ? 'spotify' : dz?.genres?.length ? 'deezer' : 'aucune',
        updated_at: new Date().toISOString(),
      });
      done++;
    }
    return Response.json({ done });
  } catch (e) {
    console.error('enrich', String(e));
    return new Response('error', { status: 500 });
  }
});

