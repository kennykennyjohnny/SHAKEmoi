import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Spotify credentials (Client Secret stocké en variable d'environnement)
const SPOTIFY_CLIENT_ID = 'c26941b671a940ef93bd386d6f4c8c82';
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')!;

// Cache du token
let cachedToken: { token: string; expiry: number } | null = null;

// Fonction pour obtenir un access token Spotify
async function getSpotifyToken(): Promise<string> {
  // Si token en cache et encore valide, le réutiliser
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  // Sinon, demander un nouveau token
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, query, artistId, playlistId } = await req.json();
    const token = await getSpotifyToken();

    let url = '';

    // Router selon l'action demandée
    switch(action) {
      case 'top100':
        // Utiliser la recherche pour les tracks populaires en France
        // Car les playlists peuvent changer d'ID
        url = 'https://api.spotify.com/v1/search?q=year:2024&type=track&market=FR&limit=50';
        break;

      case 'search':
        url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=FR&limit=20`;
        break;

      case 'artist':
        url = `https://api.spotify.com/v1/artists/${artistId}`;
        break;

      case 'artist-top':
        url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=FR`;
        break;

      case 'track':
        url = `https://api.spotify.com/v1/tracks/${query}`;
        break;

      default:
        throw new Error('Invalid action');
    }

    // Appeler l'API Spotify
    const spotifyResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!spotifyResponse.ok) {
      throw new Error(`Spotify API error: ${spotifyResponse.status}`);
    }

    const data = await spotifyResponse.json();

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
