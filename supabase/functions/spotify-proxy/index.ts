import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Relais Spotify. La passerelle Supabase vérifie déjà le JWT (anon ou membre).
// On ajoute :
//  - une liste d'origines autorisées (un autre site ne peut pas s'en servir
//    depuis le navigateur de ses visiteurs) ;
//  - une limite simple par IP, plus large pour les membres connectés
//    (les visiteurs sans compte gardent la recherche de sons, c'est voulu) ;
//  - des entrées validées (identifiants Spotify, longueur de la recherche).

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?shakemoi\.fr$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.some((r) => r.test(origin)) ? origin : 'https://www.shakemoi.fr';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// Spotify credentials (Client Secret stocké en variable d'environnement)
const SPOTIFY_CLIENT_ID = 'c26941b671a940ef93bd386d6f4c8c82';
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')!;

// Limite par IP, sur une fenêtre glissante d'une minute (mémoire de l'instance).
const WINDOW_MS = 60_000;
const LIMIT_MEMBER = 120;
const LIMIT_VISITOR = 40;
const hits = new Map<string, number[]>();

function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > limit;
}

// Le JWT est déjà vérifié par la passerelle : on lit seulement son rôle.
function roleFromAuth(header: string | null): string {
  try {
    const token = (header || '').replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role || 'anon';
  } catch {
    return 'anon';
  }
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

// Cache du token
let cachedToken: { token: string; expiry: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const auth = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify token');
  }

  const data = await response.json();

  // Mettre en cache (expire dans 1h, on rafraîchit 5 min avant)
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + ((data.expires_in - 300) * 1000)
  };

  return cachedToken.token;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  // Appel depuis un navigateur : seulement depuis nos sites.
  // (Sans Origin = appel serveur, par ex. api/links sur Vercel.)
  if (origin && !ALLOWED_ORIGINS.some((r) => r.test(origin))) {
    return json({ error: 'origin not allowed' }, 403, origin);
  }

  const role = roleFromAuth(req.headers.get('authorization'));
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const isMember = role === 'authenticated';
  if (rateLimited(`${isMember ? 'm' : 'v'}:${ip}`, isMember ? LIMIT_MEMBER : LIMIT_VISITOR)) {
    return json({ error: 'too many requests' }, 429, origin);
  }

  try {
    const { action, query, artistId } = await req.json();
    const q = typeof query === 'string' ? query.trim().slice(0, 120) : '';

    let url = '';

    switch (action) {
      case 'top100':
        url = 'https://api.spotify.com/v1/search?q=year:2024&type=track&market=FR&limit=50';
        break;

      case 'search':
        if (!q) return json({ error: 'missing query' }, 400, origin);
        url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&market=FR&limit=20`;
        break;

      case 'search-albums':
        if (!q) return json({ error: 'missing query' }, 400, origin);
        url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&market=FR&limit=20`;
        break;

      case 'artist':
        if (!SPOTIFY_ID.test(artistId || '')) return json({ error: 'bad id' }, 400, origin);
        url = `https://api.spotify.com/v1/artists/${artistId}`;
        break;

      case 'artist-top':
        if (!SPOTIFY_ID.test(artistId || '')) return json({ error: 'bad id' }, 400, origin);
        url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=FR`;
        break;

      case 'track':
        if (!SPOTIFY_ID.test(q)) return json({ error: 'bad id' }, 400, origin);
        url = `https://api.spotify.com/v1/tracks/${q}`;
        break;

      default:
        return json({ error: 'Invalid action' }, 400, origin);
    }

    const token = await getSpotifyToken();
    const spotifyResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!spotifyResponse.ok) {
      return json({ error: `Spotify API error: ${spotifyResponse.status}` }, spotifyResponse.status === 429 ? 429 : 502, origin);
    }

    const data = await spotifyResponse.json();
    return json(data, 200, origin);

  } catch (error) {
    return json({ error: (error as Error).message }, 500, origin);
  }
});
