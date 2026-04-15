// SHAKEMOI - Odesli (song.link) API for cross-platform links
// Free API, no auth needed, ~10 req/sec rate limit

export interface OdesliLinks {
  apple_music_url: string | null;
  deezer_url: string | null;
  youtube_url: string | null;
  youtube_music_url: string | null;
  tidal_url: string | null;
  odesli_page_url: string | null;
}

interface OdesliPlatformLink {
  url: string;
  entityUniqueId: string;
}

interface OdesliResponse {
  entityUniqueId: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: Record<string, OdesliPlatformLink>;
}

export async function getOdesliLinks(spotifyUrl: string): Promise<OdesliLinks> {
  const emptyLinks: OdesliLinks = {
    apple_music_url: null,
    deezer_url: null,
    youtube_url: null,
    youtube_music_url: null,
    tidal_url: null,
    odesli_page_url: null,
  };

  if (!spotifyUrl) return emptyLinks;

  try {
    const response = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotifyUrl)}`
    );

    if (!response.ok) {
      console.warn('[Odesli] API error:', response.status);
      return emptyLinks;
    }

    const data: OdesliResponse = await response.json();

    return {
      apple_music_url: data.linksByPlatform?.appleMusic?.url ?? null,
      deezer_url: data.linksByPlatform?.deezer?.url ?? null,
      youtube_url: data.linksByPlatform?.youtube?.url ?? null,
      youtube_music_url: data.linksByPlatform?.youtubeMusic?.url ?? null,
      tidal_url: data.linksByPlatform?.tidal?.url ?? null,
      odesli_page_url: data.pageUrl ?? null,
    };
  } catch (error) {
    console.error('[Odesli] Failed to fetch links:', error);
    return emptyLinks;
  }
}

// Maps platform preference to the correct URL from OdesliLinks
// On mobile, attempts native app deep links first
export function getPlatformUrl(
  links: OdesliLinks & { spotify_url?: string | null },
  platform: string
): string | null {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  switch (platform) {
    case 'spotify': {
      const url = links.spotify_url ?? null;
      if (!url) return null;
      // Convert web URL to native URI on mobile: spotify:track:ID
      if (isMobile) {
        const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
        if (trackMatch) return `spotify:track:${trackMatch[1]}`;
        const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
        if (albumMatch) return `spotify:album:${albumMatch[1]}`;
      }
      return url;
    }
    case 'apple':
    case 'apple_music':
      return links.apple_music_url;
    case 'deezer': {
      const url = links.deezer_url ?? null;
      if (!url) return null;
      // Convert to deezer:// deep link on mobile
      if (isMobile) {
        const trackMatch = url.match(/track\/(\d+)/);
        if (trackMatch) return `deezer://www.deezer.com/track/${trackMatch[1]}`;
      }
      return url;
    }
    case 'youtube':
      return links.youtube_url;
    case 'youtube_music':
      return links.youtube_music_url;
    case 'tidal': {
      const url = links.tidal_url ?? null;
      if (!url) return null;
      // Tidal deep link
      if (isMobile) {
        const trackMatch = url.match(/track\/(\d+)/);
        if (trackMatch) return `tidal://track/${trackMatch[1]}`;
      }
      return url;
    }
    default:
      return links.odesli_page_url;
  }
}
