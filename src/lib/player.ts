// R5 / R6 : LE lecteur de l'appli. Une seule file de lecture, au niveau de
// l'appli (pas d'un écran) : la playlist d'un cercle, Découvrir, le fil, un
// profil, le classement… la remplissent ; elle continue d'enchaîner quand on
// change d'onglet ou de page. Un seul son à la fois : il s'appuie sur l'élément
// audio unique de lib/preview (les Shakes éphémères le mettent en pause et le
// reprennent, R7). La barre flottante (GlobalPlayerBar) n'est que son affichage.
import { createContext, useSyncExternalStore } from 'react';
import {
  resolvePreviewUrl, playPreview, crossfadeTo, togglePreview, stopPreview, getPreviewState,
  onPreviewChange, onPreviewEnded, onPreviewProgress, onPreviewError, getPreviewProgress,
  seekPreview, setPreviewMeta, preloadPreview, getCurrentPreviewUrl,
} from './preview';
import { repairPreview } from './previewRepair';
import { songKeyOf } from './listenLog';
import { thumb } from './media';

export interface PlayerTrack {
  /** Identifiant du son À L'ÉCRAN (le même que la pochette : id du post…). */
  id: string;
  title: string;
  artist: string;
  cover?: string | null;
  previewUrl?: string | null;
  spotifyId?: string | null;
  /** Ajouté à la main (« Lire ensuite » / « Ajouter à la file »). */
  added?: boolean;
  /** Post d'où vient le son (toucher la barre rouvre ce post). */
  postId?: string | null;
}

export type SourceKind = 'feed' | 'profile' | 'post' | 'top' | 'discover' | 'circle' | 'dm' | 'reply' | 'search' | 'recap' | 'single';

export interface PlayerSource {
  kind: SourceKind;
  /** Pour le petit message « Lecture · Playlist Les Boss ». */
  label: string;
  /** Où revenir en touchant la barre (cible openTarget : post:<id>, circle-playlist:<id>…).
   *  « post:{post} » = le post du son en cours. */
  target?: string | null;
  /** Liste de posts d'origine (pour rouvrir le post dans sa liste, Q2). */
  postList?: string[];
}

export interface PlayerState {
  queue: PlayerTrack[];
  index: number;
  source: PlayerSource | null;
  /** La barre est affichée (une file a été lancée et pas fermée). */
  active: boolean;
  loading: boolean;
  /** Fin de la file : « Fin de la lecture ». */
  ended: boolean;
  toast: string | null;
  /** Écrans plein écran qui masquent la barre (story, tuto…). */
  hidden: boolean;
  /** Correctif 06/10 : son touché dont l'extrait ne se lit pas, même après
   *  réparation → l'écran affiche « Écouter sur <mon appli> ». */
  failedId: string | null;
}

let st: PlayerState = { queue: [], index: -1, source: null, active: false, loading: false, ended: false, toast: null, hidden: false, failedId: null };
const subs = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => { st = { ...st, ...patch }; subs.forEach((f) => f()); };
export const getPlayer = () => st;
export function subscribePlayer(cb: () => void) { subs.add(cb); return () => { subs.delete(cb); }; }
/** Lecteur dans un composant (se redessine à chaque changement de file). */
export function usePlayer(): PlayerState { return useSyncExternalStore(subscribePlayer, getPlayer, getPlayer); }

export const current = (): PlayerTrack | null => (st.index >= 0 ? st.queue[st.index] || null : null);
/** Ce son (id à l'écran) est-il celui de la file en ce moment ? */
export const isQueueTrack = (id: string) => st.active && current()?.id === id;

// ---- Réglage « Enchaîner les sons » (Paramètres), activé par défaut -------------
const AUTOPLAY_KEY = 'shakemoi_autoplay';
export function getAutoplay(): boolean { try { return localStorage.getItem(AUTOPLAY_KEY) !== '0'; } catch { return true; } }
export function setAutoplay(on: boolean) { try { localStorage.setItem(AUTOPLAY_KEY, on ? '1' : '0'); } catch { /* rien */ } subs.forEach((f) => f()); }

