import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Pin, Loader2, Archive, Music2 } from 'lucide-react';
import { getMyStoryArchive, setStoryPinned } from '../../lib/database';
import { useBackHandler } from '../../lib/navigation';
import { StoryViewerDialog } from './StoryViewerDialog';

// SHAKEMOI - Archives de ses stories (expirées comprises) : on les revoit et
// on épingle celles qu'on veut garder « À la une » sur son profil.

interface Props {
  currentUser: any;
  onClose: () => void;
  /** Appelé quand une épingle change, pour rafraîchir le profil. */
  onChanged?: () => void;
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function StoryArchiveDialog({ currentUser, onClose, onChanged }: Props) {
  const [stories, setStories] = useState<any[] | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

  useBackHandler(!viewing, onClose);

  const load = () => getMyStoryArchive().then(setStories);
  useEffect(() => { load(); }, []);

  const togglePin = async (story: any) => {
    const next = !story.is_pinned;
    setStories(list => list?.map(s => (s.id === story.id ? { ...s, is_pinned: next } : s)) ?? null);
    const ok = await setStoryPinned(story.id, next);
    if (!ok) setStories(list => list?.map(s => (s.id === story.id ? { ...s, is_pinned: !next } : s)) ?? null);
    else onChanged?.();
  };

  // Le lecteur les passe dans l'ordre chronologique.
  const chronological = (stories ?? []).slice().reverse();

  // Groupées par mois, les plus récentes en haut.
  const groups: { label: string; items: any[] }[] = [];
  for (const s of stories ?? []) {
    const label = monthLabel(s.created_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-lg h-[90dvh] sm:h-[80dvh] flex flex-col bg-[#1E1440] border border-purple-500/25 rounded-t-3xl sm:rounded-3xl text-white overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-500/15 flex-shrink-0">
            <Archive className="w-5 h-5 text-purple-300" />
            <div className="flex-1">
              <p className="font-bold leading-tight">Mes archives</p>
              <p className="text-[11px] text-purple-300/60">Épingle une story pour la garder « À la une » sur ton profil</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Fermer">
              <X className="w-5 h-5 text-purple-300/70" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {stories === null ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-purple-400 animate-spin" /></div>
            ) : stories.length === 0 ? (
              <p className="text-center text-sm text-purple-300/60 py-16 px-6">
                Pas encore de story. Publie ton premier shake éphémère : il sera gardé ici.
              </p>
            ) : (
              groups.map(g => (
                <section key={g.label} className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-purple-300/50 font-semibold mb-2 px-1 first-letter:uppercase">{g.label}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {g.items.map(s => {
                      const expired = s.expires_at && new Date(s.expires_at).getTime() < Date.now();
                      const visual = s.image_url || s.cover_url;
                      return (
                        <div key={s.id} className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#2A1852] group">
                          <button onClick={() => setViewing(s)} className="absolute inset-0 w-full h-full" aria-label="Voir la story">
                            {visual
                              ? <img src={visual} alt="" className={`w-full h-full object-cover ${expired ? 'opacity-80' : ''}`} />
                              : <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-700 to-pink-700"><Music2 className="w-8 h-8 text-white/70" /></span>}
                            <span className="absolute inset-x-0 bottom-0 p-1.5 pt-6 bg-gradient-to-t from-black/80 to-transparent text-left">
                              <span className="block text-[10px] font-bold truncate">{s.track_name || 'Story'}</span>
                              <span className="block text-[9px] text-white/60">
                                {new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                {!expired && ' · en cours'}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => togglePin(s)}
                            aria-label={s.is_pinned ? 'Retirer de « À la une »' : 'Épingler « À la une »'}
                            className={`absolute top-1.5 right-1.5 p-1.5 rounded-full backdrop-blur-sm transition-colors ${s.is_pinned ? 'bg-fuchsia-500 text-white' : 'bg-black/45 text-white/80 hover:bg-black/60'}`}
                          >
                            <Pin className={`w-3.5 h-3.5 ${s.is_pinned ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
      {/* Lecteur hors du panneau (z-60 > z-55) : ses clics ne ferment pas les archives. */}
      <StoryViewerDialog
        open={!!viewing}
        story={viewing}
        onClose={() => { setViewing(null); load(); onChanged?.(); }}
        currentUser={currentUser}
        stories={chronological}
        onNavigate={setViewing}
      />
    </>,
    document.body,
  );
}
