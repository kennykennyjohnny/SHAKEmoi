// Playlist du cercle (P21) : un vrai écran à la place de la conversation (on
// garde l'en-tête du cercle). Tous les sons partagés, du plus récent au plus
// ancien, un son partagé plusieurs fois n'apparaît qu'une fois (« partagé 3
// fois »). « Tout écouter » enchaîne les extraits (un seul son à la fois, M2),
// mini-lecteur fixe en bas, commandes sur l'écran verrouillé (Media Session).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Play, Pause, SkipBack, SkipForward, Loader2, Users, Music, ListMusic } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MediaImg, thumb } from '../../lib/media';
import { formatRelative } from '../../lib/dates';
import {
  resolvePreviewUrl, playPreview, togglePreview, getPreviewState, onPreviewChange, onPreviewEnded,
  onPreviewProgress, getPreviewProgress, seekPreview,
} from '../../lib/preview';

interface Entry {
  key: string;
  track_name: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  track_id: string | null;
  spotify_url: string | null;
  count: number;
  lastAt: string;
  lastBy: string;
  messageId: string;
}

const songKey = (t?: string | null, a?: string | null) =>
  `${(t || '').toLowerCase().replace(/\s*[([][^)\]]*[)\]]|\s+-\s+.*$/g, '').trim()}|${(a || '').split(',')[0].trim().toLowerCase()}`;

