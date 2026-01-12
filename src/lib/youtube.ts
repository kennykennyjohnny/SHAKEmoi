// YouTube Data API v3 Integration
// Client ID: 335829434000-06sg4hfsrhssub1fr91pg3v5bc9vda6s.apps.googleusercontent.com

const YOUTUBE_API_KEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBW4'; // Tu devras remplacer par ta vraie clé

export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  videoId: string;
  duration: string;
}

// Rechercher un track sur YouTube
export async function searchYouTubeTrack(trackName: string, artist: string): Promise<YouTubeTrack | null> {
  try {
    const query = encodeURIComponent(`${trackName} ${artist} official audio`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q=${query}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      return {
        id: video.id.videoId,
        videoId: video.id.videoId,
        title: video.snippet.title,
        artist: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
        duration: '3:00' // Duration requires additional API call
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ YouTube search error:', error);
    return null;
  }
}

// Obtenir l'URL d'écoute YouTube (pour ouvrir dans l'app)
export function getYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Deep link pour ouvrir dans l'app YouTube
export function getYouTubeDeepLink(videoId: string): string {
  return `vnd.youtube://${videoId}`;
}

// Obtenir l'URL embed pour le player
export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=${autoplay ? 1 : 0}&controls=1&modestbranding=1&rel=0`;
}

// Ouvrir dans l'app YouTube (mobile) ou navigateur (desktop)
export function openInYouTube(videoId: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Try to open in YouTube app
    const deepLink = getYouTubeDeepLink(videoId);
    window.location.href = deepLink;
    
    // Fallback to web after 1.5s if app not installed
    setTimeout(() => {
      window.open(getYouTubeUrl(videoId), '_blank');
    }, 1500);
  } else {
    // Desktop: open in new tab
    window.open(getYouTubeUrl(videoId), '_blank');
  }
}

// Top tracks France sur YouTube Music
export async function getYouTubeTopFrance(): Promise<YouTubeTrack[]> {
  try {
    // IDs de vidéos populaires en France (à mettre à jour régulièrement)
    const topVideoIds = [
      'cFH5JgyZK1I', // Carbonne - Imagine
      'NRpjLbEOf18', // Naps - Best Life
      'TkRJOdDvB60', // Tiakola - Désert
      'K_i4oAKNYmM', // Aya Nakamura - Doudou
      '6sy5fvYU4Js', // Niska - Bâtiment
      'fhVWUW00Rcw', // Jul - Superstar
      'S2lhyVhCRX8', // SDM - Bolide
      'ULHLbxf3OXo', // Kerchak - Cartier
      'VXGYDJ_Kjyo', // Hamza - H24
      'wSF8EmblVTs'  // Freeze Corleone - S/o
    ];
    
    const query = topVideoIds.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${query}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items) {
      return data.items.map((video: any, index: number) => ({
        id: video.id,
        videoId: video.id,
        title: video.snippet.title,
        artist: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
        duration: '3:00',
        position: index + 1
      }));
    }
    
    return [];
  } catch (error) {
    console.error('❌ YouTube top tracks error:', error);
    return [];
  }
}
