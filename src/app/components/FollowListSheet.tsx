// Listes de personnes d'un profil (P3 / P4) : abonnés, abonnements, abonnés en
// commun. Une seule feuille partout (mon profil, profil des autres). Chaque
// ligne : avatar, nom, @, badge « Vous suit », bouton Suivre / Suivi ; les gens
// que je suis en premier ; recherche ; chargement au fil du défilement.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Search, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { getFollowList, getMutualFollowers, FOLLOW_PAGE, followUser, unfollowUser, followErrorMessage, removeFollower } from '../../lib/database';
import { defaultAvatar, avatarThumb } from '../../lib/media';
import { useBackHandler } from '../../lib/navigation';
import { openProfile } from '../../lib/appNav';
import { profileProps } from '../../lib/profileCache';

export type FollowListKind = 'followers' | 'following' | 'mutual';

interface Props {
  userId: string;
  username?: string;
  kind: FollowListKind;
  myId?: string | null;
  /** C'est mon profil : « Retirer » un abonné possible. */
  isOwn?: boolean;
  onClose: () => void;
  /** Le nombre a changé (suivi / retiré) : le profil met à jour ses compteurs. */
  onCountsChanged?: () => void;
}

const TITLES: Record<FollowListKind, string> = { followers: 'Abonnés', following: 'Abonnements', mutual: 'Abonnés en commun' };

