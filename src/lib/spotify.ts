// SHAKEMOI - Spotify API via Supabase Edge Function
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/spotify-proxy`;

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  artists: string;
  album: string;
  cover: string;
  coverMedium?: string;
  coverSmall?: string;
  preview_url?: string;
  spotify_url: string;
  duration_ms?: number;
}

class SpotifyAPI {
  async callEdgeFunction(action: string, params: any = {}) {
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

  async getTop100France(): Promise<SpotifyTrack[]> {
    try {
      const data = await this.callEdgeFunction('top100');

      let tracks: any[];
      if (data.tracks && data.tracks.items) {
        tracks = data.tracks.items;
      } else if (data.items) {
        tracks = data.items.map((item: any) => item.track);
      } else {
        console.error('❌ No items in top100 response');
        return [];
      }

      return tracks.map((track: any, index: number) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map((a: any) => a.name).join(', '),
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
      return await this.searchPopularFrench();
    }
  }

  async searchPopularFrench(): Promise<SpotifyTrack[]> {
    try {
      const data = await this.callEdgeFunction('search', { query: 'année:2024 french rap' });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.slice(0, 50).map((track: any, index: number) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map((a: any) => a.name).join(', '),
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

  async getGlobalTop50(): Promise<SpotifyTrack[]> {
    try {
      const data = await this.callEdgeFunction('search', { query: 'year:2024 top hits' });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.slice(0, 50).map((track: any, index: number) => ({
        rank: index + 1,
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map((a: any) => a.name).join(', '),
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

  async searchTracks(query: string): Promise<SpotifyTrack[]> {
    if (!query || query.length < 2) return [];

    try {
      const data = await this.callEdgeFunction('search', { query });

      if (!data.tracks || !data.tracks.items) return [];

      return data.tracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map((a: any) => a.name).join(', '),
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

  async getArtist(artistId: string) {
    try {
      return await this.callEdgeFunction('artist', { artistId });
    } catch (error) {
      console.error('❌ Error getting artist:', error);
      return null;
    }
  }

  async getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
    try {
      const data = await this.callEdgeFunction('artist-top', { artistId });

      if (!data.tracks) return [];

      return data.tracks.map((track: any) => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name,
        artists: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        cover: track.album.images[1]?.url || track.album.images[0]?.url,
        preview_url: track.preview_url,
        spotify_url: track.external_urls.spotify
      }));
    } catch (error) {
      console.error('❌ Error getting artist top tracks:', error);
      return [];
    }
  }

  async getTrack(trackId: string) {
    try {
      return await this.callEdgeFunction('track', { query: trackId });
    } catch (error) {
      console.error('❌ Error getting track:', error);
      return null;
    }
  }

  async searchAlbums(query: string) {
    if (!query || query.length < 2) return [];

    try {
      const data = await this.callEdgeFunction('search-albums', { query });

      if (!data.albums || !data.albums.items) return [];

      return data.albums.items.map((album: any) => ({
        id: album.id,
        name: album.name,
        artist: album.artists[0].name,
        artists: album.artists.map((a: any) => a.name).join(', '),
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

// Initialize Spotify API
export const spotify = new SpotifyAPI();
console.log('🎵 Spotify API initialized (via Edge Function)');
