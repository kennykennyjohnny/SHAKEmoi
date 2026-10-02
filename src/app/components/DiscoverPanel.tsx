// Onglet « Découvrir » du Classement (Q4, Q8) : ~20 sons choisis pour moi,
// chacun avec SA raison en une ligne. Une seule lecture en base
// (get_my_recos, liste précalculée) : instantané, même en 4G. Aucune API
// extérieure n'est appelée ici (voir docs/reco.md).
// - pochette jouable (M2), « Tout écouter » = le lecteur de la playlist du cercle ;
// - « Shaker » publie tout de suite, « Pas pour moi » retire (et apprend) ;
// - tirer vers le bas (ou « Une autre série ») propose une nouvelle série ;
// - tout ce qui se passe est noté (reco_events) pour régler les poids.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Play, Pause, Loader2, X, Sparkles, Users, Music, Zap, Compass, TrendingUp, UserPlus, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createPost } from '../../lib/database';
import { thumb } from '../../lib/media';
import { getPlatformUrl } from '../../lib/odesli';
import { openExternal } from '../../lib/platforms';
import { MyAppLogo } from './PlatformLogo';
import { useQueuePlayer, MiniPlayer } from './QueuePlayer';

interface RecoItem {
  rank: number;
  song_key: string;
  reason: string;
  reason_kind: string;
  track: { title: string; artist: string; cover_url: string | null; preview_url: string | null; deezer_id: number | null; spotify_url: string | null; deezer_url: string | null; post_id: string | null };
}
type Row = RecoItem & { key: string; track_name: string; artist: string; cover_url: string | null; preview_url: string | null };

const REASON_ICON: Record<string, any> = {
  social: Users, invite: UserPlus, rel: Sparkles, top: Sparkles, lfm: Sparkles, style: Music, fresh: Zap, explore: Compass, trend: TrendingUp,
};

// Petit cache : revenir sur l'onglet est instantané.
let memo: { at: number; series: number; items: RecoItem[] } | null = null;

async function logEvent(rows: { song_key: string; track_name?: string; artist?: string; event: string; rank?: number; reason_kind?: string }[]) {
  if (!rows.length) return;
  supabase.from('reco_events').insert(rows).then(() => {}, () => {});
}