export function FollowListSheet({ userId, username, kind, myId, isOwn = false, onClose, onCountsChanged }: Props) {
  useBackHandler(true, onClose);
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = async (reset: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const offset = reset ? 0 : itemsRef.current.length;
      let page: any[];
      if (kind === 'mutual') {
        page = (await getMutualFollowers(userId, FOLLOW_PAGE, offset)).users.map((u: any) => ({ ...u, i_follow: true }));
        const q = query.trim().toLowerCase();
        if (q) page = page.filter((u: any) => u.username?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
      } else {
        page = await getFollowList(userId, kind, query, offset);
      }
      if (id !== reqId.current) return; // une frappe plus récente a pris le relais
      setItems(prev => (reset ? page : [...prev, ...page.filter((p: any) => !prev.some((x: any) => x.id === p.id))]));
      setDone(page.length < FOLLOW_PAGE);
    } catch {
      if (id === reqId.current) setError(true);
    }
    if (id === reqId.current) setLoading(false);
  };

  // Recherche : petite pause pendant la frappe, puis on repart de zéro.
  useEffect(() => {
    const t = setTimeout(() => load(true), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !loading && !done && !error && items.length) load(false); }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFollow = async (u: any) => {
    if (busyId) return;
    setBusyId(u.id);
    const next = !u.i_follow;
    setItems(prev => prev.map(x => (x.id === u.id ? { ...x, i_follow: next } : x)));
    const r = next ? await followUser(u.id) : await unfollowUser(u.id);
    if (!r.success) {
      setItems(prev => prev.map(x => (x.id === u.id ? { ...x, i_follow: !next } : x)));
      alert(followErrorMessage(r.error));
    } else onCountsChanged?.();
    setBusyId(null);
  };

  const remove = async (u: any) => {
    if (!confirm(`Retirer @${u.username} de tes abonnés ?`)) return;
    try {
      await removeFollower(u.id);
      setItems(prev => prev.filter(x => x.id !== u.id));
      onCountsChanged?.();
    } catch {
      alert('Impossible de retirer cet abonné. Réessaie.');
    }
  };

  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.2 }}
          className="pointer-events-auto w-full sm:max-w-md h-[85dvh] sm:h-[75dvh] bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col overflow-hidden"
          role="dialog" aria-label={TITLES[kind]}
        >
          <div className="px-4 pt-3 pb-2 border-b border-purple-800/30 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white">{TITLES[kind]}</h3>
                {username && <p className="text-xs text-purple-300/85">@{username}</p>}
              </div>
              <button aria-label="Fermer" onClick={onClose} className="p-1.5 hover:bg-purple-900/40 rounded-full"><X className="w-5 h-5 text-purple-300/90" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher"
                className="w-full pl-9 pr-3 py-2 bg-violet-950/40 border border-purple-500/25 rounded-xl text-base sm:text-sm text-white placeholder-purple-300/70 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-2">
            {items.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-900/25">
                <button {...profileProps(u)} onClick={() => openProfile(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <img loading="lazy" src={avatarThumb(u.profile_album_cover_url, 128) || defaultAvatar(u.username)} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{u.display_name || u.username}</p>
                    <p className="text-xs text-purple-300/85 truncate flex items-center gap-1.5">
                      @{u.username}
                      {u.follows_me && u.id !== myId && <span className="px-1.5 py-0.5 rounded-md bg-purple-800/50 text-[10px] text-purple-100">Vous suit</span>}
                    </p>
                  </div>
                </button>
                {u.id !== myId && (
                  isOwn && kind === 'followers' ? (
                    <div className="flex gap-1.5">
                      {!u.i_follow && (
                        <button onClick={() => toggleFollow(u)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-semibold">Suivre</button>
                      )}
                      <button onClick={() => remove(u)} className="px-3 py-1.5 rounded-lg bg-purple-950/60 border border-purple-700/40 text-xs font-semibold text-purple-100">Retirer</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleFollow(u)}
                      disabled={busyId === u.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-60 ${u.i_follow ? 'bg-purple-950/60 border border-purple-700/40 text-purple-100' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'}`}
                    >
                      {u.i_follow ? <><UserCheck className="w-3.5 h-3.5" /> Suivi</> : <><UserPlus className="w-3.5 h-3.5" /> Suivre</>}
                    </button>
                  )
                )}
              </div>
            ))}
            {loading && <div className="flex justify-center py-5"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>}
            {error && (
              <div className="text-center py-6">
                <p className="text-sm text-purple-200/80">Impossible de charger la liste.</p>
                <button onClick={() => load(items.length === 0)} className="mt-2 px-4 py-1.5 rounded-full bg-purple-900/50 text-sm">Réessayer</button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="text-center text-sm text-purple-300/85 py-10">{query ? 'Personne ne correspond.' : 'Personne pour l’instant.'}</p>
            )}
            {!loading && !error && !done && items.length > 0 && (
              <button onClick={() => load(false)} className="w-full mt-1 py-2 rounded-xl text-sm text-purple-200/80 hover:bg-purple-900/30">Voir plus</button>
            )}
            <div ref={sentinel} className="h-px" />
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

/** P3 : « Suivi par Léa, Bapt et 4 autres » avec mini-avatars ; un toucher ouvre la liste. */
export function MutualFollowersLine({ userId, onOpen, initial }: { userId: string; onOpen: () => void; initial?: { users: any[]; total: number } | null }) {
  const [data, setData] = useState<{ users: any[]; total: number } | null>(initial ?? null);
  useEffect(() => {
    // Q5 : déjà reçu avec l'en-tête du profil → pas de requête en plus.
    if (initial !== undefined) { setData(initial); return; }
    let off = false;
    getMutualFollowers(userId, 3).then((d) => { if (!off) setData(d); }).catch(() => {});
    return () => { off = true; };
  }, [userId, initial]);
  if (!data || data.total === 0) return null;
  const names = data.users.slice(0, 2).map((u) => u.display_name || u.username);
  const others = data.total - names.length;
  return (
    <button onClick={onOpen} className="mt-3 flex items-center gap-2 text-left w-full">
      <div className="flex -space-x-2 flex-shrink-0">
        {data.users.slice(0, 3).map((u) => (
          <img key={u.id} src={avatarThumb(u.profile_album_cover_url, 64) || defaultAvatar(u.username)} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-[#1E1440]" />
        ))}
      </div>
      <p className="text-xs text-purple-200/80 leading-snug">
        Suivi par <span className="font-semibold text-white">{names.join(', ')}</span>
        {others > 0 && <> et <span className="font-semibold text-white">{others} autre{others > 1 ? 's' : ''}</span></>}
      </p>
    </button>
  );
}