// ---- Écrans qui masquent la barre ---------------------------------------------
const hiders = new Set<string>();
export function setPlayerHidden(reason: string, on: boolean) {
  if (on) hiders.add(reason); else hiders.delete(reason);
  if (st.hidden !== hiders.size > 0) set({ hidden: hiders.size > 0 });
}

// ---- Événements (Découvrir note « joué » / « écouté jusqu'au bout ») ------------
type TrackCb = (t: PlayerTrack, source: PlayerSource | null) => void;
const startCbs = new Set<TrackCb>();
const fullCbs = new Set<TrackCb>();
export function onTrackStart(cb: TrackCb) { startCbs.add(cb); return () => { startCbs.delete(cb); }; }
/** Un son de la file écouté jusqu'au bout. */
export function onTrackFull(cb: TrackCb) { fullCbs.add(cb); return () => { fullCbs.delete(cb); }; }
const emitFull = (t: PlayerTrack | null) => { if (t) fullCbs.forEach((f) => { try { f(t, st.source); } catch { /* rien */ } }); };

// ---- Lecture -------------------------------------------------------------------
let req = 0;
let advancing = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const urlCache = new Map<string, string | null>();
// Son lancé par un toucher (pas par l'enchaînement) : jamais sauté sur erreur.
let explicitId: string | null = null;
// Une seule réparation par lancement d'un son.
const repaired = new Set<string>();
const failCbs = new Set<(id: string) => void>();
/** Un son touché ne se lit pas, même réparé : l'écran propose « Écouter sur… ». */
export function onTrackFailed(cb: (id: string) => void) { failCbs.add(cb); return () => { failCbs.delete(cb); }; }

async function urlOf(t: PlayerTrack): Promise<string | null> {
  if (urlCache.has(t.id)) return urlCache.get(t.id)!;
  const u = await resolvePreviewUrl(t.title || '', t.artist || '', t.previewUrl, t.spotifyId || null).catch(() => null);
  if (u) urlCache.set(t.id, u);
  return u || null;
}

function showToast(text: string) {
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast: text });
  toastTimer = setTimeout(() => set({ toast: null }), 2600);
}

/**
 * Joue le son n° i de la file. `skip` : s'il n'a pas d'extrait, on passe au
 * suivant (enchaînement) ; sinon (toucher explicite) on renvoie false.
 */
async function playIndex(i: number, opts: { skip: boolean; fade?: boolean; tries?: number } = { skip: true }): Promise<boolean> {
  const tries = opts.tries ?? 0;
  if (i < 0 || i >= st.queue.length || tries > st.queue.length) { finish(); return false; }
  const my = ++req;
  const t = st.queue[i];
  explicitId = opts.skip ? null : t.id;
  repaired.delete(t.id);
  set({ index: i, loading: true, ended: false, active: true, failedId: null });
  if (endTimer) { clearTimeout(endTimer); endTimer = null; }
  const url = await urlOf(t);
  if (my !== req) return false; // un autre son a été demandé entre-temps
  set({ loading: false });
  if (!url) {
    if (opts.skip) return playIndex(nextIndex(i), { ...opts, tries: tries + 1 });
    return false;
  }
  setPreviewMeta(t.id, { title: t.title, artist: t.artist, source: st.source?.kind || 'single' });
  if (opts.fade) crossfadeTo(t.id, url); else playPreview(t.id, url);
  updateMediaSession();
  startCbs.forEach((f) => { try { f(t, st.source); } catch { /* rien */ } });
  // Le suivant se prépare pendant que celui-ci joue.
  const n = st.queue[nextIndex(i)];
  if (n) urlOf(n).then(preloadPreview);
  return true;
}

/** Suivant, en sautant un doublon immédiat (même son deux fois de suite). */
function nextIndex(i: number): number {
  const cur = st.queue[i];
  let j = i + 1;
  while (cur && j < st.queue.length && songKeyOf(st.queue[j].title, st.queue[j].artist) === songKeyOf(cur.title, cur.artist)) j++;
  return j;
}

function finish() {
  stopPreview();
  set({ ended: true, loading: false });
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(() => { if (st.ended) closePlayer(); }, 30_000);
}

