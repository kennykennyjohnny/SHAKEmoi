// ============================================
// SPOTIFY API - CLIENT CREDENTIALS
// ============================================

const SPOTIFY_CLIENT_ID = 'c26941b671a940ef93bd386d6f4c8c82';

class SpotifyAPI {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Obtenir un access token (client credentials)
  async getAccessToken() {
    // Si token encore valide, le réutiliser
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      // Demander un nouveau token
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=client_credentials&client_id=${SPOTIFY_CLIENT_ID}`
      });

      if (!response.ok) {
        throw new Error('Failed to get Spotify access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      console.log('✅ Spotify access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting Spotify token:', error);
      throw error;
    }
  }

  // Récupérer le Top 100 France
  async getTop100France() {
    try {
      const token = await this.getAccessToken();

      // Playlist Top 100 France officielle Spotify
      const playlistId = '37i9dQZEVXbIPWwFssbupI';

      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Top 100');
      }

      const data = await response.json();

      return data.items.map((item, index) => ({
        rank: index + 1,
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists[0].name,
        artists: item.track.artists.map(a => a.name).join(', '),
        artistId: item.track.artists[0].id,
        cover: item.track.album.images[0]?.url || 'https://via.placeholder.com/300x300?text=No+Cover',
        preview_url: item.track.preview_url,
        spotify_url: item.track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error fetching Top 100:', error);
      return [];
    }
  }

  // Rechercher des tracks
  async searchTracks(query) {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20&market=FR`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search tracks');
      }

      const data = await response.json();

      return data.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0].id,
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
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch artist info');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error getting artist:', error);
      return null;
    }
  }

  // Récupérer top tracks d'un artiste
  async getArtistTopTracks(artistId) {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=FR`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch artist top tracks');
      }

      const data = await response.json();

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
}

// Initialiser
const spotify = new SpotifyAPI();
console.log('🎵 Spotify API initialized');