export function DiscoverPanel({ visible, currentUser, onRefreshFeed }: { visible: boolean; currentUser: any; onRefreshFeed?: () => void }) {
  const [items, setItems] = useState<RecoItem[] | null>(memo && Date.now() - memo.at < 10 * 60_000 ? memo.items : null);
  const [series, setSeries] = useState(memo?.series || 0);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shaking, setShaking] = useState<string | null>(null);
  const [shaked, setShaked] = useState<Set<string>>(new Set());
  const shownRef = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);

  const load = async (s: number) => {
    setError(false);
    try {
      const { data, error: e } = await supabase.rpc('get_my_recos', { p_series: s });
      if (e) throw e;
      const list = ((data as any)?.items || []) as RecoItem[];
      memo = { at: Date.now(), series: s, items: list };
      setItems(list);
      setSeries(s);
    } catch {
      setError(true);
      if (!items) setItems([]);
    }
  };
  useEffect(() => { if (visible && !items) load(0); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextSeries = async () => {
    setRefreshing(true);
    await load(series + 1);
    setRefreshing(false);
    rootRef.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 });
  };

  // « Affiché » : une fois par son et par série, quand l'onglet est visible.
  useEffect(() => {
    if (!visible || !items?.length) return;
    const fresh = items.filter((i) => !shownRef.current.has(`${series}:${i.song_key}`));
    fresh.forEach((i) => shownRef.current.add(`${series}:${i.song_key}`));
    logEvent(fresh.map((i) => ({ song_key: i.song_key, track_name: i.track.title, artist: i.track.artist, event: 'shown', rank: i.rank, reason_kind: i.reason_kind })));
  }, [visible, items, series]);

  const rows: Row[] = (items || []).map((i) => ({ ...i, key: i.song_key, track_name: i.track.title, artist: i.track.artist, cover_url: i.track.cover_url, preview_url: i.track.preview_url }));
  const ev = (r: Row, event: string) => logEvent([{ song_key: r.song_key, track_name: r.track_name, artist: r.artist, event, rank: r.rank, reason_kind: r.reason_kind }]);
  const q = useQueuePlayer(rows, 'disc', {
    album: 'Découvrir',
    onStart: (r) => ev(r as Row, 'play'),
    onEnded: (r) => ev(r as Row, 'play_full'),
  });

  const shake = async (r: Row) => {
    setShaking(r.key);
    const res = await createPost(r.track_name, r.artist, r.cover_url || '', '', r.preview_url, r.track.spotify_url, null).catch(() => ({ success: false }));
    setShaking(null);
    if ((res as any)?.success) {
      setShaked((s) => new Set([...s, r.key]));
      ev(r, 'shake');
      onRefreshFeed?.();
      window.dispatchEvent(new CustomEvent('shakemoi:posted'));
    } else alert('Ton Shake n’a pas pu être publié. Vérifie ta connexion et réessaie.');
  };
  const dismiss = (r: Row) => {
    ev(r, 'dismiss');
    setItems((list) => (list || []).filter((x) => x.song_key !== r.song_key));
    if (memo) memo.items = memo.items.filter((x) => x.song_key !== r.song_key);
  };
  const openInApp = (r: Row) => {
    const url = getPlatformUrl({ spotify_url: r.track.spotify_url, deezer_url: r.track.deezer_url }, currentUser?.musicService || 'spotify', { title: r.track_name, artist: r.artist });
    if (url) openExternal(url);
  };

  // Tirer vers le bas (contenu tout en haut) : nouvelle série.
  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest('.overflow-y-auto') as HTMLElement | null;
    if (!root || !scroller || !visible) return;
    let st: { y: number; x: number; on: boolean } | null = null;
    let dist = 0;
    const start = (e: TouchEvent) => { st = scroller.scrollTop <= 0 ? { y: e.touches[0].clientY, x: e.touches[0].clientX, on: false } : null; dist = 0; };
    const move = (e: TouchEvent) => {
      if (!st) return;
      const dy = e.touches[0].clientY - st.y;
      const dx = e.touches[0].clientX - st.x;
      if (!st.on) { if (Math.abs(dy) < 8) return; if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { st = null; return; } st.on = true; }
      e.preventDefault();
      dist = Math.min(110, dy * 0.5);
      setPull(dist);
    };
    const end = () => { if (st?.on && dist > 64) nextSeries(); st = null; setPull(0); };
    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end);
    return () => { root.removeEventListener('touchstart', start); root.removeEventListener('touchmove', move); root.removeEventListener('touchend', end); };
  }, [visible, series]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items === null) {
    return (
      <div className="space-y-2 pt-1" aria-busy="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <span className="w-14 h-14 rounded-lg bg-purple-300/10 animate-pulse" />
            <span className="flex-1"><span className="block h-4 w-40 rounded bg-purple-300/15 animate-pulse mb-1.5" /><span className="block h-3 w-28 rounded bg-purple-300/10 animate-pulse" /></span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Indicateur « tirer pour une nouvelle série » */}
      <div className="flex justify-center overflow-hidden transition-[height]" style={{ height: refreshing ? 40 : pull * 0.6 }}>
        <RefreshCw className={`w-5 h-5 text-pink-300 mt-2 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pull * 3}deg)`, opacity: refreshing ? 1 : Math.min(1, pull / 64) }} />
      </div>

      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-pink-300" /> Choisis pour toi</p>
          <p className="text-xs text-purple-200">D'après tes Shakes, tes likes et les goûts de tes potes · nouvelle sélection chaque jour</p>
        </div>
      </div>

      {error && <p className="text-sm text-pink-200 mb-3">La sélection n'a pas pu se charger. <button onClick={() => load(series)} className="underline font-semibold">Réessayer</button></p>}

      {rows.length === 0 && !error ? (
        <div className="text-center py-12 px-4">
          <Music className="w-10 h-10 text-[#FFEFD5] mx-auto mb-3" />
          <p className="font-semibold text-white">Ta sélection se prépare</p>
          <p className="text-sm text-purple-200 mt-1">Shake, like et écoute des sons : Découvrir apprend tes goûts. Reviens dans un moment.</p>
        </div>
      ) : (
        <>
          <button onClick={() => q.playAt(0)} className="w-full mb-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold flex items-center justify-center gap-2">
            <Play className="w-4 h-4 fill-white" /> Tout écouter <span className="text-xs font-normal opacity-90">· {rows.length} sons</span>
          </button>
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const active = i === q.current;
                const Icon = REASON_ICON[r.reason_kind] || Sparkles;
                const done = shaked.has(r.key);
                return (
                  <motion.div key={r.key} layout exit={{ opacity: 0, x: -40, height: 0 }}
                    className={`flex items-center gap-3 p-2 rounded-xl ${active ? 'bg-pink-500/15 border border-pink-500/40' : 'border border-transparent'}`}>
                    <button onClick={() => (active ? q.toggle() : q.playAt(i))} aria-label={`Écouter ${r.track_name}`} className="relative w-14 h-14 flex-shrink-0">
                      {r.cover_url ? <img src={thumb(r.cover_url, 128)} alt="" loading="lazy" className="w-14 h-14 rounded-lg object-cover" /> : <span className="block w-14 h-14 rounded-lg bg-violet-900/50" />}
                      <span className="absolute inset-0 rounded-lg bg-black/35 flex items-center justify-center">
                        {active && q.loadingIdx === i ? <Loader2 className="w-5 h-5 animate-spin" /> : active && q.isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${active ? 'text-pink-100' : 'text-white'}`}>{r.track_name}</p>
                      <p className="text-xs text-purple-200 truncate">{r.artist}</p>
                      <p className="text-[11px] text-pink-200/95 truncate flex items-center gap-1 mt-0.5"><Icon className="w-3 h-3 flex-shrink-0" /> {r.reason}</p>
                    </div>
                    <button onClick={() => openInApp(r)} aria-label="Ouvrir dans mon appli de musique" className="p-1.5 rounded-full bg-fuchsia-500/15 flex-shrink-0">
                      <MyAppLogo className="w-4 h-4 text-fuchsia-300" />
                    </button>
                    {done ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-fuchsia-300 px-2 flex-shrink-0"><Check className="w-3.5 h-3.5" /> Shaké</span>
                    ) : (
                      <button onClick={() => shake(r)} disabled={shaking === r.key}
                        className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-bold flex-shrink-0 disabled:opacity-60">
                        {shaking === r.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Shaker'}
                      </button>
                    )}
                    <button onClick={() => dismiss(r)} aria-label="Pas pour moi" title="Pas pour moi" className="p-1.5 rounded-full text-purple-200 hover:text-white hover:bg-white/10 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <button onClick={nextSeries} disabled={refreshing} className="w-full mt-4 mb-2 py-2.5 rounded-xl bg-violet-950/50 border border-purple-500/30 text-sm font-semibold text-purple-100 flex items-center justify-center gap-2 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Une autre série
          </button>
          <p className="text-[11px] text-purple-300/85 text-center mb-2">Touche ✕ sur un son qui n'est pas pour toi : Découvrir en tient compte.</p>
        </>
      )}

      {/* Mini-lecteur (Tout écouter) */}
      {q.current >= 0 && (
        <div className="sticky bottom-0 -mx-4 mt-2">
          <MiniPlayer q={q} count={rows.length} />
        </div>
      )}
    </div>
  );
}
