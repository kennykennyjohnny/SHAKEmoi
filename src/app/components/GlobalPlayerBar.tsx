// R5 : la barre de lecture fine et flottante, au-dessus des onglets, sur tous
// les écrans tant qu'une file joue (lib/player). Toucher → retour à la source
// (la playlist, le post…) sur le son en cours ; glisser vers le bas → arrêt ;
// glisser vers le haut → « À suivre » (R6). Sur ordinateur : une croix.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Play, Pause, SkipForward, X, Loader2, RotateCcw, Sparkles, ChevronUp, ChevronDown, ListMusic, Music } from 'lucide-react';
import {
  usePlayer, current, togglePlayer, nextTrack, closePlayer, replay, playQueue, playAtIndex,
  removeFromQueue, moveInQueue, getAutoplay, setAutoplay, type PlayerTrack,
} from '../../lib/player';
import { getPreviewState, onPreviewChange, onPreviewProgress, getPreviewProgress } from '../../lib/preview';
import { thumb } from '../../lib/media';
import { supabase } from '../../lib/supabase';
import { useBackHandler } from '../../lib/navigation';
import { openPostInList } from '../../lib/appNav';
import { tween, prefersReducedMotion } from '../../lib/motion';

function usePreviewTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const a = onPreviewChange(() => setN((n) => n + 1));
    const b = onPreviewProgress(() => setN((n) => n + 1));
    return () => { a(); b(); };
  }, []);
}

const open = (target?: string | null) => { if (target) window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: target })); };

/** Titre qui défile doucement s'il est trop long (sinon immobile). */
function Marquee({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(0);
  const reduced = prefersReducedMotion();
  useEffect(() => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    setOver(Math.max(0, i.scrollWidth - b.clientWidth));
  }, [text]);
  return (
    <span ref={box} className={`block overflow-hidden whitespace-nowrap ${className || ''}`}>
      <span ref={inner} className="inline-block"
        style={over > 4 && !reduced ? { animation: `marquee ${Math.max(6, over / 18)}s linear infinite alternate`, ['--marquee' as any]: `-${over}px` } : undefined}>
        {text}
      </span>
    </span>
  );
}

async function continueWithDiscover() {
  const { data } = await supabase.rpc('get_my_recos', { p_series: 0 });
  const items: any[] = (data as any)?.items || [];
  const tracks: PlayerTrack[] = items.map((r) => ({
    id: `disc-${r.song_key}`, title: r.track?.title, artist: r.track?.artist, cover: r.track?.cover_url,
    previewUrl: r.track?.preview_url, spotifyId: null,
  })).filter((t) => t.title);
  if (tracks.length) playQueue(tracks, 0, { kind: 'discover', label: 'Découvrir', target: 'discover:1' });
}

