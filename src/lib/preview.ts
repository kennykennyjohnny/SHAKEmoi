// SHAKEMOI - Extraits 30s : l'astuce du play-en-1-clic.
// Le clic utilisateur lance immédiatement un <audio> avec l'extrait du son :
//   1) preview_url stocké si dispo (posts) ;
//   2) sinon fallback API iTunes Search (keyless, CORS ouvert) par "titre artiste",
//      avec cache localStorage pour ne résoudre qu'une fois par son.
// L'état de lecture est observable (onPreviewChange) pour que l'UI affiche
// toujours le bon bouton play/pause — l'embed Spotify, lui, a son propre état
// qu'on ne peut pas piloter depuis la page.

const CACHE_KEY = 'shakemoi_preview_cache_v1';

function readCache(): Record<string, string | null> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(cache: Record<string, string | null>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export async function resolvePreviewUrl(
  trackName: string,
  artist: string,
  existing?: string | null
): Promise<string | null> {
  if (existing) return existing;
  if (!trackName) return null;
  const key = `${trackName}::${artist}`.toLowerCase();
  const cache = readCache();
  if (key in cache) return cache[key];
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${artist}`)}&media=music&entity=song&limit=1`
    );
    const data = await res.json();
    const url: string | null = data?.results?.[0]?.previewUrl ?? null;
    cache[key] = url;
    writeCache(cache);
    return url;
  } catch {
    return null;
  }
}

// ---- Lecteur global : un seul extrait à la fois dans toute l'app ----

export interface PreviewState {
  key: string | null;   // identifiant du son en cours (id de post / story)
  playing: boolean;     // true seulement si le son sort vraiment
}

let audio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
let playing = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.volume = 0.9;
    audio.onplay = () => { playing = true; emit(); };
    audio.onpause = () => { playing = false; emit(); };
    audio.onended = () => { playing = false; currentKey = null; emit(); };
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
  if (el.src) return;               // déjà utilisé, rien à débloquer
  el.muted = true;
  el.src = SILENCE;
  el.play()
    .then(() => { el.pause(); el.currentTime = 0; el.muted = false; el.removeAttribute('src'); })
    .catch(() => { el.muted = false; el.removeAttribute('src'); });
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

export function getPreviewState(): PreviewState {
  return { key: currentKey, playing };
}

export function isPreviewPlaying(key: string): boolean {
  return currentKey === key && playing;
}

export function playPreview(key: string, url: string) {
  const el = ensureAudio();
  if (currentKey !== key || !el.src) {
    el.src = url;
    currentKey = key;
  }
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
  if (currentKey === key && el.src) {
    if (el.paused) el.play().catch(() => {});
    else el.pause();
    return;
  }
  if (url) playPreview(key, url);
}

export function stopPreview() {
  if (audio) audio.pause();
  currentKey = null;
  playing = false;
  emit();
}
