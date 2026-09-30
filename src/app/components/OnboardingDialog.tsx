import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, ChevronLeft, Heart, MessageCircle, Music, Play, Repeat2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PLATFORM_LABELS, STREAMING_APPS, type PlatformKey } from '../../lib/platforms';
import { PlatformLogo } from './PlatformLogo';

// SHAKEMOI - Tuto de bienvenue (O1/O2) : plein écran, une idée par écran,
// glisser pour avancer, barre de progression, « Passer ». Dernier écran :
// choix de l'appli d'écoute (enregistrée dans le profil, jamais redemandée).
// Rejouable depuis les paramètres (replay) : le choix actuel est pré-rempli.

interface OnboardingDialogProps {
  initialService?: PlatformKey | null;
  replay?: boolean;
  onComplete: (service: PlatformKey) => void;
  /** Rejeu : fermer sans rien changer. */
  onClose?: () => void;
}

interface Step {
  title: string;
  text: string;
  glow: string;
  visual: ReactNode;
}

// --- Visuels (CSS + icônes, pas d'image lourde) ---

function Vinyl() {
  return (
    <div className="relative w-56 h-56">
      <motion.div
        className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,#140c2b_0,#140c2b_3px,#1f1340_4px,#140c2b_5px)] shadow-2xl shadow-fuchsia-900/40 ring-1 ring-white/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-[34%] rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-[#140c2b]" />
        </div>
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_20deg,transparent_0,rgba(255,255,255,.12)_8%,transparent_16%,transparent_50%,rgba(255,255,255,.08)_58%,transparent_66%)]" />
      </motion.div>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute text-fuchsia-300"
          style={{ left: `${70 + i * 12}%`, top: `${10 + i * 22}%` }}
          animate={{ y: [0, -14, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.5 }}
        >
          <Music className="w-6 h-6" />
        </motion.div>
      ))}
    </div>
  );
}

function PlayCover() {
  return (
    <div className="relative">
      <div className="w-52 h-52 rounded-3xl bg-gradient-to-br from-pink-500 via-fuchsia-600 to-indigo-700 shadow-2xl shadow-pink-900/40 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.35),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-1 h-10">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <motion.div
              key={i}
              className="flex-1 rounded-sm bg-white/80"
              animate={{ height: ['20%', '100%', '35%', '80%', '20%'] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      </div>
      <motion.div
        className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white text-purple-700 flex items-center justify-center shadow-xl"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <Play className="w-7 h-7 fill-current ml-1" />
      </motion.div>
    </div>
  );
}

function Reactions() {
  const chips = [
    { icon: <Heart className="w-5 h-5 fill-current" />, cls: 'bg-pink-500', x: -70, y: -60, d: 0 },
    { icon: <MessageCircle className="w-5 h-5" />, cls: 'bg-fuchsia-500', x: 75, y: -30, d: 0.3 },
    { icon: <Music className="w-5 h-5" />, cls: 'bg-violet-500', x: -60, y: 55, d: 0.6 },
    { icon: <Repeat2 className="w-5 h-5" />, cls: 'bg-purple-500', x: 70, y: 60, d: 0.9 },
  ];
  return (
    <div className="relative w-60 h-60 flex items-center justify-center">
      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-2xl shadow-violet-900/40" />
      {chips.map((c, i) => (
        <motion.div
          key={i}
          className={`absolute w-12 h-12 rounded-full ${c.cls} text-white flex items-center justify-center shadow-lg`}
          initial={{ x: 0, y: 0, scale: 0 }}
          animate={{ x: c.x, y: [c.y, c.y - 8, c.y], scale: 1 }}
          transition={{ scale: { delay: c.d, type: 'spring' }, x: { delay: c.d, type: 'spring' }, y: { duration: 2.2, repeat: Infinity, delay: c.d } }}
        >
          {c.icon}
        </motion.div>
      ))}
    </div>
  );
}

function Circles() {
  const colors = ['from-pink-500 to-rose-500', 'from-violet-500 to-purple-600', 'from-cyan-400 to-sky-600', 'from-amber-400 to-orange-500', 'from-fuchsia-500 to-pink-600'];
  return (
    <div className="relative w-60 h-60">
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-dashed border-fuchsia-400/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.div
            key={i}
            className={`absolute w-14 h-14 rounded-full bg-gradient-to-br ${c} ring-4 ring-[#1E1440] shadow-lg`}
            style={{ left: `calc(50% + ${Math.cos(a) * 88}px - 28px)`, top: `calc(50% + ${Math.sin(a) * 88}px - 28px)` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 + i * 0.1, type: 'spring' }}
          />
        );
      })}
      <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-black text-lg shadow-xl">
        TOP
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  { title: 'Shake ton son.', text: 'Un son par semaine. Celui qui te retourne.', glow: 'bg-fuchsia-600/25', visual: <Vinyl /> },
  { title: 'Un tap, ça joue.', text: 'Touche une pochette : l’extrait part. Un seul son à la fois.', glow: 'bg-pink-600/25', visual: <PlayCover /> },
  { title: 'Réagis en musique.', text: 'Like, commente, reshake… ou réponds avec un son.', glow: 'bg-violet-600/25', visual: <Reactions /> },
  { title: 'Ta bande, ton TOP.', text: 'Des cercles privés entre potes, et le TOP de la semaine.', glow: 'bg-cyan-600/20', visual: <Circles /> },
];

