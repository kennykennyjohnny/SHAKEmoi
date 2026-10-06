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

export type PlatformKey = 'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'soundcloud' | 'amazon_music' | 'tidal';

/** Les 7 applis d'écoute proposées (tuto, paramètres) — O1/O2. */
export const STREAMING_APPS: PlatformKey[] = ['spotify', 'apple_music', 'deezer', 'youtube_music', 'soundcloud', 'amazon_music', 'tidal'];

// Appli d'écoute de la personne connectée (profil, O1), connue de toute
// l'appli : App la met à jour, les boutons « ouvrir » affichent son logo.
let myApp: PlatformKey = 'spotify';
const myAppListeners = new Set<() => void>();
export function getMyStreamingApp(): PlatformKey { return myApp; }
export function setMyStreamingApp(p: PlatformKey) {
  if (p === myApp) return;
  myApp = p;
  myAppListeners.forEach(fn => fn());
}
export function onMyStreamingAppChange(fn: () => void): () => void {
  myAppListeners.add(fn);
  return () => { myAppListeners.delete(fn); };
}

/** Plateformes proposées sur la page d'un son, dans l'ordre par défaut. */
export const LISTEN_PLATFORMS: PlatformKey[] = ['spotify', 'apple_music', 'deezer', 'youtube_music'];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  deezer: 'Deezer',
  youtube_music: 'YouTube Music',
  soundcloud: 'SoundCloud',
  amazon_music: 'Amazon Music',
  tidal: 'Tidal',
};

/** Les préférences stockées ont connu plusieurs noms ('apple', 'youtube'…). */
export function normalizePlatform(p: string | null | undefined): PlatformKey | null {
  switch ((p || '').toLowerCase()) {
    case 'spotify': return 'spotify';
    case 'apple': case 'apple_music': case 'applemusic': case 'itunes': return 'apple_music';
    case 'deezer': return 'deezer';
    case 'youtube': case 'youtube_music': case 'youtubemusic': case 'ytmusic': return 'youtube_music';
    case 'soundcloud': return 'soundcloud';
    case 'amazon': case 'amazon_music': case 'amazonmusic': return 'amazon_music';
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
    case 'soundcloud': return `https://soundcloud.com/search?q=${q}`;
    case 'amazon_music': return `https://music.amazon.fr/search/${q}`;
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
    // Pas de lien exact enregistré pour ces deux-là : recherche sur la plateforme.
    case 'soundcloud': case 'amazon_music': return null;
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
  /** D'où vient l'extrait (M1) : spotify, deezer (adresse stable /api/preview) ou itunes. */
  previewSource?: 'spotify' | 'deezer' | 'itunes' | null;
  links: Record<'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'youtube', string | null>;
  exact: Record<'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'youtube', boolean>;
}

// v3 (correctif 06/10) : une réponse SANS extrait n'est plus jamais gardée
// (avant, un raté passager de Deezer / iTunes devenait un son muet à vie sur
// le téléphone) ; les anciennes clés sont effacées.
const CACHE_KEY = 'shakemoi_links_cache_v3';
const memory = new Map<string, Promise<ResolvedLinks | null>>();
try {
  localStorage.removeItem('shakemoi_links_cache_v2');
  localStorage.removeItem('shakemoi_links_cache_v1');
} catch { /* stockage indisponible */ }

// 4 résolutions à la fois au plus : la barre des Shakes éphémères en prépare
// 12 d'un coup (R7), et une rafale fait tomber Deezer en limite de débit.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 4) await new Promise<void>((r) => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}

function readLinksCache(): Record<string, ResolvedLinks> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}

/**
 * Complète les liens d'un son via /api/links (mis en cache : navigateur +
 * CDN). Ne jette jamais : null si la résolution échoue.
 * `fresh` : ignore tous les caches (téléphone et CDN) — réparation d'un extrait
 * illisible (S3).
 */
export function resolveLinks(
  q: { title?: string | null; artist?: string | null; spotifyUrl?: string | null; isrc?: string | null },
  opts?: { fresh?: boolean },
): Promise<ResolvedLinks | null> {
  const params = new URLSearchParams();
  if (q.spotifyUrl) params.set('spotify', q.spotifyUrl);
  if (q.title) params.set('title', q.title);
  if (q.artist) params.set('artist', q.artist);
  if (q.isrc) params.set('isrc', q.isrc);
  if (!params.toString()) return Promise.resolve(null);
  // v=3 : ignore tout ce qui est encore en cache CDN (dont les échecs gardés
  // une semaine par l'ancienne version de /api/links).
  params.set('v', '3');
  const key = params.toString();
  const fresh = !!opts?.fresh;

  const hit = !fresh && memory.get(key);
  if (hit) return hit;

  const p = (async () => {
    if (!fresh) {
      const cached = readLinksCache()[key];
      if (cached?.preview) return cached;
    }
    try {
      const url = `${PUBLIC_ORIGIN}/api/links?${key}${fresh ? `&fresh=${Date.now()}` : ''}`;
      const data = await slot(async () => {
        const res = await fetch(url, fresh ? { cache: 'no-store' } : undefined);
        return res.ok ? ((await res.json()) as ResolvedLinks) : null;
      });
      if (!data) return null;
      // Ancienne réponse encore en cache CDN : extrait Deezer signé (expire) → ignoré.
      if (data.preview?.includes('dzcdn.net')) data.preview = null;
      // Seules les réponses AVEC extrait sont gardées sur le téléphone.
      if (data.preview) {
        try {
          const cache = readLinksCache();
          const keys = Object.keys(cache);
          if (keys.length > 200) delete cache[keys[0]];
          cache[key] = data;
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* pas grave */ }
      }
      return data;
    } catch {
      return null;
    }
  })();
  memory.set(key, p);
  // Sans extrait : oublié de la mémoire aussi, le prochain toucher réessaie.
  p.then((d) => { if (!d?.preview && memory.get(key) === p) memory.delete(key); });
  return p;
}

/** Oublie un extrait (illisible) de tous les caches de liens du téléphone. */
export function forgetLinksPreview(url: string) {
  // Mémoire de la session : vidée en entier (simples promesses ; le stockage
  // et le CDN répondent vite pour les autres sons).
  memory.clear();
  try {
    const cache = readLinksCache();
    let changed = false;
    for (const k of Object.keys(cache)) if (cache[k]?.preview === url) { delete cache[k]; changed = true; }
    if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* rien */ }
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
