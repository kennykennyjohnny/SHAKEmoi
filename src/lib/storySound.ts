// R7 : le son d'un Shake éphémère part tout seul à l'ouverture (seule exception
// à la règle M2 « le son ne part qu'au toucher » : c'est le principe même de la
// story). Pour que ce soit instantané — et accepté par l'iPhone, qui n'autorise
// la lecture que pendant un geste — l'extrait est cherché À L'AVANCE (bulle
// visible, doigt posé dessus) et lancé DANS le toucher qui ouvre la story.
import { resolvePreviewUrl, crossfadeTo, playPreview, isSessionUnmuted, suspendPlayback, resumePlayback, stopPreview, getPreviewState, onPreviewError, getCurrentPreviewUrl, type PlaybackSnapshot } from './preview';
import { repairPreview } from './previewRepair';

const urls = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
// Stories vues dans la session (pour réparer un extrait illisible, S3).
const known = new Map<string, any>();

export const storyKeyOf = (id: string) => `story-${id}`;
export const isStoryKey = (key: string) => key.startsWith('story-');

/** L'extrait d'une story s'il est déjà connu (sans attendre). */
export function knownStoryUrl(id: string): string | null | undefined {
  return urls.get(id);
}

/** Cherche l'extrait d'une story (une seule fois, résultat gardé). */
export function prefetchStorySound(story: any): Promise<string | null> {
  if (!story?.id) return Promise.resolve(null);
  known.set(story.id, story);
  if (urls.has(story.id)) return Promise.resolve(urls.get(story.id)!);
  const running = pending.get(story.id);
  if (running) return running;
  const title = story.track_name || '';
  if (!title && !story.track_id && !story.preview_url) { urls.set(story.id, null); return Promise.resolve(null); }
  const p = resolvePreviewUrl(title, title ? story.artist || '' : '', story.preview_url, story.track_id)
    // Correctif 06/10 : un échec (réseau, quota) n'est plus gardé pour la
    // session : la prochaine ouverture réessaie.
    .then((u) => { if (u) urls.set(story.id, u); return u || null; })
    .catch(() => null)
    .finally(() => pending.delete(story.id));
  pending.set(story.id, p);
  return p;
}

/** Joue le son d'une story (fondu si un autre son jouait). true si lancé. */
export function playStorySound(story: any): boolean {
  const url = story?.id ? urls.get(story.id) : null;
  if (!url) return false;
  crossfadeTo(storyKeyOf(story.id), url, { muted: !isSessionUnmuted() });
  return true;
}

// Ce qui jouait avant d'ouvrir les stories (playlist, file d'écoute), repris à la fermeture.
let suspended: PlaybackSnapshot | null = null;
let sessionOpen = false;

/** Le lecteur de stories s'ouvre (toucher d'une bulle, notification…). */
export function ensureStorySoundSession() {
  if (sessionOpen) return;
  sessionOpen = true;
  suspended = suspendPlayback(isStoryKey);
}

/** À appeler DANS le toucher qui ouvre une story : le son part dans le geste (iPhone). */
export function openStorySound(story: any) {
  ensureStorySoundSession();
  playStorySound(story);
}

/** À la fermeture du lecteur de stories : on coupe, et on reprend ce qui jouait. */
export function closeStorySound() {
  if (!sessionOpen) return;
  sessionOpen = false;
  const k = getPreviewState().key;
  if (k && isStoryKey(k)) stopPreview();
  const s = suspended;
  suspended = null;
  resumePlayback(s);
}

// Correctif 06/10 (S3) : l'extrait d'une story ne se lit pas → on l'oublie, on
// relance une fois la résolution sans cache, et on rejoue si on a trouvé.
const repairedStories = new Set<string>();
if (typeof window !== 'undefined') {
  onPreviewError(async (key) => {
    if (!isStoryKey(key)) return;
    const id = key.slice('story-'.length);
    const story = known.get(id);
    const bad = getCurrentPreviewUrl();
    urls.delete(id);
    if (!story || !bad || repairedStories.has(id)) return;
    repairedStories.add(id);
    const title = story.track_name || '';
    const url = await repairPreview(key, { title, artist: title ? story.artist || '' : '', spotifyId: story.track_id || null }, bad);
    if (!url) return;
    urls.set(id, url);
    if (getPreviewState().key === key) playPreview(key, url, { muted: !isSessionUnmuted() });
  });
}
