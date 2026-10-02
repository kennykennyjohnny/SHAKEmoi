// Séries de Shakes (P22) et flamme de l'en-tête (P23). La flamme est une icône
// SVG violette aux couleurs de SHAKEmoi (pas l'emoji orange), grise tant que je
// n'ai pas publié de vrai Shake cette semaine.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBackHandler } from '../../lib/navigation';

export interface StreakInfo { current: number; best: number; this_week: boolean; week_ends_at: string }

const cache = new Map<string, { at: number; s: StreakInfo }>();
export async function fetchStreak(userId: string, force = false): Promise<StreakInfo | null> {
  const hit = cache.get(userId);
  if (!force && hit && Date.now() - hit.at < 60_000) return hit.s;
  const { data, error } = await supabase.rpc('get_streak', { p_user: userId });
  if (error || !data) return null;
  const s = { current: Number(data.current) || 0, best: Number(data.best) || 0, this_week: !!data.this_week, week_ends_at: data.week_ends_at };
  cache.set(userId, { at: Date.now(), s });
  return s;
}

/** Q5 : série déjà reçue avec l'en-tête du profil (pas de 2e requête). */
export function primeStreak(userId: string, s: Omit<StreakInfo, 'week_ends_at'> & { week_ends_at?: string } | null | undefined) {
  if (!s) return;
  cache.set(userId, { at: Date.now(), s: { current: Number(s.current) || 0, best: Number(s.best) || 0, this_week: !!s.this_week, week_ends_at: s.week_ends_at || '' } });
}

export function useStreak(userId?: string | null) {
  const [s, setS] = useState<StreakInfo | null>(() => (userId && cache.get(userId)?.s) || null);
  useEffect(() => {
    if (!userId) return;
    let off = false;
    const load = (force = false) => fetchStreak(userId, force).then((v) => { if (!off) setS(v); });
    load();
    // Un nouveau Shake publié : la flamme se rallume tout de suite.
    const onPosted = () => load(true);
    window.addEventListener('shakemoi:posted', onPosted);
    return () => { off = true; window.removeEventListener('shakemoi:posted', onPosted); };
  }, [userId]);
  return s;
}

/** Flamme SHAKEmoi : violette (dégradé) ou grise. */
export function FlameIcon({ active = true, className = 'w-4 h-4' }: { active?: boolean; className?: string }) {
  const id = active ? 'flame-on' : 'flame-off';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={active ? '#7B2CBF' : '#8B7FA8'} />
          <stop offset="1" stopColor={active ? '#E91E80' : '#CFC3E8'} />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12.6 1.8c.4 2.6-.6 4.4-2 6-1.5 1.7-3.6 3.4-3.6 6.7A5.9 5.9 0 0 0 13 20.4c3.3 0 6-2.5 6-6.2 0-2.3-1-4-2.2-5.4-.2 1.4-.9 2.5-2 3 .5-3.6-.4-7.4-2.2-10Z" />
      <path fill={active ? '#C77DFF' : '#CFC3E8'} opacity={active ? 0.9 : 0.5} d="M12.3 12.6c.2 1.3-.4 2.1-1 2.8-.6.6-1.2 1.3-1.2 2.4a2.6 2.6 0 0 0 2.7 2.6c1.6 0 2.7-1.2 2.7-2.8 0-1.6-1-2.6-1.8-3.1 0 .7-.3 1.2-.8 1.5.1-1.4-.1-2.6-.6-3.4Z" />
    </svg>
  );
}

