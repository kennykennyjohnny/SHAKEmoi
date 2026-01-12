import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7dbfc935`;

// Spotify API
export const searchSpotify = async (query: string) => {
  const url = `${API_BASE}/spotify/search?q=${encodeURIComponent(query)}`;
  
  console.log(`[SPOTIFY API] Searching:`, query);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[SPOTIFY API] Error:`, error);
    throw new Error('Failed to search Spotify');
  }

  const data = await response.json();
  console.log(`[SPOTIFY API] Found ${data.tracks.length} tracks`);
  return data.tracks;
};

export const getSpotifyRecommendations = async () => {
  const url = `${API_BASE}/spotify/recommendations`;
  
  console.log(`[SPOTIFY API] Getting recommendations`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[SPOTIFY API] Error:`, error);
    throw new Error('Failed to get recommendations');
  }

  const data = await response.json();
  console.log(`[SPOTIFY API] Got ${data.tracks.length} recommendations`);
  return data.tracks;
};
