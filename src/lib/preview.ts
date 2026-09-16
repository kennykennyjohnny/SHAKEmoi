// SHAKEMOI - Extraits 30s : l'astuce du play-en-1-clic.
// Le clic utilisateur lance immédiatement un <audio> avec l'extrait du son :
//   1) preview_url stocké si dispo (posts) ;
//   2) sinon fallback API iTunes Search (keyless, CORS ouvert) par "titre artiste",
//      avec cache localStorage pour ne résoudre qu'une fois par son.

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

let audio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
const listeners = new Set<(key: string | null) => void>();

function emit() { listeners.forEach(l => l(currentKey)); }

/** S'abonner aux changements d'extrait en cours (retourne un unsubscribe). */
export function onPreviewChange(cb: (key: string | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getPlayingPreviewKey(): string | null {
  return currentKey;
}

export function playPreview(key: string, url: string) {
  if (!audio) {
    audio = new Audio();
    audio.volume = 0.9;
    audio.onended = () => { currentKey = null; emit(); };
  }
  audio.src = url;
  currentKey = key;
  emit();
  audio.play().catch(() => {
    // Autoplay bloqué par le navigateur : on n'insiste pas, l'UI reste cohérente.
    currentKey = null;
    emit();
  });
}

export function stopPreview() {
  if (audio) audio.pause();
  currentKey = null;
  emit();
}
