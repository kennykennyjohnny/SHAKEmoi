// ============================================
// SPOTIFY API via Supabase Edge Function
// ============================================

const EDGE_FUNCTION_URL = 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/spotify-proxy';

class SpotifyAPI {
  constructor() {
    this.supabase = supabase; // Instance Supabase globale
  }

  // Appeler l'Edge Function
  async callEdgeFunction(action, params = {}) {
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ action, ...params })
      });

      if (!response.ok) {
        throw new Error(`Edge Function error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Spotify API error:', error);
      throw error;
    }
  }

  // Récupérer le Top 100 France
  async getTop100France() {
    const data = await this.callEdgeFunction('top100');

    return data.items.map((item, index) => ({
      rank: index + 1,
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists[0].name,
      artists: item.track.artists.map(a => a.name).join(', '),
      album: item.track.album.name,
      cover: item.track.album.images[0]?.url,
      coverMedium: item.track.album.images[1]?.url,
      coverSmall: item.track.album.images[2]?.url,
      preview_url: item.track.preview_url,
      spotify_url: item.track.external_urls.spotify,
      duration_ms: item.track.duration_ms
    }));
  }

  // Rechercher des tracks
  async searchTracks(query) {
    if (!query || query.length < 2) return [];

    const data = await this.callEdgeFunction('search', { query });

    if (!data.tracks || !data.tracks.items) return [];

    return data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      cover: track.album.images[1]?.url || track.album.images[0]?.url,
      preview_url: track.preview_url,
      spotify_url: track.external_urls.spotify
    }));
  }

  // Récupérer infos d'un artiste
  async getArtist(artistId) {
    return await this.callEdgeFunction('artist', { artistId });
  }

  // Récupérer top tracks d'un artiste
  async getArtistTopTracks(artistId) {
    const data = await this.callEdgeFunction('artist-top', { artistId });

    return data.tracks.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      cover: track.album.images[1]?.url,
      preview_url: track.preview_url
    }));
  }

  // Récupérer infos d'une track
  async getTrack(trackId) {
    return await this.callEdgeFunction('track', { query: trackId });
  }
}

// Initialiser l'API Spotify
const spotify = new SpotifyAPI();
console.log('🎵 Spotify API initialized (via Edge Function)');
