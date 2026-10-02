// « Personnes que tu pourrais connaître » (P18) et « Mêmes goûts que toi » (P25),
// dans UN seul carrousel discret (bascule entre les deux) : fil, recherche,
// aperçu de profil après un abonnement (« Suis aussi… »).
import { useEffect, useState } from 'react';
import { X, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { getSuggestions, dismissSuggestion, suggestionReason, type SuggestionMode } from '../../lib/social';
import { followUser, followErrorMessage } from '../../lib/database';
import { avatarThumb, defaultAvatar } from '../../lib/media';
import { openProfile } from '../../lib/appNav';
import { FlameIcon } from './Streak';

interface Props {
  title?: string;
  /** Personnes à ne pas proposer (ex. celle qu'on vient de suivre). */
  exclude?: string[];
  compact?: boolean;
  className?: string;
}

export function SuggestionsCarousel({ title, exclude = [], compact = false, className = '' }: Props) {
  const [mode, setMode] = useState<SuggestionMode>('mixed');
  const [items, setItems] = useState<any[] | null>(null);
  const [tasteCount, setTasteCount] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setItems(null);
    (async () => {
      let list = await getSuggestions(mode, 12).catch(() => []);
      // Nouvel inscrit sans réseau : les comptes populaires.
      if (mode === 'mixed' && list.length === 0) list = await getSuggestions('popular', 12).catch(() => []);
      if (!off) setItems(list.filter((s) => !exclude.includes(s.id)));
    })();
    return () => { off = true; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Y a-t-il des « mêmes goûts » à proposer ? (sinon pas de bascule)
  useEffect(() => { getSuggestions('taste', 12).then((l) => setTasteCount(l.length)).catch(() => {}); }, []);

  const follow = async (s: any) => {
    setBusy(s.id);
    const r = await followUser(s.id);
    setBusy(null);
    if (!r.success) { alert(followErrorMessage(r.error)); return; }
    setFollowed((f) => new Set([...f, s.id]));
  };
  const dismiss = (s: any) => {
    setItems((l) => (l || []).filter((x) => x.id !== s.id));
    dismissSuggestion(s.id).catch(() => {});
  };

  if (items && items.length === 0 && tasteCount === 0) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className="text-sm font-bold flex-1 truncate">{title || (mode === 'taste' ? 'Mêmes goûts que toi' : 'Personnes que tu pourrais connaître')}</p>
        {tasteCount > 0 && (
          <div className="flex bg-violet-950/40 rounded-full p-0.5 border border-purple-500/20 text-[11px] font-semibold flex-shrink-0">
            <button onClick={() => setMode('mixed')} className={`px-2.5 py-1 rounded-full ${mode !== 'taste' ? 'bg-purple-600 text-white' : 'text-purple-300/70'}`}>Amis d'amis</button>
            <button onClick={() => setMode('taste')} className={`px-2.5 py-1 rounded-full ${mode === 'taste' ? 'bg-purple-600 text-white' : 'text-purple-300/70'}`}>Mêmes goûts</button>
          </div>
        )}
      </div>
      {items === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-purple-300/60 px-1 py-3">Personne pour l'instant. Reviens après avoir partagé quelques sons !</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {items.map((s) => {
            const isFollowed = followed.has(s.id);
            return (
              <div key={s.id} className={`relative flex-shrink-0 ${compact ? 'w-32' : 'w-36'} rounded-2xl bg-violet-950/40 border border-purple-500/20 p-3 text-center`}>
                <button aria-label="Masquer cette suggestion" onClick={() => dismiss(s)} className="absolute top-1.5 right-1.5 p-1 rounded-full text-purple-300/50 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                <button onClick={() => openProfile(s.id)} className="block w-full">
                  <img src={avatarThumb(s.avatar, 128) || defaultAvatar(s.username)} alt="" className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} rounded-full object-cover mx-auto ring-2 ring-purple-500/40`} />
                  <p className="text-sm font-semibold truncate mt-2 flex items-center justify-center gap-1">
                    <span className="truncate">{s.display_name || s.username}</span>
                    {s.streak > 0 && <FlameIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                  </p>
                  <p className="text-[11px] text-purple-300/60 truncate">@{s.username}</p>
                  <p className="text-[10px] text-pink-200/90 mt-1 line-clamp-2 min-h-[1.6rem] leading-tight">{suggestionReason(s)}</p>
                </button>
                <button onClick={() => !isFollowed && follow(s)} disabled={busy === s.id}
                  className={`mt-2 w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 ${isFollowed ? 'bg-purple-900/60 text-purple-100' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'}`}>
                  {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isFollowed ? <><UserCheck className="w-3.5 h-3.5" /> Suivi</> : <><UserPlus className="w-3.5 h-3.5" /> Suivre</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
