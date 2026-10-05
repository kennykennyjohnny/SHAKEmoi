import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, ChevronLeft, Heart, MessageCircle, Music, Check, Search, ListMusic, Hourglass, Users, Sparkles, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PLATFORM_LABELS, STREAMING_APPS, type PlatformKey } from '../../lib/platforms';
import { PlatformLogo } from './PlatformLogo';
import { SongCover } from './SongCover';
import { FlameIcon } from './Streak';
import { tween } from '../../lib/motion';
import { supabase } from '../../lib/supabase';
import { getPreviewState, onPreviewChange, stopPreview } from '../../lib/preview';
import { thumb } from '../../lib/media';

// SHAKEMOI - Tuto (Q14, remplace O2) : montrer l'appli EN VRAI, en moins d'une
// minute. Chaque écran est un vrai bout d'interface animé (vrais morceaux,
// vrais extraits M1 quand on touche la pochette), et à 3 écrans on fait le
// geste soi-même (toucher la pochette, double-tap, publier) : c'est validé
// d'un « Bien joué », mais « Suivant » reste toujours là. Puis la
// configuration : l'appli d'écoute (O1) ; ensuite l'appli enchaîne sur
// « Choisis 3 artistes » (Q9) puis le fil (« Suis 3 personnes » retiré le 03/10), pour arriver sur
// un fil déjà rempli. Passer, barre de progression, glisser, flèches du
// clavier, rejouable depuis les paramètres (replay : choix pré-rempli).

interface OnboardingDialogProps {
  initialService?: PlatformKey | null;
  replay?: boolean;
  onComplete: (service: PlatformKey) => void;
  /** Rejeu : fermer sans rien changer. */
  onClose?: () => void;
}

interface DemoTrack { title: string; artist: string; cover: string | null; preview: string | null }

// Données d'exemple embarquées (rien à charger) ; remplacées par de vrais
// titres du moment (pochettes + extraits) s'ils arrivent vite.
const FALLBACK: DemoTrack[] = [
  { title: 'Meuda', artist: 'Tiakola', cover: null, preview: null },
  { title: 'Djadja', artist: 'Aya Nakamura', cover: null, preview: null },
  { title: 'Calm Down', artist: 'Rema', cover: null, preview: null },
  { title: 'Blinding Lights', artist: 'The Weeknd', cover: null, preview: null },
];
const GRADIENTS = ['from-fuchsia-500 to-purple-700', 'from-amber-400 to-pink-600', 'from-cyan-400 to-violet-600', 'from-rose-500 to-orange-400'];

function Cover({ t, i, className = '', rounded = 'rounded-2xl' }: { t: DemoTrack; i: number; className?: string; rounded?: string }) {
  return t.cover
    ? <img src={thumb(t.cover, 300) || t.cover} alt="" className={`${className} ${rounded} object-cover`} />
    : <div className={`${className} ${rounded} bg-gradient-to-br ${GRADIENTS[i % 4]} flex items-center justify-center`}><Music className="w-1/3 h-1/3 text-white/80" /></div>;
}

const Hint = ({ children }: { children: ReactNode }) => (
  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    className="mt-4 text-sm font-semibold text-pink-200 flex items-center justify-center gap-1.5">{children}</motion.p>
);
const Done = () => (
  <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
    className="mt-4 text-sm font-bold text-emerald-300 flex items-center justify-center gap-1.5"><Check className="w-4 h-4" strokeWidth={3} /> Bien joué !</motion.p>
);

