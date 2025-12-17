// Apple Music / iTunes Search helper
// Returns the best track URL found or null
async function fetchAppleTrackLink(trackName, artist) {
  try {
    const query = encodeURIComponent(`${trackName} ${artist}`);
    const url = `https://itunes.apple.com/search?term=${query}&country=FR&entity=song&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    // Try to find exact track match by name and artist (case-insensitive)
    const lowerTrack = trackName.toLowerCase();
    const lowerArtist = artist.toLowerCase();
    let best = data.results[0];

    for (const r of data.results) {
      if (r.trackName && r.artistName) {
        if (r.trackName.toLowerCase().includes(lowerTrack) && r.artistName.toLowerCase().includes(lowerArtist)) {
          best = r;
          break;
        }
      }
    }

    return best.trackViewUrl || best.collectionViewUrl || null;
  } catch (err) {
    console.error('fetchAppleTrackLink error', err);
    return null;
  }
}

window.fetchAppleTrackLink = fetchAppleTrackLink;
// ==================== APPLE MUSIC API ====================
// Utilise iTunes Search API pour obtenir les liens Apple Music

const ITUNES_API_BASE = 'https://itunes.apple.com/search';

// Rechercher un morceau sur Apple Music
async function searchAppleMusicTrack(trackName, artistName) {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const url = `${ITUNES_API_BASE}?term=${query}&media=music&entity=song&limit=1&country=FR`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('iTunes Search API error');
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      return {
        success: true,
        url: track.trackViewUrl, // Lien Apple Music
        previewUrl: track.previewUrl,
        artworkUrl: track.artworkUrl100
      };
    }

    return { success: false, error: 'Track not found' };
  } catch (error) {
    console.error('Apple Music search error:', error);
    return { success: false, error: error.message };
  }
}

// Générer le lien Apple Music pour un post
async function getAppleMusicLinkForPost(post) {
  // Si le lien Apple Music est déjà dans le post
  if (post.apple_music_url) {
    return post.apple_music_url;
  }

  // Sinon, chercher via l'API
  const result = await searchAppleMusicTrack(post.track_name, post.artist);
  if (result.success) {
    return result.url;
  }

  // Fallback : générer un lien de recherche Apple Music
  const query = encodeURIComponent(`${post.track_name} ${post.artist}`);
  return `https://music.apple.com/fr/search?term=${query}`;
}

// Exporter les fonctions
window.searchAppleMusicTrack = searchAppleMusicTrack;
window.getAppleMusicLinkForPost = getAppleMusicLinkForPost;
