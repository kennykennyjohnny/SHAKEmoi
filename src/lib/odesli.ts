// SHAKEMOI - Liens multi-plateformes d'un son.
// L'API Odesli (song.link) n'est plus publique (401 PUBLIC_API_ACCESS_DEPRECATED) :
// ces fonctions gardent leur nom et leur forme pour le reste de l'app, mais
// passent désormais par /api/links (voir lib/platforms.ts).

import { normalizePlatform, resolveLinks, searchUrl, storedUrl, type StoredLinks } from './platforms';

export interface OdesliLinks {
  apple_music_url: string | null;
  deezer_url: string | null;
  youtube_url: string | null;
  youtube_music_url: string | null;
  tidal_url: string | null;
  odesli_page_url: string | null;
}

export interface OdesliInfo extends OdesliLinks {
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
  spotify_url: string | null;
}

const EMPTY: OdesliLinks = {
  apple_music_url: null,
  deezer_url: null,
  youtube_url: null,
  youtube_music_url: null,
  tidal_url: null,
  odesli_page_url: null,
};

// Métadonnées + liens d'un son à partir d'une URL Spotify.
// Sert notamment aux stories créées avant que le titre soit enregistré.
export async function getOdesliInfo(url: string): Promise<OdesliInfo | null> {
  if (!url) return null;
  const r = await resolveLinks({ spotifyUrl: url });
  if (!r) return null;
  return {
    title: r.title,
    artist: r.artist,
    thumbnail: r.cover,
    spotify_url: r.exact.spotify ? r.links.spotify : null,
    apple_music_url: r.exact.apple_music ? r.links.apple_music : null,
    deezer_url: r.exact.deezer ? r.links.deezer : null,
    youtube_url: null,
    youtube_music_url: null,
    tidal_url: null,
    odesli_page_url: null,
  };
}

// Liens exacts à enregistrer avec un post / message / partage. Seuls les liens
// vérifiés sont stockés : les recherches se recalculent à l'affichage.
export async function getOdesliLinks(
  spotifyUrl: string,
  meta?: { title?: string | null; artist?: string | null },
): Promise<OdesliLinks> {
  if (!spotifyUrl && !meta?.title) return EMPTY;
  const r = await resolveLinks({ spotifyUrl, title: meta?.title, artist: meta?.artist });
  if (!r) return EMPTY;
  return {
    ...EMPTY,
    apple_music_url: r.exact.apple_music ? r.links.apple_music : null,
    deezer_url: r.exact.deezer ? r.links.deezer : null,
  };
}

/**
 * Extrait de 30 s à enregistrer avec un son (M1) : Spotify, sinon Deezer
 * (adresse stable), sinon iTunes. `preview_source = 'none'` si rien trouvé.
 * Même requête que getOdesliLinks (mise en commun par resolveLinks).
 */
export async function getSongPreview(
  spotifyUrl: string,
  meta?: { title?: string | null; artist?: string | null },
  existing?: string | null,
): Promise<{ preview_url: string | null; preview_source: string }> {
  if (existing && !existing.includes('dzcdn.net')) {
    return { preview_url: existing, preview_source: existing.includes('scdn.co') ? 'spotify' : existing.includes('/api/preview') ? 'deezer' : 'itunes' };
  }
  if (!spotifyUrl && !meta?.title) return { preview_url: null, preview_source: 'none' };
  const r = await resolveLinks({ spotifyUrl, title: meta?.title, artist: meta?.artist });
  const url = r?.preview && !r.preview.includes('dzcdn.net') ? r.preview : null;
  return { preview_url: url, preview_source: url ? (r?.previewSource || 'itunes') : 'none' };
}

/**
 * Lien à ouvrir pour la plateforme demandée. Toujours en https (ouvre l'app
 * si elle est installée). Si on ne connaît pas le lien exact et qu'on a le
 * titre, on ouvre la recherche de la plateforme plutôt que rien.
 */
export function getPlatformUrl(
  links: StoredLinks,
  platform: string,
  meta?: { title?: string | null; artist?: string | null },
): string | null {
  const key = normalizePlatform(platform) ?? 'spotify';
  const exact = storedUrl(links, key);
  if (exact) return exact;
  if (meta?.title) return searchUrl(key, meta.title, meta.artist || '');
  return storedUrl(links, 'spotify') || links.odesli_page_url || null;
}

export { searchUrl };