// ---------- 1. Partage le son du moment (recherche → pochette → publier) ----------
function DemoShare({ tracks, done, setDone }: { tracks: DemoTrack[]; done: boolean; setDone: () => void }) {
  const t = tracks[0];
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const word = t.artist;
    let i = 0;
    const id = window.setInterval(() => { i++; setTyped(word.slice(0, i)); if (i >= word.length) window.clearInterval(id); }, 90);
    return () => window.clearInterval(id);
  }, [t.artist]);
  const found = typed.length >= Math.min(4, t.artist.length);
  // Validé quand l'extrait joue vraiment.
  useEffect(() => onPreviewChange(() => { const s = getPreviewState(); if (s.key === 'tuto-share' && s.playing) setDone(); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="w-72">
      <div className="rounded-2xl bg-[#1D0F3D] border border-purple-500/30 p-3 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-violet-950/60 border border-purple-500/30">
          <Search className="w-4 h-4 text-purple-300" />
          <span className="text-sm text-white">{typed}<span className="inline-block w-0.5 h-4 bg-pink-300 align-middle animate-pulse ml-0.5" /></span>
        </div>
        <AnimatePresence>
          {found && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="flex flex-col items-center pt-3">
                <SongCover standalone songKey="tuto-share" title={t.title} artist={t.artist} cover={t.cover} previewUrl={t.preview}
                  className="w-40 h-40" rounded="rounded-2xl" iconSize="lg" />
                <p className="mt-2 font-bold text-white">{t.title}</p>
                <p className="text-xs text-purple-200">{t.artist}</p>
                <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                  className="mt-3 px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold">Publier mon Shake</motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {found && (done ? <Done /> : <Hint>👆 Touche la pochette : ça joue</Hint>)}
    </div>
  );
}

// ---------- 2. Réagis : double-tap pour liker, réponse en musique ----------
function DemoReact({ tracks, done, setDone }: { tracks: DemoTrack[]; done: boolean; setDone: () => void }) {
  const t = tracks[1];
  const [liked, setLiked] = useState(false);
  const [burst, setBurst] = useState(0);
  const last = useRef(0);
  const tap = () => {
    const now = Date.now();
    if (now - last.current < 320) { setLiked(true); setBurst((b) => b + 1); setDone(); navigator.vibrate?.(10); }
    last.current = now;
  };
  return (
    <div className="w-72">
      <div className="rounded-2xl bg-[#1D0F3D] border border-purple-500/30 overflow-hidden shadow-2xl shadow-black/40 text-left">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold">L</span>
          <span className="text-sm font-bold">Léa</span><span className="text-xs text-purple-300">· 2 min</span>
        </div>
        <button onClick={tap} className="relative block w-full" aria-label="Double-tape pour liker">
          <Cover t={t} i={1} className="w-full aspect-square" rounded="" />
          <AnimatePresence>
            {burst > 0 && (
              <motion.span key={burst} initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1.4, opacity: 0 }} transition={{ duration: 0.8 }}
                className="absolute inset-0 m-auto w-24 h-24 flex items-center justify-center">
                <Heart className="w-24 h-24 text-white fill-white drop-shadow-xl" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <div className="px-3 py-2.5 flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm"><Heart className={`w-5 h-5 ${liked ? 'text-pink-500 fill-pink-500' : 'text-purple-200'}`} /> {liked ? 13 : 12}</span>
          <span className="flex items-center gap-1 text-sm text-purple-200"><MessageCircle className="w-5 h-5" /> 4</span>
          <span className="flex items-center gap-1 text-xs text-pink-200 ml-auto"><Music className="w-4 h-4" /> répondre en musique</span>
        </div>
        <p className="px-3 pb-3 text-sm"><b>{t.title}</b> <span className="text-purple-200">— {t.artist}</span></p>
      </div>
      {done ? <Done /> : <Hint>👆👆 Double-tape la pochette</Hint>}
    </div>
  );
}

// ---------- 3. Shakes éphémères : 24 h, compte à rebours ----------
function DemoStory({ tracks }: { tracks: DemoTrack[] }) {
  const t = tracks[2];
  const [left, setLeft] = useState(23 * 3600 + 59 * 60 + 42);
  useEffect(() => { const id = window.setInterval(() => setLeft((s) => s - 1), 1000); return () => window.clearInterval(id); }, []);
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="relative w-52 aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
      <Cover t={t} i={2} className="absolute inset-0 w-full h-full blur-md scale-110" rounded="" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute top-2 inset-x-2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <motion.span className="block h-full bg-white" initial={{ width: i === 0 ? '100%' : '0%' }}
              animate={{ width: i <= 1 ? '100%' : '0%' }} transition={{ duration: i === 1 ? 5 : 0, repeat: i === 1 ? Infinity : 0, ease: 'linear' }} />
          </span>
        ))}
      </div>
      <div className="absolute top-5 inset-x-3 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 text-[11px] font-bold flex items-center justify-center">B</span>
        <span className="text-xs font-bold">Bapt</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-mono font-bold bg-black/40 rounded-full px-1.5 py-0.5"><Hourglass className="w-3 h-3" />{hh}:{mm}:{ss}</span>
      </div>
      <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <Cover t={t} i={2} className="w-32 h-32 shadow-xl" />
        <div className="mt-2 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur text-center">
          <p className="text-xs font-bold">{t.title}</p><p className="text-[10px] text-purple-100">{t.artist}</p>
        </div>
      </div>
      <p className="absolute bottom-3 inset-x-3 text-center text-[11px] text-white/85">Visible 24 h par tes abonnés</p>
    </div>
  );
}

