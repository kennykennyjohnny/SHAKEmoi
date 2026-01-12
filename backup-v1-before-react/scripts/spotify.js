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
        const errorData = await response.json();
        throw new Error(`Edge Function error: ${errorData.error || response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Spotify API error:', error);
      throw error;
    }
  }

  // Récupérer le Top 100 France
  async getTop100France() {
    try {
      const data = await this.callEdgeFunction('top100');

      // Le top100 retourne maintenant des résultats de recherche
      let tracks;
      if (data.tracks && data.tracks.items) {
        // Format search
        tracks = data.tracks.items;
      } else if (data.items) {
        // Format playlist
        tracks = data.items.map(item => item.track);
      } else {
        console.error('❌ No items in top100 response');
        return [];
      }

      return tracks.map((track, index) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0].id,
        album: track.album.name,
        cover: track.album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        coverMedium: track.album.images[1]?.url,
        coverSmall: track.album.images[2]?.url,
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify,
        duration_ms: track.duration_ms
      }));
    } catch (error) {
      console.error('❌ Error fetching Top 100:', error);
      // Fallback: rechercher des tracks populaires françaises
      console.log('⚠️ Fallback: Searching for popular French tracks...');
      return await this.searchPopularFrench();
    }
  }

  // Fallback: rechercher des tracks populaires françaises
  async searchPopularFrench() {
    try {
      const data = await this.callEdgeFunction('search', { query: 'année:2024 french rap' });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.slice(0, 50).map((track, index) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0].id,
        album: track.album.name,
        cover: track.album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error in fallback search:', error);
      return [];
    }
  }

  // Récupérer le Top 50 Global Spotify
  async getGlobalTop50() {
    try {
      // Rechercher des tracks populaires récentes
      const data = await this.callEdgeFunction('search', { query: 'year:2024 top hits' });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.slice(0, 50).map((track, index) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0].id,
        album: track.album.name,
        cover: track.album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error in getGlobalTop50:', error);
      return [];
    }
  }

  // Rechercher des tracks
  async searchTracks(query) {
    if (!query || query.length < 2) return [];

    try {
      const data = await this.callEdgeFunction('search', { query });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0].id,
        album: track.album.name,
        cover: track.album.images[1]?.url || track.album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error searching tracks:', error);
      return [];
    }
  }

  // Récupérer infos d'un artiste
  async getArtist(artistId) {
    try {
      return await this.callEdgeFunction('artist', { artistId });
    } catch (error) {
      console.error('❌ Error getting artist:', error);
      return null;
    }
  }

  // Récupérer top tracks d'un artiste
  async getArtistTopTracks(artistId) {
    try {
      const data = await this.callEdgeFunction('artist-top', { artistId });

      if (!data.tracks) return [];

      return data.tracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        cover: track.album.images[1]?.url || track.album.images[0]?.url,
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error getting artist top tracks:', error);
      return [];
    }
  }

  // Récupérer infos d'une track
  async getTrack(trackId) {
    try {
      return await this.callEdgeFunction('track', { query: trackId });
    } catch (error) {
      console.error('❌ Error getting track:', error);
      return null;
    }
  }

  // Rechercher des albums
  async searchAlbums(query) {
    if (!query || query.length < 2) return [];

    try {
      const data = await this.callEdgeFunction('search-albums', { query });

      if (!data.albums || !data.albums.items) return [];

      return data.albums.items.map(album => ({
        id: album.id,
        name: album.name,
        artist: album.artists[0].name,
        artists: album.artists.map(a => a.name).join(', '),
        images: album.images,
        cover: album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        coverMedium: album.images[1]?.url,
        coverSmall: album.images[2]?.url,
        release_date: album.release_date,
        spotify_url: album.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error searching albums:', error);
      return [];
    }
  }
}

// Initialiser l'API Spotify
const spotify = new SpotifyAPI();
console.log('🎵 Spotify API initialized (via Edge Function)');
