// SHAKEMOI - Partage de son sans compte
// Couche data : cache `songs` (liens multi-plateformes résolus via Odesli) + `shares` (anonymes OK).
// Aucune dépendance à l'auth : un visiteur non-connecté peut créer et lire un partage.

import { supabase } from './supabase';
import { getOdesliLinks } from './odesli';

export interface SongInput {
  source?: string;          // 'spotify' | 'itunes' | ...
  sourceId: string;         // id du son sur la source (ex: id de piste Spotify)
  trackName: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  previewUrl?: string | null;   // extrait 30s
  durationMs?: number | null;
  spotifyUrl?: string | null;
  isrc?: string | null;
}

export interface ShareOptions {
  userId?: string | null;   // null => partage anonyme
  channel?: string;         // 'web-share' | 'qr' | 'copy' | 'friend'
  platformHint?: string | null;
}

export interface SharedSong {
  share: any;
  song: any;
}

// Base publique. On garde le domaine custom pour des liens propres dans les DM.
const BASE_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://shakemoi.fr';

// Slug court, URL-safe, suffisamment anti-collision pour le MVP (10 chars base36).
function makeSlug(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 36).toString(36);
  return s;
}

// Construit l'URL publique d'un partage à partir de son slug.
export function shareUrl(slug: string): string {
  return `${BASE_URL}/?song=${slug}`;
}

// Upsert d'un son dans le cache. Réutilise la ligne existante (UNIQUE source+source_id),
// sinon résout les liens multi-plateformes via Odesli (best-effort, keyless) et insère.
export async function upsertSong(input: SongInput): Promise<string> {
  const source = input.source || 'spotify';

  const { data: existing } = await supabase
    .from('songs')
    .select('id')
    .eq('source', source)
    .eq('source_id', input.sourceId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  let odesli = {
    apple_music_url: null as string | null,
    deezer_url: null as string | null,
    youtube_url: null as string | null,
    youtube_music_url: null as string | null,
    tidal_url: null as string | null,
    odesli_page_url: null as string | null,
  };
  if (input.spotifyUrl) {
    try {
      odesli = await getOdesliLinks(input.spotifyUrl);
    } catch {
      /* best-effort : on partage même sans les liens croisés */
    }
  }

  const { data, error } = await supabase
    .from('songs')
    .insert({
      source,
      source_id: input.sourceId,
      isrc: input.isrc ?? null,
      track_name: input.trackName,
      artist: input.artist,
      album: input.album ?? null,
      cover_url: input.coverUrl ?? null,
      preview_url: input.previewUrl ?? null,
      duration_ms: input.durationMs ?? null,
      spotify_url: input.spotifyUrl ?? null,
      apple_music_url: odesli.apple_music_url,
      deezer_url: odesli.deezer_url,
      youtube_url: odesli.youtube_url,
      youtube_music_url: odesli.youtube_music_url,
      tidal_url: odesli.tidal_url,
      odesli_page_url: odesli.odesli_page_url,
    })
    .select('id')
    .single();

  if (error) {
    // Course possible sur la contrainte UNIQUE : on relit.
    const { data: retry } = await supabase
      .from('songs')
      .select('id')
      .eq('source', source)
      .eq('source_id', input.sourceId)
      .maybeSingle();
    if (retry?.id) return retry.id;
    throw error;
  }
  return data.id;
}

// Crée un partage (son + ligne shares) et renvoie le slug + l'URL publique.
export async function createSongShare(
  input: SongInput,
  opts: ShareOptions = {}
): Promise<{ slug: string; url: string; songId: string }> {
  const songId = await upsertSong(input);
  const slug = makeSlug();
  const { error } = await supabase.from('shares').insert({
    slug,
    song_id: songId,
    user_id: opts.userId ?? null,
    channel: opts.channel ?? null,
    platform_hint: opts.platformHint ?? null,
  });
  if (error) throw error;
  return { slug, url: shareUrl(slug), songId };
}

// Lit un partage public par slug (pour la page son publique).
export async function getSharedSong(slug: string): Promise<SharedSong | null> {
  const { data: share } = await supabase
    .from('shares')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!share) return null;

  const { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('id', share.song_id)
    .maybeSingle();
  if (!song) return null;

  return { share, song };
}

// Incrémente le compteur de vues d'un partage (best-effort, ne bloque jamais l'affichage).
export async function incrementShareViews(slug: string): Promise<void> {
  try {
    await supabase.rpc('increment_share_views', { p_slug: slug });
  } catch {
    /* non bloquant */
  }
}

// --- Préférence plateforme du visiteur anonyme (pont anonyme -> compte) ---

const PLATFORM_KEY = 'shakemoi_pref_platform';

export function getPreferredPlatform(): string | null {
  try {
    return localStorage.getItem(PLATFORM_KEY);
  } catch {
    return null;
  }
}

export function setPreferredPlatform(platform: string): void {
  try {
    localStorage.setItem(PLATFORM_KEY, platform);
  } catch {
    /* stockage indisponible : one-tap non mémorisé, pas grave */
  }
}