/**
 * Lance une file : `tracks` dans l'ordre de l'écran, à partir de `start`.
 * Renvoie false si le son touché n'a pas d'extrait (l'écran propose alors
 * « Écouter sur <mon appli> »).
 */
export async function playQueue(tracks: PlayerTrack[], start: number, source: PlayerSource): Promise<boolean> {
  const list = tracks.filter((t) => t && t.id);
  if (!list.length) return false;
  const changed = !st.active || st.source?.label !== source.label || st.source?.kind !== source.kind;
  set({ queue: list, source, ended: false });
  const ok = await playIndex(Math.max(0, Math.min(start, list.length - 1)), { skip: false });
  if (ok && changed && list.length > 1) showToast(`Lecture · ${source.label}`);
  if (!ok && !getPreviewState().playing) set({ active: st.active && getPreviewState().key != null });
  return ok;
}

export function togglePlayer() {
  const t = current();
  if (!t) return;
  if (st.ended) { replay(); return; }
  if (getPreviewState().key === t.id) togglePreview(t.id);
  else playIndex(st.index, { skip: true });
}
export function nextTrack() {
  if (st.index + 1 >= st.queue.length) { finish(); return; }
  playIndex(nextIndex(st.index), { skip: true, fade: getPreviewState().playing });
}
export function prevTrack() {
  if (getPreviewProgress().current > 3 || st.index <= 0) { seekPreview(0); return; }
  playIndex(st.index - 1, { skip: false, fade: getPreviewState().playing });
}
export function playAtIndex(i: number) { playIndex(i, { skip: true, fade: getPreviewState().playing }); }
export function replay() { playIndex(0, { skip: true }); }

/** Ferme la barre et coupe le son de la file. */
export function closePlayer() {
  req++;
  if (endTimer) { clearTimeout(endTimer); endTimer = null; }
  const t = current();
  if (t && getPreviewState().key === t.id) stopPreview();
  set({ active: false, ended: false, loading: false, queue: [], index: -1, source: null });
  clearMediaSession();
}

// ---- « À suivre » : Lire ensuite / Ajouter à la file / retirer / déplacer -------
export function playNext(t: PlayerTrack) {
  if (!st.active || st.index < 0) { playQueue([t], 0, { kind: 'single', label: t.title }); return; }
  const q = [...st.queue];
  q.splice(st.index + 1, 0, { ...t, added: true });
  set({ queue: q });
  showToast(`Lu ensuite · ${t.title}`);
}
export function addToQueue(t: PlayerTrack) {
  if (!st.active || st.index < 0) { playQueue([t], 0, { kind: 'single', label: t.title }); return; }
  const q = [...st.queue];
  // Après ce qui a déjà été ajouté à la main, avant la suite de la playlist.
  let at = st.index + 1;
  while (at < q.length && q[at].added) at++;
  q.splice(at, 0, { ...t, added: true });
  set({ queue: q });
  showToast(`Ajouté à la file · ${t.title}`);
}
export function removeFromQueue(i: number) {
  if (i === st.index || i < 0 || i >= st.queue.length) return;
  const q = st.queue.filter((_, k) => k !== i);
  set({ queue: q, index: i < st.index ? st.index - 1 : st.index });
}
export function moveInQueue(i: number, to: number) {
  if (i === st.index || to <= st.index || to < 0 || to >= st.queue.length) return;
  const q = [...st.queue];
  const [x] = q.splice(i, 1);
  q.splice(to, 0, x);
  set({ queue: q });
}

