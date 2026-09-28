// SHAKEMOI - Plateformes d'écoute : un seul endroit pour savoir où ouvrir un son.
//
// Règles :
//  - uniquement des liens https « universels » : sur mobile ils ouvrent l'app
//    installée, sinon le site (les schémas spotify:// ou deezer:// ne mènent
//    nulle part quand l'app n'est pas là, et jamais sur ordinateur) ;
//  - un bouton « Écouter sur X » mène TOUJOURS quelque part : lien exact si on
//    le connaît, sinon la recherche de la plateforme (le son y est en tête) ;
//  - les liens manquants sont complétés par /api/links (Spotify → ISRC →
//    Deezer exact, iTunes vérifié), l'API Odesli n'étant plus publique.

import { PUBLIC_ORIGIN } from './links';

export type PlatformKey = 'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'tidal';

/** Plateformes proposées sur la page d'un son, dans l'ordre par défaut. */
export const LISTEN_PLATFORMS: PlatformKey[] = ['spotify', 'apple_music', 'deezer', 'youtube_music'];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  deezer: 'Deezer',
  youtube_music: 'YouTube Music',
  tidal: 'Tidal',
};

/** Les préférences stockées ont connu plusieurs noms ('apple', 'youtube'…). */
export function normalizePlatform(p: string | null | undefined): PlatformKey | null {
  switch ((p || '').toLowerCase()) {
    case 'spotify': return 'spotify';
    case 'apple': case 'apple_music': case 'applemusic': case 'itunes': return 'apple_music';
    case 'deezer': return 'deezer';
    case 'youtube': case 'youtube_music': case 'youtubemusic': case 'ytmusic': return 'youtube_music';
    case 'tidal': return 'tidal';
    default: return null;
  }
}

export interface StoredLinks {
  spotify_url?: string | null;
  apple_music_url?: string | null;
  deezer_url?: string | null;
  youtube_url?: string | null;
  youtube_music_url?: string | null;
  tidal_url?: string | null;
  odesli_page_url?: string | null;
}

export function searchUrl(platform: PlatformKey, title: string, artist: string): string {
  const q = encodeURIComponent(`${title || ''} ${artist || ''}`.trim());
  switch (platform) {
    case 'spotify': return `https://open.spotify.com/search/${q}`;
    case 'apple_music': return `https://music.apple.com/fr/search?term=${q}`;
    case 'deezer': return `https://www.deezer.com/search/${q}`;
    case 'youtube_music': return `https://music.youtube.com/search?q=${q}`;
    case 'tidal': return `https://listen.tidal.com/search?q=${q}`;
  }
}

// Anciennes données : liens deep-link (spotify:track:…, deezer://…) → https.
function toHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  const sp = url.match(/^spotify:track:([A-Za-z0-9]+)/);
  if (sp) return `https://open.spotify.com/track/${sp[1]}`;
  if (url.startsWith('deezer://')) return url.replace('deezer://', 'https://');
  const td = url.match(/^tidal:\/\/track\/(\d+)/);
  if (td) return `https://tidal.com/track/${td[1]}`;
  return /^https?:\/\//.test(url) ? url : null;
}

/** Lien exact enregistré pour une plateforme, s'il existe. */
export function storedUrl(links: StoredLinks, platform: PlatformKey): string | null {
  switch (platform) {
    case 'spotify': return toHttps(links.spotify_url);
    case 'apple_music': return toHttps(links.apple_music_url);
    case 'deezer': return toHttps(links.deezer_url);
    case 'youtube_music': return toHttps(links.youtube_music_url) || toHttps(links.youtube_url);
    case 'tidal': return toHttps(links.tidal_url);
  }
}

/** Lien à ouvrir : exact si connu, sinon recherche sur la plateforme. */
export function platformUrl(links: StoredLinks, platform: PlatformKey, title: string, artist: string): string {
  return storedUrl(links, platform) || searchUrl(platform, title, artist);
}

export interface ResolvedLinks {
  title: string | null;
  artist: string | null;
  cover: string | null;
  isrc: string | null;
  preview: string | null;
  links: Record<'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'youtube', string | null>;
  exact: Record<'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'youtube', boolean>;
}

const CACHE_KEY = 'shakemoi_links_cache_v1';
const memory = new Map<string, Promise<ResolvedLinks | null>>();

/**
 * Complète les liens d'un son via /api/links (mis en cache : navigateur +
 * CDN). Ne jette jamais : null si la résolution échoue.
 */
export function resolveLinks(q: { title?: string | null; artist?: string | null; spotifyUrl?: string | null; isrc?: string | null }): Promise<ResolvedLinks | null> {
  const params = new URLSearchParams();
  if (q.spotifyUrl) params.set('spotify', q.spotifyUrl);
  if (q.title) params.set('title', q.title);
  if (q.artist) params.set('artist', q.artist);
  if (q.isrc) params.set('isrc', q.isrc);
  const key = params.toString();
  if (!key) return Promise.resolve(null);

  const hit = memory.get(key);
  if (hit) return hit;

  const p = (async () => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (cache[key]) return cache[key] as ResolvedLinks;
    } catch { /* stockage indisponible */ }
    try {
      const res = await fetch(`${PUBLIC_ORIGIN}/api/links?${key}`);
      if (!res.ok) return null;
      const data = (await res.json()) as ResolvedLinks;
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const keys = Object.keys(cache);
        if (keys.length > 200) delete cache[keys[0]];
        // Extrait Deezer = URL signée qui expire : on ne le garde pas.
        cache[key] = data.preview?.includes('dzcdn.net') ? { ...data, preview: null } : data;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch { /* pas grave */ }
      return data;
    } catch {
      return null;
    }
  })();
  memory.set(key, p);
  return p;
}

/** Fusionne liens enregistrés + liens résolus (les exacts l'emportent). */
export function mergeLinks(stored: StoredLinks, resolved: ResolvedLinks | null): StoredLinks {
  if (!resolved) return stored;
  const exact = (k: keyof ResolvedLinks['links']) => (resolved.exact[k] ? resolved.links[k] : null);
  return {
    ...stored,
    spotify_url: storedUrl(stored, 'spotify') || exact('spotify'),
    apple_music_url: storedUrl(stored, 'apple_music') || exact('apple_music'),
    deezer_url: storedUrl(stored, 'deezer') || exact('deezer'),
  };
}

/**
 * Ouvre un lien de plateforme. À appeler directement dans le clic (sans
 * `await` avant), sinon le navigateur bloque la fenêtre.
 */
export function openExternal(url: string) {
  // Pas de 'noopener' dans les options : window.open renverrait alors toujours
  // null et on ne saurait plus si la fenêtre a été bloquée.
  const w = window.open(url, '_blank');
  if (w) w.opener = null;
  else window.location.href = url;
}