/** Badge du profil (le mien et celui des autres) : rien si la série est à 0. */
export function StreakBadge({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const s = useStreak(userId);
  const [open, setOpen] = useState(false);
  if (!s || s.current <= 0) return null;
  return (
    <span className="relative inline-flex">
      {/* Q12 : pastille opaque (lisible même sur une pochette claire), chiffre
          blanc, gras, 13 px minimum : contraste > 12:1. */}
      <button onClick={() => setOpen(!open)} aria-label={`Série de ${s.current} semaines`}
        className={`inline-flex items-center gap-1 rounded-full bg-[#12091F] border border-purple-400/40 shadow-sm shadow-black/40 ${compact ? 'px-2 py-0.5 text-[13px]' : 'px-2.5 py-1 text-sm'} font-extrabold leading-none tabular-nums text-white`}>
        <FlameIcon active={s.this_week} className={compact ? 'w-4 h-4' : 'w-[18px] h-[18px]'} /> {s.current}
      </button>
      {open && (
        <span className="absolute z-30 top-full mt-1.5 left-1/2 -translate-x-1/2 w-56 rounded-xl bg-[#12091F] border border-purple-400/50 px-3 py-2.5 text-center shadow-xl shadow-black/50" onClick={() => setOpen(false)}>
          <span className="block text-sm font-bold text-white">{s.current} semaine{s.current > 1 ? 's' : ''} de Shake d'affilée</span>
          <span className="block text-xs font-medium text-purple-100 mt-0.5">Meilleure série : {s.best} semaine{s.best > 1 ? 's' : ''}</span>
        </span>
      )}
    </span>
  );
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'quelques minutes';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} j ${h % 24} h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 1 ? `${h} h ${m} min` : `${m} min`;
}

/** Lundi (heure de Paris) : la série est en jeu ce soir. */
export function isStreakAtRisk(s: StreakInfo | null): boolean {
  if (!s || s.this_week || s.current < 1) return false;
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }).format(new Date());
  return day === 'lundi';
}

/** P23 : flamme de l'en-tête, grise / violette, qui clignote doucement le lundi si la série est en jeu. */
export function HeaderFlame({ userId, onOpen }: { userId: string; onOpen: () => void }) {
  const s = useStreak(userId);
  const risk = isStreakAtRisk(s);
  return (
    <button onClick={onOpen} aria-label={s ? `Ma série : ${s.current} semaine${s.current > 1 ? 's' : ''}` : 'Ma série'}
      className={`relative flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-violet-950/70 border border-purple-500/30 hover:bg-violet-900/40 ${risk ? 'animate-pulse' : ''}`}>
      <FlameIcon active={!!s?.this_week} className="w-5 h-5" />
      {/* Q12 : chiffre blanc et gras, même quand la flamme est grise. */}
      <span className="text-[13px] font-extrabold leading-none tabular-nums text-white">{s?.current ?? 0}</span>
      {risk && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-500" />}
    </button>
  );
}

/** Petite fenêtre de la flamme : série, temps restant, « Publier mon Shake ». */
export function StreakSheet({ userId, onClose, onPublish }: { userId: string; onClose: () => void; onPublish: () => void }) {
  useBackHandler(true, onClose);
  const [s, setS] = useState<StreakInfo | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { fetchStreak(userId, true).then(setS); const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, [userId]);
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[65] bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center pointer-events-none">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="pointer-events-auto w-full sm:max-w-sm bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center relative" role="dialog" aria-label="Ma série">
          <button aria-label="Fermer" onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
          {!s ? <div className="h-40" /> : (
            <>
              <FlameIcon active={s.this_week} className="w-16 h-16 mx-auto" />
              <p className="text-3xl font-black mt-2">{s.current}</p>
              <p className="text-sm text-purple-100">{s.current > 0 ? `semaine${s.current > 1 ? 's' : ''} de Shake d'affilée` : 'Pas encore de série'}</p>
              {s.best > 0 && <p className="text-[11px] text-purple-300/85 mt-1">Meilleure série : {s.best} semaine{s.best > 1 ? 's' : ''}</p>}
              <div className="mt-4 rounded-xl bg-violet-950/40 border border-purple-500/20 px-3 py-2.5 text-sm">
                {s.this_week
                  ? <>C'est bon pour cette semaine ✨ Prochaine remise à zéro dans <b>{timeLeft(s.week_ends_at)}</b>.</>
                  : <>Il te reste <b>{timeLeft(s.week_ends_at)}</b> pour publier un vrai Shake{ s.current > 0 ? ' et garder ta série' : ' et lancer ta série'}.</>}
              </div>
              <p className="text-[11px] text-purple-300/80 mt-2">Les Shakes éphémères et les reshakes ne comptent pas.</p>
              {!s.this_week && (
                <button onClick={() => { onClose(); onPublish(); }} className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold">
                  Publier mon Shake
                </button>
              )}
            </>
          )}
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