// ---- Enchaînement : fondu ~400 ms avant la fin, fin, erreur, son joué ailleurs ----
if (typeof window !== 'undefined') {
  onPreviewProgress(() => {
    const t = current();
    if (!t || advancing || !st.active || !getAutoplay()) return;
    const s = getPreviewState();
    if (s.key !== t.id || !s.playing) return;
    const { current: c, duration: d } = getPreviewProgress();
    if (d > 2 && d - c < 0.45 && st.index + 1 < st.queue.length) {
      advancing = true;
      emitFull(t);
      playIndex(nextIndex(st.index), { skip: true, fade: true }).finally(() => { advancing = false; });
    }
  });
  onPreviewEnded((k) => {
    const t = current();
    if (!t || k !== t.id || !st.active) return;
    emitFull(t);
    if (!getAutoplay()) { set({}); return; }
    if (st.index + 1 < st.queue.length) playIndex(nextIndex(st.index), { skip: true });
    else finish();
  });
  // Correctif 06/10 (S3) : extrait illisible → on l'oublie, on relance une fois
  // la résolution sans cache, et on joue ce qu'on trouve. Toujours rien : sur un
  // toucher, « Écouter sur <mon appli> » (jamais de saut) ; dans l'enchaînement,
  // le suivant.
  onPreviewError(async (k) => {
    const t = current();
    if (!t || k !== t.id || !st.active) return;
    const bad = getCurrentPreviewUrl();
    urlCache.delete(t.id);
    if (bad && !repaired.has(t.id)) {
      repaired.add(t.id);
      const my = ++req;
      set({ loading: true });
      const url = await repairPreview(t.id, { title: t.title, artist: t.artist, spotifyId: t.spotifyId }, bad);
      if (my !== req) return; // un autre son a été demandé entre-temps
      set({ loading: false });
      if (url) { urlCache.set(t.id, url); playPreview(t.id, url); return; }
    }
    if (explicitId === t.id) {
      set({ failedId: t.id, loading: false });
      failCbs.forEach((f) => { try { f(t.id); } catch { /* rien */ } });
      return;
    }
    nextTrack();
  });
  // Un son lancé AILLEURS (hors file, hors Shake éphémère) : la file s'arrête,
  // la barre disparaît — jamais deux lecteurs ni de barre « fantôme ».
  onPreviewChange(() => {
    const s = getPreviewState();
    const t = current();
    if (st.active && t && s.key && s.playing && !s.key.startsWith('story-') && !st.queue.some((q) => q.id === s.key)) {
      req++;
      set({ active: false, ended: false, loading: false, queue: [], index: -1, source: null });
      clearMediaSession();
      return;
    }
    subs.forEach((f) => f()); // lecture / pause : la barre se redessine
  });
}

// ---- Écran verrouillé / centre de contrôle (Media Session), pour toute l'appli ----
function updateMediaSession() {
  const ms = typeof navigator !== 'undefined' ? (navigator as any).mediaSession : null;
  const t = current();
  if (!ms || !t) return;
  try {
    ms.metadata = new (window as any).MediaMetadata({
      title: t.title, artist: t.artist, album: st.source?.label || 'SHAKEmoi',
      artwork: t.cover ? [{ src: thumb(t.cover, 512) || t.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    ms.setActionHandler('play', togglePlayer);
    ms.setActionHandler('pause', togglePlayer);
    ms.setActionHandler('previoustrack', prevTrack);
    ms.setActionHandler('nexttrack', nextTrack);
    ms.setActionHandler('seekto', (d: any) => {
      const { duration } = getPreviewProgress();
      if (duration && d?.seekTime != null) seekPreview(d.seekTime / duration);
    });
  } catch { /* navigateur sans Media Session complète */ }
}
function clearMediaSession() {
  const ms = typeof navigator !== 'undefined' ? (navigator as any).mediaSession : null;
  try { ms && (ms.metadata = null); ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'].forEach((a) => ms?.setActionHandler(a, null)); } catch { /* rien */ }
}

// ---- Files logiques (R6) : chaque liste d'écran fournit sa file ------------------
/** Une liste de sons à l'écran (fil, profil, classement…) : ses pochettes jouent dans cette file. */
export interface QueueContextValue { tracks: () => PlayerTrack[] | Promise<PlayerTrack[]>; source: PlayerSource }

/** Un post (ligne de la base) → un son de la file. */
export function trackFromPost(p: any, id = `post-${p.id}`): PlayerTrack | null {
  if (!p?.track_name) return null;
  const sid = p.track_id || p.spotify_url?.match(/track[/:]([A-Za-z0-9]{22})/)?.[1] || null;
  return { id, title: p.track_name, artist: p.artist || '', cover: p.cover_url || p.album_cover_url || null, previewUrl: p.preview_url || null, spotifyId: sid, postId: p.id };
}
export const PlayQueueContext = createContext<QueueContextValue | null>(null);