export function CirclePlaylist({ circleId, name, photoUrl, subtitle, onBack, onChat, onOpenMessage }: {
  circleId: string; name: string; photoUrl: string | null; subtitle: string;
  onBack: () => void; onChat: () => void; onOpenMessage: (messageId: string) => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [current, setCurrent] = useState<number>(-1);
  const [, setTick] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const currentRef = useRef(-1);
  entriesRef.current = entries || [];
  currentRef.current = current;
  const press = useRef<number | null>(null);

  useEffect(() => {
    let off = false;
    supabase.from('circle_messages')
      .select('id, track_name, artist, cover_url, preview_url, track_id, spotify_url, created_at, sender:users_profile!circle_messages_sender_id_fkey(username)')
      .eq('circle_id', circleId).not('track_name', 'is', null).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        if (off) return;
        const map = new Map<string, Entry>();
        for (const m of data || []) {
          const k = songKey(m.track_name, m.artist);
          const by = (Array.isArray(m.sender) ? m.sender[0] : m.sender)?.username || '';
          const e = map.get(k);
          if (e) { e.count++; continue; }
          map.set(k, { key: k, track_name: m.track_name, artist: m.artist, cover_url: m.cover_url, preview_url: m.preview_url, track_id: m.track_id || m.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null, spotify_url: m.spotify_url, count: 1, lastAt: m.created_at, lastBy: by, messageId: m.id });
        }
        setEntries([...map.values()]);
      }, () => { if (!off) setEntries([]); });
    return () => { off = true; };
  }, [circleId]);

  const keyOf = (i: number) => `pl-${circleId}-${entriesRef.current[i]?.key}`;
  // Lecture du son i ; s'il n'a pas d'extrait, on passe au suivant.
  const playAt = async (i: number, tries = 0) => {
    const list = entriesRef.current;
    if (i < 0 || i >= list.length || tries > list.length) return;
    const e = list[i];
    setCurrent(i);
    setLoadingIdx(i);
    const url = await resolvePreviewUrl(e.track_name, e.artist, e.preview_url, e.track_id).catch(() => null);
    setLoadingIdx(null);
    if (currentRef.current !== i) return; // on a changé de son entre-temps
    if (!url) { playAt(i + 1, tries + 1); return; }
    playPreview(keyOf(i), url);
  };
  const next = () => { if (currentRef.current + 1 < entriesRef.current.length) playAt(currentRef.current + 1); };
  const prev = () => {
    if (getPreviewProgress().current > 3) { seekPreview(0); return; }
    if (currentRef.current > 0) playAt(currentRef.current - 1);
  };
  const toggle = () => {
    if (current < 0) { playAt(0); return; }
    togglePreview(keyOf(current));
  };

  // Lecture enchaînée + redessin sur lecture / pause / progression.
  useEffect(() => {
    const a = onPreviewChange(() => setTick((n) => n + 1));
    const b = onPreviewProgress(() => setTick((n) => n + 1));
    const c = onPreviewEnded((k) => { if (k === keyOf(currentRef.current)) next(); });
    return () => { a(); b(); c(); };
  }, [circleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = getPreviewState();
  const isPlaying = current >= 0 && st.key === keyOf(current) && st.playing;
  const cur = current >= 0 ? (entries || [])[current] : null;
  const prog = getPreviewProgress();

  // Écran verrouillé / centre de contrôle (Media Session).
  useEffect(() => {
    const ms = (navigator as any).mediaSession;
    if (!ms || !cur) return;
    try {
      ms.metadata = new (window as any).MediaMetadata({
        title: cur.track_name, artist: cur.artist, album: name,
        artwork: cur.cover_url ? [{ src: thumb(cur.cover_url, 512) || cur.cover_url, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
      ms.setActionHandler('play', toggle);
      ms.setActionHandler('pause', toggle);
      ms.setActionHandler('previoustrack', prev);
      ms.setActionHandler('nexttrack', next);
    } catch { /* navigateur sans Media Session complète */ }
  }, [cur?.key, name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    const ms = (navigator as any).mediaSession;
    try { ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((a) => ms?.setActionHandler(a, null)); } catch { /* rien */ }
  }, []);

  const total = useMemo(() => (entries || []).reduce((n, e) => n + e.count, 0), [entries]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* En-tête du cercle (le même que la conversation) */}
      <div className="px-3 py-2.5 border-b border-purple-500/25 flex items-center gap-2.5 flex-shrink-0 bg-[#1E1440]/95">
        <button onClick={onBack} aria-label="Retour" className="p-1.5 hover:bg-violet-900/25 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          {photoUrl ? <MediaImg src={photoUrl} width={128} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{name}</p>
          <p className="text-xs text-purple-300/70 truncate flex items-center gap-1"><ListMusic className="w-3 h-3" /> Playlist · {subtitle}</p>
        </div>
        <button onClick={onChat} aria-label="Revenir à la conversation" title="Conversation" className="p-2 rounded-full text-purple-200 hover:bg-violet-900/25"><MessageCircle className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3">
        {entries === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-sm text-purple-300/70">
            <Music className="w-9 h-9 text-[#FFEFD5] mx-auto mb-2" />
            Aucun son partagé dans ce cercle pour l'instant. Envoie le premier depuis la conversation 🎧
          </div>
        ) : (
          <>
            <button onClick={() => playAt(0)} className="w-full mb-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-white" /> Tout écouter <span className="text-xs font-normal opacity-80">· {entries.length} son{entries.length > 1 ? 's' : ''}{total > entries.length ? `, ${total} partages` : ''}</span>
            </button>
            <div className="space-y-1">
              {entries.map((e, i) => {
                const active = i === current;
                return (
                  <button key={e.key}
                    onClick={() => (active ? toggle() : playAt(i))}
                    onContextMenu={(ev) => { ev.preventDefault(); onOpenMessage(e.messageId); }}
                    onTouchStart={() => { press.current = window.setTimeout(() => { navigator.vibrate?.(10); onOpenMessage(e.messageId); }, 550); }}
                    onTouchEnd={() => { if (press.current) clearTimeout(press.current); }}
                    onTouchMove={() => { if (press.current) clearTimeout(press.current); }}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left select-none ${active ? 'bg-pink-500/15 border border-pink-500/40' : 'hover:bg-violet-950/40 border border-transparent'}`}>
                    <div className="relative w-12 h-12 flex-shrink-0">
                      {e.cover_url ? <img src={thumb(e.cover_url, 128)} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-violet-900/50" />}
                      {active && (
                        <span className="absolute inset-0 rounded-lg bg-black/45 flex items-center justify-center">
                          {loadingIdx === i ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${active ? 'text-pink-200' : 'text-white'}`}>{e.track_name}</p>
                      <p className="text-xs text-purple-200/70 truncate">{e.artist}</p>
                      <p className="text-[11px] text-purple-300/60 truncate">@{e.lastBy} · {formatRelative(e.lastAt)}{e.count > 1 ? ` · partagé ${e.count} fois` : ''}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-purple-300/50 text-center mt-3">Appui long sur un son : voir le message d'origine.</p>
          </>
        )}
      </div>

      {/* Mini-lecteur fixe */}
      <div className="flex-shrink-0 border-t border-purple-500/25 bg-[#1D0F3D] pb-[var(--nav-h)] lg:pb-0">
        <div className="h-1 bg-purple-900/60 cursor-pointer" onClick={(ev) => { const r = (ev.currentTarget as HTMLDivElement).getBoundingClientRect(); seekPreview((ev.clientX - r.left) / r.width); }}>
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${prog.duration ? (prog.current / prog.duration) * 100 : 0}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2">
          {cur?.cover_url ? <img src={thumb(cur.cover_url, 128)} alt="" className="w-11 h-11 rounded-md object-cover" /> : <div className="w-11 h-11 rounded-md bg-violet-900/50 flex items-center justify-center"><Music className="w-4 h-4 text-purple-300" /></div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{cur?.track_name || 'Rien en cours'}</p>
            <p className="text-xs text-purple-300/70 truncate">{cur?.artist || 'Touche « Tout écouter »'}</p>
          </div>
          <button aria-label="Précédent" onClick={prev} disabled={current <= 0} className="p-2 rounded-full disabled:opacity-30"><SkipBack className="w-5 h-5 fill-white" /></button>
          <button aria-label={isPlaying ? 'Pause' : 'Lecture'} onClick={toggle} disabled={!entries?.length} className="p-3 rounded-full bg-white text-[#1E1440] disabled:opacity-40">
            {loadingIdx !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
          <button aria-label="Suivant" onClick={next} disabled={current >= (entries?.length || 0) - 1} className="p-2 rounded-full disabled:opacity-30"><SkipForward className="w-5 h-5 fill-white" /></button>
        </div>
      </div>
    </div>
  );
}
