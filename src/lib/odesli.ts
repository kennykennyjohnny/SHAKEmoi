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
export function getPlatformUrl(
  links: OdesliLinks & { spotify_url?: string | null },
  platform: string
): string | null {
  switch (platform) {
    case 'spotify':
      return links.spotify_url ?? null;
    case 'apple_music':
      return links.apple_music_url;
    case 'deezer':
      return links.deezer_url;
    case 'youtube':
      return links.youtube_url;
    case 'youtube_music':
      return links.youtube_music_url;
    case 'tidal':
      return links.tidal_url;
    default:
      return links.odesli_page_url;
  }
}
