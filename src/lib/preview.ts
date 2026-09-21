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

  // Catalogue français d'abord (l'app est FR), puis international.
  let url = await searchItunesPreview(`${trackName} ${artist}`, trackName, artist);
  const cleaned = cleanTitle(trackName);
  if (!url && cleaned && cleaned !== trackName) {
    url = await searchItunesPreview(`${cleaned} ${artist}`, trackName, artist);
  }
  if (!url) {
    url = await searchItunesPreview(`${cleaned || trackName} ${artist}`, trackName, artist, 'US');
  }

  cache[key] = url;
  writeCache(cache);
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
let playing = false;
let muted = false;
// Mémorisé tant que la page n'est pas rechargée : une fois le son activé sur
// une story, les suivantes s'enchaînent avec le son.
let sessionUnmuted = false;
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
  if (currentKey !== key || !el.src) {
    el.src = url;
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
