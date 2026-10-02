// SHAKEMOI - Extraits 30s : l'astuce du play-en-1-clic.
// Le clic utilisateur lance immédiatement un <audio> avec l'extrait du son :
//   1) preview_url stocké si dispo (posts) ;
//   2) sinon fallback API iTunes Search (keyless, CORS ouvert) par "titre artiste",
//      avec cache localStorage pour ne résoudre qu'une fois par son.
// L'état de lecture est observable (onPreviewChange) pour que l'UI affiche
// toujours le bon bouton play/pause — l'embed Spotify, lui, a son propre état
// qu'on ne peut pas piloter depuis la page.

import { resolveLinks } from './platforms';

// v2 : les anciens « pas d'extrait » (null) sont réessayés avec la nouvelle source.
// v3 : chaîne Spotify → Deezer (adresse stable) → iTunes (M1).
const CACHE_KEY = 'shakemoi_preview_cache_v3';

function readCache(): Record<string, string | null> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(cache: Record<string, string | null>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// Beaucoup de titres portent des ornements ("ε. Signaler", "X (feat. Y)")
// qu'iTunes ne reconnaît pas : on réessaie avec une version nettoyée.
function cleanTitle(title: string): string {
  return title
    .replace(/^\S{1,2}\.\s+/u, '')            // préfixe type "ε. " / "Θ. "
    .replace(/\s*[([].*?[)\]]\s*/g, ' ')      // (feat. …) / [Remix]
    .replace(/\s*-\s*(feat|ft)\..*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Comparaison tolérante (accents, ponctuation, casse) pour vérifier qu'iTunes
// nous renvoie bien LE bon morceau.
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function looksLikeSame(resultTitle: string, resultArtist: string, title: string, artist: string): boolean {
  const rt = norm(resultTitle);
  const ra = norm(resultArtist);
  const wantT = norm(cleanTitle(title));
  const wantA = norm(artist);
  if (!rt || !wantT) return false;
  // L'artiste doit correspondre (sauf si on ne le connaît pas).
  const artistOk = !wantA || ra.includes(wantA) || wantA.includes(ra);
  const titleOk = rt === wantT || rt.includes(wantT) || wantT.includes(rt);
  return artistOk && titleOk;
}

// Renvoie l'extrait SEULEMENT si le résultat correspond vraiment au morceau :
// un mauvais son est pire que pas de son.
async function searchItunesPreview(
  term: string,
  title: string,
  artist: string,
  country = 'FR'
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=8&country=${country}`
    );
    const data = await res.json();
    const results: any[] = data?.results ?? [];
    const match = results.find(r => r.previewUrl && looksLikeSame(r.trackName, r.artistName, title, artist));
    return match?.previewUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Extrait de 30 s d'un son (M1), dans l'ordre :
 *   1. l'extrait déjà enregistré (Spotify, Deezer stable ou iTunes) ;
 *   2. la chaîne du serveur /api/links : Spotify → Deezer (par ISRC, sinon
 *      titre + artiste vérifiés, adresse stable /api/preview) → iTunes ;
 *   3. en secours, iTunes interrogé directement depuis le téléphone.
 * null = aucun extrait nulle part : l'écran propose « Écouter sur Spotify ».
 */
export async function resolvePreviewUrl(
  trackName: string,
  artist: string,
  existing?: string | null,
  /** Id (ou lien) Spotify : retrouve l'extrait exact (via l'ISRC) même quand
   *  la recherche par titre échoue (classique, titres longs) ou que le titre manque. */
  spotifyId?: string | null
): Promise<string | null> {
  // Ancien extrait Deezer signé enregistré avant ce soir : il a expiré.
  if (existing && !existing.includes('dzcdn.net')) return existing;
  if (!trackName && !spotifyId) return null;
  const key = (spotifyId ? `spotify::${spotifyId}` : `${trackName}::${artist}`).toLowerCase();
  const cache = readCache();
  if (cache[key]) return cache[key];

  const resolved = await resolveLinks(
    spotifyId ? { spotifyUrl: spotifyId, title: trackName || null, artist: artist || null } : { title: trackName, artist },
  ).catch(() => null);
  let url = resolved?.preview && !resolved.preview.includes('dzcdn.net') ? resolved.preview : null;

  if (!url && trackName) {
    // Catalogue français d'abord (l'app est FR), puis international.
    url = await searchItunesPreview(`${trackName} ${artist}`, trackName, artist);
    const cleaned = cleanTitle(trackName);
    if (!url && cleaned && cleaned !== trackName) url = await searchItunesPreview(`${cleaned} ${artist}`, trackName, artist);
    if (!url) url = await searchItunesPreview(`${cleaned || trackName} ${artist}`, trackName, artist, 'US');
  }

  // Seules les trouvailles sont gardées : un échec est réessayé la fois suivante.
  if (url) { cache[key] = url; writeCache(cache); }
  return url;
}

// Titre d'un son à partir de son id Spotify, via l'oEmbed public (sans clé,
// CORS ouvert). Sert aux stories créées avant que le titre soit enregistré :
// sans titre, impossible de retrouver l'extrait ni d'afficher le bon nom.
const TITLE_CACHE_KEY = 'shakemoi_title_cache_v1';

export async function getSpotifyTrackTitle(trackId: string): Promise<string | null> {
  if (!trackId) return null;
  let cache: Record<string, string | null> = {};
  try { cache = JSON.parse(localStorage.getItem(TITLE_CACHE_KEY) || '{}'); } catch {}
  if (trackId in cache) return cache[trackId];
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${trackId}`)}`
    );
    const data = await res.json();
    const title: string | null = data?.title ?? null;
    cache[trackId] = title;
    try { localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(cache)); } catch {}
    return title;
  } catch {
    return null;
  }
}

// ---- Lecteur global : un seul extrait à la fois dans toute l'app ----

export interface PreviewState {
  key: string | null;   // identifiant du son en cours (id de post / story)
  playing: boolean;     // true seulement si le son sort vraiment
  muted: boolean;       // lecture en cours mais sans son (stories façon Insta)
}

let audio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
let currentUrl: string | null = null;   // extrait réellement chargé pour currentKey
let playing = false;
let muted = false;
// Son des stories : actif par défaut (c'est une app de musique). Si on le
// coupe, le choix vaut pour les stories suivantes jusqu'au rechargement.
let sessionUnmuted = true;
const listeners = new Set<() => void>();
// Fin d'un extrait (playlist du cercle, P21 : on enchaîne le suivant).
const endedListeners = new Set<(key: string) => void>();
const progressListeners = new Set<() => void>();
export function onPreviewProgress(cb: () => void): () => void {
  progressListeners.add(cb);
  return () => { progressListeners.delete(cb); };
}

function emit() { listeners.forEach(l => l()); }

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.volume = 0.9;
    audio.onplay = () => { playing = true; emit(); };
    audio.onpause = () => { playing = false; emit(); };
    audio.onended = () => {
      const ended = currentKey;
      playing = false; currentKey = null; emit();
      if (ended) endedListeners.forEach((l) => l(ended));
    };
    // Progression (barre du mini-lecteur) : canal à part, pour ne pas
    // redessiner toutes les pochettes 4 fois par seconde.
    audio.ontimeupdate = () => progressListeners.forEach((l) => l());
  }
  return audio;
}

// Les navigateurs n'autorisent la lecture programmée qu'après une interaction.
// Au tout premier geste, on "réveille" l'élément audio avec un silence : les
// play() déclenchés plus tard (ouverture d'une story, par ex.) passent alors.
let unlocked = false;
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const el = ensureAudio();
  // Un extrait est déjà chargé (lecture auto refusée, ex. page d'un son
  // partagé) : c'est le geste lui-même qui va le lancer. Surtout ne pas le
  // remplacer par le silence — c'était le bug « la pochette ne joue pas ».
  if (el.src || currentKey) return;
  el.muted = true;
  el.src = SILENCE;
  const reset = () => {
    // Un vrai extrait a pu être lancé entre-temps : on n'y touche pas.
    if (el.src !== SILENCE) return;
    el.pause();
    el.muted = false;
    el.removeAttribute('src');
  };
  el.play().then(reset).catch(reset);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
}

/** S'abonner aux changements de lecture (retourne un unsubscribe). */
export function onPreviewChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** S'abonner à la fin d'un extrait (lecture enchaînée). */
export function onPreviewEnded(cb: (key: string) => void): () => void {
  endedListeners.add(cb);
  return () => { endedListeners.delete(cb); };
}

/** Avancement de l'extrait en cours (secondes). */
export function getPreviewProgress(): { current: number; duration: number } {
  if (!audio || !currentKey) return { current: 0, duration: 0 };
  return { current: audio.currentTime || 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0 };
}

/** Aller à une position (0 → 1) de l'extrait en cours. */
export function seekPreview(fraction: number) {
  if (!audio || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration;
}

export function getPreviewState(): PreviewState {
  return { key: currentKey, playing, muted };
}

/** L'utilisateur a-t-il déjà activé le son des stories dans cette session ? */
export function isSessionUnmuted(): boolean {
  return sessionUnmuted;
}

/** Active/coupe le son ; le choix vaut pour toutes les stories suivantes. */
export function setMuted(next: boolean) {
  muted = next;
  sessionUnmuted = !next;
  if (audio) audio.muted = next;
  emit();
}

export function isPreviewPlaying(key: string): boolean {
  return currentKey === key && playing;
}

export function playPreview(key: string, url: string, opts?: { muted?: boolean }) {
  const el = ensureAudio();
  if (currentKey !== key || currentUrl !== url || !el.src || el.src === SILENCE) {
    el.src = url;
    currentUrl = url;
    currentKey = key;
  }
  // Les stories démarrent en sourdine tant que l'utilisateur n'a pas activé
  // le son (comportement Instagram) ; ailleurs le son est direct.
  muted = opts?.muted ?? false;
  el.muted = muted;
  el.play().catch(() => {
    // Autoplay refusé par le navigateur : l'UI retombe sur "play".
    playing = false;
    emit();
  });
  emit();
}

/** Bascule lecture/pause. `url` n'est requis que pour un son pas encore chargé. */
export function togglePreview(key: string, url?: string | null) {
  const el = ensureAudio();
  const loaded = currentKey === key && !!currentUrl && !!el.src && el.src !== SILENCE;
  if (loaded) {
    if (el.paused) el.play().catch(() => { playing = false; emit(); });
    else el.pause();
    return;
  }
  const target = url || (currentKey === key ? currentUrl : null);
  if (target) playPreview(key, target);
}

export function stopPreview() {
  if (audio) audio.pause();
  currentKey = null;
  playing = false;
  emit();
}
