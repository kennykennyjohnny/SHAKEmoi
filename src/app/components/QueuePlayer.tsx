// Lecteur enchaîné (P21) : « Tout écouter » joue les extraits l'un après
// l'autre (un seul son à la fois, M2 ; un son sans extrait est sauté),
// mini-lecteur fixe, commandes sur l'écran verrouillé (Media Session).
// Partagé par la playlist du cercle et Découvrir (Q8).
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Loader2, Music } from 'lucide-react';
import { thumb } from '../../lib/media';
import {
  resolvePreviewUrl, playPreview, togglePreview, getPreviewState, onPreviewChange, onPreviewEnded,
  onPreviewProgress, getPreviewProgress, seekPreview, setPreviewMeta,
} from '../../lib/preview';

export interface QueueEntry {
  key: string;
  track_name: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  track_id?: string | null;
}

export function useQueuePlayer<T extends QueueEntry>(entries: T[] | null, ns: string, opts?: { album?: string; onStart?: (e: T, i: number) => void; onEnded?: (e: T, i: number) => void }) {
  const [current, setCurrent] = useState<number>(-1);
  const [, setTick] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const entriesRef = useRef<T[]>([]);
  const currentRef = useRef(-1);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  entriesRef.current = entries || [];
  currentRef.current = current;

  const keyOf = (i: number) => `${ns}-${entriesRef.current[i]?.key}`;
  // Lecture du son i ; s'il n'a pas d'extrait, on passe au suivant.
  const playAt = async (i: number, tries = 0) => {
    const list = entriesRef.current;
    if (i < 0 || i >= list.length || tries > list.length) return;
    const e = list[i];
    setCurrent(i);
    currentRef.current = i;
    setLoadingIdx(i);
    const url = await resolvePreviewUrl(e.track_name, e.artist, e.preview_url, e.track_id || null).catch(() => null);
    setLoadingIdx(null);
    if (currentRef.current !== i) return; // on a changé de son entre-temps
    if (!url) { playAt(i + 1, tries + 1); return; }
    setPreviewMeta(keyOf(i), { title: e.track_name, artist: e.artist, source: ns.split('-')[0] });
    playPreview(keyOf(i), url);
    optsRef.current?.onStart?.(e, i);
  };
  const next = () => { if (currentRef.current + 1 < entriesRef.current.length) playAt(currentRef.current + 1); };
  const prev = () => {
    if (getPreviewProgress().current > 3) { seekPreview(0); return; }
    if (currentRef.current > 0) playAt(currentRef.current - 1);
  };
  const toggle = () => {
    if (currentRef.current < 0) { playAt(0); return; }
    togglePreview(keyOf(currentRef.current));
  };

  // Lecture enchaînée + redessin sur lecture / pause / progression.
  useEffect(() => {
    const a = onPreviewChange(() => setTick((n) => n + 1));
    const b = onPreviewProgress(() => setTick((n) => n + 1));
    const c = onPreviewEnded((k) => {
      if (k !== keyOf(currentRef.current)) return;
      const e = entriesRef.current[currentRef.current];
      if (e) optsRef.current?.onEnded?.(e, currentRef.current);
      next();
    });
    return () => { a(); b(); c(); };
  }, [ns]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = getPreviewState();
  const isPlaying = current >= 0 && st.key === keyOf(current) && st.playing;
  const cur = current >= 0 ? (entries || [])[current] : null;

  // Écran verrouillé / centre de contrôle (Media Session).
  useEffect(() => {
    const ms = (navigator as any).mediaSession;
    if (!ms || !cur) return;
    try {
      ms.metadata = new (window as any).MediaMetadata({
        title: cur.track_name, artist: cur.artist, album: optsRef.current?.album || 'SHAKEmoi',
        artwork: cur.cover_url ? [{ src: thumb(cur.cover_url, 512) || cur.cover_url, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
      ms.setActionHandler('play', toggle);
      ms.setActionHandler('pause', toggle);
      ms.setActionHandler('previoustrack', prev);
      ms.setActionHandler('nexttrack', next);
    } catch { /* navigateur sans Media Session complète */ }
  }, [cur?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    const ms = (navigator as any).mediaSession;
    try { ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((a) => ms?.setActionHandler(a, null)); } catch { /* rien */ }
  }, []);

  return { current, cur, isPlaying, loadingIdx, playAt, next, prev, toggle, keyOf };
}

/** Mini-lecteur fixe en bas de l'écran. */
export function MiniPlayer({ q, count, idleHint = 'Touche « Tout écouter »' }: { q: ReturnType<typeof useQueuePlayer<any>>; count: number; idleHint?: string }) {
  const prog = getPreviewProgress();
  const { cur, current, isPlaying, loadingIdx } = q;
  return (
    <div className="flex-shrink-0 border-t border-purple-500/25 bg-[#1D0F3D]">
      <div className="h-1 bg-purple-900/60 cursor-pointer" onClick={(ev) => { const r = (ev.currentTarget as HTMLDivElement).getBoundingClientRect(); seekPreview((ev.clientX - r.left) / r.width); }}>
        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${prog.duration && current >= 0 ? (prog.current / prog.duration) * 100 : 0}%` }} />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        {cur?.cover_url ? <img src={thumb(cur.cover_url, 128)} alt="" className="w-11 h-11 rounded-md object-cover" /> : <div className="w-11 h-11 rounded-md bg-violet-900/50 flex items-center justify-center"><Music className="w-4 h-4 text-purple-300" /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{cur?.track_name || 'Rien en cours'}</p>
          <p className="text-xs text-purple-200 truncate">{cur?.artist || idleHint}</p>
        </div>
        <button aria-label="Précédent" onClick={q.prev} disabled={current <= 0} className="p-2 rounded-full disabled:opacity-30"><SkipBack className="w-5 h-5 fill-white" /></button>
        <button aria-label={isPlaying ? 'Pause' : 'Lecture'} onClick={q.toggle} disabled={!count} className="p-3 rounded-full bg-white text-[#1E1440] disabled:opacity-40">
          {loadingIdx !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
        <button aria-label="Suivant" onClick={q.next} disabled={current >= count - 1} className="p-2 rounded-full disabled:opacity-30"><SkipForward className="w-5 h-5 fill-white" /></button>
      </div>
    </div>
  );
}