export function OnboardingDialog({ initialService, replay, onComplete, onClose }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [service, setService] = useState<PlatformKey | null>(initialService ?? null);
  const total = STEPS.length + 1;
  const isPicker = step === STEPS.length;
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === step) return;
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

  const finish = () => {
    if (service) onComplete(service);
  };

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
      {/* Halo de couleur qui change à chaque écran (dans son propre cadre :
          plus large que l'écran, il ne doit pas rendre la page défilable). */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <AnimatePresence>
          <motion.div
            key={`glow-${step}`}
            className={`absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] rounded-full blur-[110px] ${isPicker ? 'bg-purple-600/20' : STEPS[step].glow}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>
      </div>

      {/* Barre de progression + Passer */}
      <div className="relative z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Écran ${i + 1} sur ${total}`}
              className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-400"
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
              />
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mt-3 h-8">
          {step > 0 ? (
            <button onClick={() => go(step - 1)} className="p-1.5 -ml-1.5 text-white/60 hover:text-white" aria-label="Écran précédent">
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : <span />}
          {!isPicker && (
            <button onClick={() => go(STEPS.length)} className="text-sm font-semibold text-white/60 hover:text-white px-2 py-1">
              Passer
            </button>
          )}
          {isPicker && replay && onClose && (
            <button onClick={onClose} className="text-sm font-semibold text-white/60 hover:text-white px-2 py-1">
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        <AnimatePresence mode="wait" custom={dir}>
          {!isPicker ? (
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex flex-col items-center text-center max-w-sm w-full"
            >
              <div className="h-64 flex items-center justify-center mb-8">{STEPS[step].visual}</div>
              <h1 className="text-4xl font-black leading-tight mb-3 tracking-tight">{STEPS[step].title}</h1>
              <p className="text-lg text-purple-200/75 leading-snug">{STEPS[step].text}</p>
            </motion.div>
          ) : (
            <motion.div
              key="picker"
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="w-full max-w-md overflow-y-auto overscroll-contain py-2"
            >
              <h2 className="text-3xl font-black text-center leading-tight mb-2 tracking-tight">Tu écoutes où ?</h2>
              <p className="text-center text-purple-200/70 mb-5">On ouvrira chaque son directement là-bas.</p>
              <div className="grid grid-cols-2 gap-3">
                {STREAMING_APPS.map((key, i) => {
                  const selected = service === key;
                  return (
                    <motion.button
                      key={key}
                      onClick={() => setService(key)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      aria-pressed={selected}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                        i === STREAMING_APPS.length - 1 && STREAMING_APPS.length % 2 === 1 ? 'col-span-2' : ''
                      } ${selected ? 'border-fuchsia-400 bg-fuchsia-500/15 shadow-lg shadow-fuchsia-900/30' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}
                    >
                      <PlatformLogo platform={key} size="lg" />
                      <span className="font-bold text-sm">{PLATFORM_LABELS[key]}</span>
                      {selected && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-fuchsia-500 flex items-center justify-center">
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bouton principal */}
      <div className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 max-w-md w-full mx-auto">
        {!isPicker ? (
          <button
            onClick={() => go(step + 1)}
            className="w-full py-4 rounded-full font-bold text-lg bg-white text-[#1E1440] hover:bg-white/90 active:scale-[0.99] transition flex items-center justify-center gap-2"
          >
            Suivant <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!service}
            className="w-full py-4 rounded-full font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-40 active:scale-[0.99] transition"
          >
            {service ? (replay ? 'C’est bon' : 'C’est parti') : 'Choisis ton appli'}
          </button>
        )}
        {isPicker && <p className="text-center text-xs text-white/40 mt-3">Modifiable à tout moment dans les paramètres.</p>}
      </div>
    </div>
  );
}