// ---------- 4. Tes cercles : conversation + playlist ----------
function DemoCircle({ tracks }: { tracks: DemoTrack[] }) {
  const [playlist, setPlaylist] = useState(false);
  return (
    <div className="w-72 rounded-2xl bg-[#1D0F3D] border border-purple-500/30 overflow-hidden shadow-2xl shadow-black/40 text-left">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-500/20">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-4 h-4" /></span>
        <div className="flex-1"><p className="text-sm font-bold leading-tight">Les potes</p><p className="text-[11px] text-purple-200">4 membres</p></div>
        <button onClick={() => setPlaylist(!playlist)} aria-label="Playlist du cercle" className={`p-1.5 rounded-full ${playlist ? 'bg-pink-500/30' : ''}`}>
          {playlist ? <MessageCircle className="w-5 h-5" /> : <ListMusic className="w-5 h-5" />}
        </button>
      </div>
      <div className="h-64 relative overflow-hidden">
        <AnimatePresence initial={false}>
          {playlist ? (
            <motion.div key="pl" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={tween()} className="absolute inset-0 p-3 space-y-2 bg-[#1D0F3D]">
              <p className="text-xs font-bold text-pink-200 flex items-center gap-1"><ListMusic className="w-3.5 h-3.5" /> Playlist du cercle · Tout écouter</p>
              {tracks.slice(0, 4).map((t, i) => (
                <div key={i} className="flex items-center gap-2"><Cover t={t} i={i} className="w-9 h-9" rounded="rounded-md" />
                  <div className="min-w-0"><p className="text-xs font-semibold truncate">{t.title}</p><p className="text-[10px] text-purple-200 truncate">{t.artist}</p></div></div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ x: '-30%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-30%', opacity: 0 }} transition={tween()} className="absolute inset-0 p-3 space-y-2 flex flex-col justify-end">
              {[['Léa', 'ce son 🔥🔥', false], ['Toi', 'trop bien, je l’ajoute', true]].map(([who, txt, me], i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.5 }}
                  className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${me ? 'self-end bg-gradient-to-r from-purple-600 to-pink-600' : 'self-start bg-violet-900/70'}`}>
                  {!me && <span className="block text-[10px] text-pink-200 font-semibold">@{String(who).toLowerCase()}</span>}{txt}
                </motion.div>
              ))}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="self-start flex items-center gap-2 p-2 rounded-2xl bg-violet-900/70">
                <Cover t={tracks[3]} i={3} className="w-10 h-10" rounded="rounded-lg" />
                <div><p className="text-xs font-bold">{tracks[3].title}</p><p className="text-[10px] text-purple-200">{tracks[3].artist}</p></div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-[11px] text-pink-200 pb-2">Touche <ListMusic className="inline w-3 h-3" /> : tous les sons du cercle</p>
    </div>
  );
}

// ---------- 5. Ta flamme : une semaine, un Shake ----------
function DemoFlame({ done, setDone }: { done: boolean; setDone: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div animate={done ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.6 }} className="relative">
        {done && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 -m-6 rounded-full bg-fuchsia-600/40 blur-2xl" />}
        <FlameIcon active={done} className="relative w-36 h-36" />
      </motion.div>
      <p className="text-5xl font-black mt-1 tabular-nums">{done ? 4 : 3}</p>
      <p className="text-sm text-purple-100">{done ? 'semaines d’affilée 🔥' : 'semaines… publie avant mardi !'}</p>
      {!done ? (
        <button onClick={setDone} className="mt-5 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold animate-pulse">Publier mon Shake</button>
      ) : <Done />}
    </div>
  );
}

// ---------- 6. Découvre : compatibilité + Découvrir ----------
function DemoDiscover({ tracks }: { tracks: DemoTrack[] }) {
  const reasons = ['Parce que tu as shaké Tiakola', 'Aimé par Léa · 92 % compatibles', 'Dans ton style Afro'];
  return (
    <div className="w-72 space-y-3 text-left">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-3 bg-gradient-to-r from-pink-500/15 to-purple-500/15 border border-purple-400/30">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-sm font-bold">L</span>
          <div className="flex-1"><p className="text-sm font-bold">Léa</p><p className="text-[11px] text-purple-100">Vous aimez tous les deux le Rap et l’Afro</p></div>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }} className="text-2xl font-black text-pink-300">92 %</motion.span>
        </div>
      </motion.div>
      <div className="rounded-2xl bg-[#1D0F3D] border border-purple-500/30 p-3 space-y-2.5">
        <p className="text-xs font-bold flex items-center gap-1 text-pink-200"><Sparkles className="w-3.5 h-3.5" /> Découvrir · choisis pour toi</p>
        {tracks.slice(0, 3).map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.25 }} className="flex items-center gap-2">
            <Cover t={t} i={i} className="w-11 h-11" rounded="rounded-lg" />
            <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{t.title}</p><p className="text-[10px] text-pink-200 truncate">{reasons[i]}</p></div>
            <span className="px-2 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold">Shaker</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface Step { title: string; text: string; glow: string; interactive?: boolean; render: (p: { tracks: DemoTrack[]; done: boolean; setDone: () => void }) => ReactNode }
const STEPS: Step[] = [
  { title: 'Partage le son du moment', text: 'Cherche, touche, publie. C’est tout. 🎧', glow: 'bg-fuchsia-600/25', interactive: true, render: (p) => <DemoShare {...p} /> },
  { title: 'Réagis à la musique de tes potes', text: 'Un double-tap pour liker, ou réponds avec un son.', glow: 'bg-pink-600/25', interactive: true, render: (p) => <DemoReact {...p} /> },
  { title: 'Les Shakes éphémères', text: 'Ton son du jour, visible 24 h. ⏳', glow: 'bg-cyan-600/20', render: (p) => <DemoStory {...p} /> },
  { title: 'Tes cercles', text: 'Une conversation entre potes, et sa playlist.', glow: 'bg-violet-600/25', render: (p) => <DemoCircle {...p} /> },
  { title: 'Ta flamme', text: 'Un Shake par semaine, et elle s’allume. 🔥', glow: 'bg-purple-600/30', interactive: true, render: (p) => <DemoFlame {...p} /> },
  { title: 'Découvre', text: 'Tes affinités musicales, et des sons choisis pour toi.', glow: 'bg-pink-600/20', render: (p) => <DemoDiscover {...p} /> },
];

export function OnboardingDialog({ initialService, replay, onComplete, onClose }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [service, setService] = useState<PlatformKey | null>(initialService ?? null);
  const [done, setDoneState] = useState<Record<number, boolean>>({});
  const [tracks, setTracks] = useState<DemoTrack[]>(FALLBACK);
  const total = STEPS.length + 1;
  const isPicker = step === STEPS.length;
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Vrais titres du moment (une seule petite lecture), sinon les exemples embarqués.
  useEffect(() => {
    let off = false;
    supabase.from('catalog_tracks').select('title, artist, cover_url, preview_url, sources')
      .not('cover_url', 'is', null).order('deezer_rank', { ascending: false }).limit(60)
      .then(({ data }) => {
        if (off || !data?.length) return;
        const pick = (fam: string) => data.find((d: any) => Object.keys(d.sources || {}).includes(`chart:${fam}`));
        const chosen = ['Rap', 'Afro', 'Pop', 'R&B / Soul'].map(pick).filter(Boolean) as any[];
        const list = (chosen.length >= 4 ? chosen : data.slice(0, 4)).slice(0, 4);
        if (list.length === 4) setTracks(list.map((d: any) => ({ title: d.title, artist: d.artist, cover: d.cover_url, preview: d.preview_url })));
      }, () => {});
    return () => { off = true; stopPreview(); };
  }, []);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === step) return;
    stopPreview();
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  // Clavier (ordinateur) : flèches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finish = () => { if (service) onComplete(service); };
  const cur = STEPS[step];
  const stepDone = !!done[step];

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#1E1440] text-white flex flex-col overflow-hidden select-none"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(step + (dx < 0 ? 1 : -1));
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue sur SHAKEmoi"
    >
      {/* Halo de couleur qui change à chaque écran (dans son propre cadre). */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AnimatePresence>
          <motion.div
            key={`glow-${step}`}
            className={`absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] rounded-full blur-[110px] ${isPicker ? 'bg-purple-600/20' : cur.glow}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
          />
        </AnimatePresence>
      </div>

      {/* Barre de progression + Passer */}
      <div className="relative z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => go(i)} aria-label={`Écran ${i + 1} sur ${total}`} className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-400" initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }} transition={tween()} />
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mt-3 h-8">
          {step > 0 ? (
            <button onClick={() => go(step - 1)} className="p-1.5 -ml-1.5 text-white/70 hover:text-white" aria-label="Écran précédent">
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : <span />}
          {!isPicker && (
            <button onClick={() => go(STEPS.length)} className="text-sm font-semibold text-white/70 hover:text-white px-2 py-1">Passer</button>
          )}
          {isPicker && replay && onClose && (
            <button onClick={onClose} className="text-sm font-semibold text-white/70 hover:text-white px-2 py-1">Fermer</button>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        <AnimatePresence mode="wait" custom={dir}>
          {!isPicker ? (
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: dir * 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -60 }} transition={tween()}
              className="flex flex-col items-center text-center max-w-sm w-full">
              <h1 className="text-3xl font-black leading-tight mb-2 tracking-tight">{cur.title}</h1>
              <p className="text-base text-purple-100 leading-snug mb-5">{cur.text}</p>
              <div className="flex items-center justify-center min-h-[18rem]">
                {cur.render({ tracks, done: stepDone, setDone: () => setDoneState((d) => (d[step] ? d : { ...d, [step]: true })) })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="picker"
              initial={{ opacity: 0, x: dir * 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -60 }} transition={tween()}
              className="w-full max-w-md overflow-y-auto overscroll-contain py-2">
              <h2 className="text-3xl font-black text-center leading-tight mb-2 tracking-tight">Tu écoutes où ?</h2>
              <p className="text-center text-purple-100 mb-5">On ouvrira chaque son directement là-bas.</p>
              <div className="grid grid-cols-2 gap-3">
                {STREAMING_APPS.map((key, i) => {
                  const selected = service === key;
                  return (
                    <motion.button key={key} onClick={() => setService(key)}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...tween(), delay: 0.04 * i }}
                      aria-pressed={selected}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        i === STREAMING_APPS.length - 1 && STREAMING_APPS.length % 2 === 1 ? 'col-span-2' : ''
                      } ${selected ? 'border-fuchsia-400 bg-fuchsia-500/15 shadow-lg shadow-fuchsia-900/30' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}>
                      <PlatformLogo platform={key} size="lg" />
                      <span className="font-bold text-sm">{PLATFORM_LABELS[key]}</span>
                      {selected && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-fuchsia-500 flex items-center justify-center"><Check className="w-4 h-4" strokeWidth={3} /></span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bouton principal : « Suivant » toujours là, même sans avoir fait le geste. */}
      <div className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 max-w-md w-full mx-auto">
        {!isPicker ? (
          <button onClick={() => go(step + 1)}
            className={`w-full py-4 rounded-full font-bold text-lg active:scale-[0.99] transition flex items-center justify-center gap-2 ${cur.interactive && !stepDone ? 'bg-white/15 text-white' : 'bg-white text-[#1E1440] hover:bg-white/90'}`}>
            Suivant <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={finish} disabled={!service}
            className="w-full py-4 rounded-full font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-40 active:scale-[0.99] transition flex items-center justify-center gap-2">
            {service ? (replay ? 'C’est bon' : <>C’est parti <Send className="w-5 h-5" /></>) : 'Choisis ton appli'}
          </button>
        )}
        {isPicker && <p className="text-center text-xs text-white/70 mt-3">Modifiable à tout moment dans les paramètres.</p>}
      </div>
    </div>
  );
}