export function GlobalPlayerBar() {
  const p = usePlayer();
  usePreviewTick();
  const [showQueue, setShowQueue] = useState(false);
  const t = current();
  const visible = p.active && !p.hidden && (!!t || p.ended);

  // Le contenu de l'appli laisse la place à la barre (padding en bas).
  useEffect(() => {
    document.documentElement.style.setProperty('--player-pad', visible ? '64px' : '0px');
    return () => { document.documentElement.style.setProperty('--player-pad', '0px'); };
  }, [visible]);
  useEffect(() => { if (!p.active) setShowQueue(false); }, [p.active]);

  // Toucher la barre : retour à la source, sur le son en cours.
  const goToSource = () => {
    const src = p.source;
    if (!src?.target || !t) return;
    let tg = src.target;
    if (tg.includes('{post}')) {
      if (!t.postId) return;
      tg = tg.replace('{post}', t.postId);
      if (src.postList?.length) openPostInList(t.postId, src.postList);
    }
    open(tg);
  };

  const s = getPreviewState();
  const playing = !!t && s.key === t.id && s.playing;
  const { current: c, duration: d } = getPreviewProgress();
  const pct = playing || (t && s.key === t.id) ? (d ? Math.min(100, (c / d) * 100) : 0) : 0;

  // Glisser : vers le bas = arrêter, vers le haut = « À suivre ».
  const drag = useRef<{ y: number; x: number; moved: boolean } | null>(null);
  const [dy, setDy] = useState(0);
  const onDown = (e: React.PointerEvent) => { drag.current = { y: e.clientY, x: e.clientX, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const ddy = e.clientY - g.y;
    if (Math.abs(ddy) > 8 && Math.abs(ddy) > Math.abs(e.clientX - g.x)) {
      // Le doigt peut sortir de la barre : on le garde (sinon le relâché est perdu).
      if (!g.moved) { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* rien */ } }
      g.moved = true;
      setDy(Math.max(-40, Math.min(80, ddy)));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = drag.current;
    drag.current = null;
    setDy(0);
    if (!g) return;
    const ddy = e.clientY - g.y;
    if (g.moved && ddy > 40) { closePlayer(); return; }
    if (g.moved && ddy < -30) { setShowQueue(true); return; }
  };

  return (
    <>
      <AnimatePresence>
        {visible && p.toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tween()}
            role="status"
            className="fixed z-[45] left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/80 text-white text-xs font-semibold shadow-lg pointer-events-none bottom-[calc(140px+env(safe-area-inset-bottom))] lg:absolute lg:bottom-[84px]">
            {p.toast}
          </motion.div>
        )}
        {visible && (
          <motion.div key="bar" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: dy }} exit={{ opacity: 0, y: 24 }} transition={tween()}
            data-global-player
            className="fixed z-[45] left-2 right-2 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:absolute lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-[min(560px,calc(100%-2rem))] lg:bottom-4 rounded-2xl overflow-hidden bg-[#2A1852]/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.45)] touch-none select-none"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setDy(0); }}>
            {p.ended ? (
              <div className="flex items-center gap-2 px-3 h-14">
                <p className="flex-1 text-sm font-semibold">Fin de la lecture</p>
                <button onClick={replay} className="min-h-[44px] px-3 rounded-full bg-white/10 text-xs font-bold flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Rejouer</button>
                <button onClick={continueWithDiscover} className="min-h-[44px] px-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Continuer avec Découvrir</button>
                <button aria-label="Fermer le lecteur" onClick={closePlayer} className="w-11 h-11 rounded-full flex items-center justify-center text-purple-100"><X className="w-5 h-5" /></button>
              </div>
            ) : t && (
              <div className="flex items-center gap-2.5 pl-2.5 pr-1 h-14">
                <button className="flex-1 min-w-0 flex items-center gap-2.5 text-left h-full" aria-label={`Revenir à ${p.source?.label || 'la source'} : ${t.title}`}
                  onClick={() => { if (!drag.current) goToSource(); }}>
                  {t.cover
                    ? <img src={thumb(t.cover, 96)} alt="" className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${playing ? 'ring-2 ring-fuchsia-400/70' : ''}`} />
                    : <span className="w-8 h-8 rounded-full bg-violet-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4" /></span>}
                  <span className="min-w-0 flex-1">
                    <Marquee text={t.title} className="text-[13px] font-semibold leading-tight" />
                    <span className="block text-[11px] text-purple-200 truncate leading-tight">{t.artist}{p.source && p.source.kind !== 'single' ? ` · ${p.source.label}` : ''}</span>
                  </span>
                </button>
                <button aria-label={playing ? 'Pause' : 'Lecture'} onClick={togglePlayer} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
                  {p.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white translate-x-[1px]" />}
                </button>
                <button aria-label="Suivant" onClick={nextTrack} disabled={p.index + 1 >= p.queue.length} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-35">
                  <SkipForward className="w-5 h-5 fill-white" />
                </button>
                <button aria-label="À suivre" onClick={() => setShowQueue(true)} className="w-11 h-11 rounded-full hidden sm:flex items-center justify-center flex-shrink-0">
                  <ListMusic className="w-5 h-5" />
                </button>
                <button aria-label="Fermer le lecteur" onClick={closePlayer} className="w-11 h-11 rounded-full hidden lg:flex items-center justify-center flex-shrink-0 text-purple-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {!p.ended && (
              <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/10">
                <div className="h-full bg-gradient-to-r from-purple-400 to-pink-400" style={{ width: `${pct}%` }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{showQueue && visible && <QueueSheet onClose={() => setShowQueue(false)} />}</AnimatePresence>
    </>
  );
}

/** « À suivre » : la file à partir du son en cours (toucher, retirer, déplacer). */
function QueueSheet({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  useBackHandler(true, onClose);
  const [auto, setAuto] = useState(getAutoplay());
  const rest = p.queue.map((t, i) => ({ t, i })).filter(({ i }) => i > p.index);
  const cur = current();
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween()} onClick={onClose}>
      <motion.div role="dialog" aria-label="À suivre" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={tween()}
        className="w-full max-w-lg max-h-[75dvh] flex flex-col rounded-t-3xl bg-[#1D0F3D] border-t border-purple-500/30 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <p className="flex-1 font-bold">À suivre{p.source && p.source.kind !== 'single' ? <span className="font-normal text-purple-200"> · {p.source.label}</span> : null}</p>
          <button aria-label="Fermer" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        {cur && (
          <div className="mx-3 mb-2 flex items-center gap-3 p-2 rounded-xl bg-purple-700/30">
            {cur.cover ? <img src={thumb(cur.cover, 96)} alt="" className="w-10 h-10 rounded-md object-cover" /> : <span className="w-10 h-10 rounded-md bg-violet-800" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{cur.title}</p><p className="text-xs text-purple-200 truncate">{cur.artist} · en cours</p></div>
          </div>
        )}
        <ol className="flex-1 overflow-y-auto px-3 pb-2">
          {rest.length === 0 && <li className="text-sm text-purple-200 text-center py-6">Rien après ce son.</li>}
          {rest.map(({ t, i }, k) => (
            <li key={`${t.id}-${i}`} className="flex items-center gap-2 py-1">
              <button onClick={() => playAtIndex(i)} className="flex-1 min-w-0 flex items-center gap-3 text-left min-h-[48px]">
                {t.cover ? <img src={thumb(t.cover, 96)} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" /> : <span className="w-10 h-10 rounded-md bg-violet-800 flex-shrink-0" />}
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{t.title}</span><span className="block text-xs text-purple-200 truncate">{t.artist}{t.added ? ' · ajouté' : ''}</span></span>
              </button>
              <button aria-label={`Monter ${t.title}`} disabled={k === 0} onClick={() => moveInQueue(i, i - 1)} className="w-9 h-11 flex items-center justify-center disabled:opacity-25"><ChevronUp className="w-5 h-5" /></button>
              <button aria-label={`Descendre ${t.title}`} disabled={k === rest.length - 1} onClick={() => moveInQueue(i, i + 1)} className="w-9 h-11 flex items-center justify-center disabled:opacity-25"><ChevronDown className="w-5 h-5" /></button>
              <button aria-label={`Retirer ${t.title}`} onClick={() => removeFromQueue(i)} className="w-9 h-11 flex items-center justify-center text-purple-200"><X className="w-4 h-4" /></button>
            </li>
          ))}
        </ol>
        <label className="flex items-center justify-between gap-3 px-4 py-3 border-t border-purple-500/20 text-sm">
          <span>Enchaîner les sons</span>
          <input type="checkbox" className="w-5 h-5 accent-fuchsia-500" checked={auto} onChange={(e) => { setAutoplay(e.target.checked); setAuto(e.target.checked); }} />
        </label>
      </motion.div>
    </motion.div>
  );
}
