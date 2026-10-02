// Fil d'un profil (P1) : onglets Shakes / Reshakes, grille de pochettes,
// chargement au fil du défilement. LE même composant pour mon profil et celui
// des autres (aperçu et page complète). Toucher une pochette ouvre le post en
// détail avec toutes les actions (P2) ; le retour ramène à la même position.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { Heart, Loader2, Music, Repeat2, RefreshCw, Pin, PinOff, X } from 'lucide-react';
import { getProfileGridPage, PROFILE_PAGE, deletePost, togglePinPost } from '../../lib/database';
import { thumb } from '../../lib/media';
import { fetchProfileFirstPage, peekProfileFirstPage } from '../../lib/profileCache';
import { PostDetailModal } from './PostDetailModal';

type Tab = 'shakes' | 'reshakes';
interface TabState { items: any[]; done: boolean; loading: boolean; error: boolean }
const EMPTY: TabState = { items: [], done: false, loading: false, error: false };

interface ProfileGridProps {
  userId: string;
  currentUser: any;
  isOwn?: boolean;
  /** Post supprimé depuis le détail (mon profil) : le compteur suit. */
  onDeleted?: (wasShake: boolean) => void;
  /** Change à chaque rechargement voulu (ex. retour sur l'onglet). */
  refreshKey?: number;
}

export function ProfileGrid({ userId, currentUser, isOwn = false, onDeleted, refreshKey = 0 }: ProfileGridProps) {
  const [tab, setTab] = useState<Tab>('shakes');
  const [state, setState] = useState<Record<Tab, TabState>>({ shakes: EMPTY, reshakes: EMPTY });
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const busy = useRef<Record<Tab, boolean>>({ shakes: false, reshakes: false });
  // Copie à jour de l'état, lue par le chargement (curseur = date du dernier post).
  const stateRef = useRef(state);
  stateRef.current = state;
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async (which: Tab, reset = false) => {
    if (busy.current[which]) return;
    busy.current[which] = true;
    setState(s => ({ ...s, [which]: { ...(reset ? EMPTY : s[which]), loading: true, error: false } }));
    try {
      // Curseur = date du dernier post NON épinglé (les épinglés sont en tête, Q11).
      const items = stateRef.current[which].items.filter((p: any) => !p.pinned_at);
      const before = reset ? null : items[items.length - 1]?.created_at || null;
      // 1re page des Shakes : partagée avec le préchargement (Q5).
      const page = which === 'shakes' && !before ? await fetchProfileFirstPage(userId, reset && refreshKey > 0) : await getProfileGridPage(userId, which, before);
      setState(s => {
        const prev = reset ? [] : s[which].items;
        const seen = new Set(prev.map((p: any) => p.id));
        return { ...s, [which]: { items: [...prev, ...page.filter((p: any) => !seen.has(p.id))], done: page.filter((p: any) => !p.pinned_at).length < PROFILE_PAGE, loading: false, error: false } };
      });
    } catch {
      setState(s => ({ ...s, [which]: { ...s[which], loading: false, error: true } }));
    }
    busy.current[which] = false;
  }, [userId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nouveau profil ou rechargement demandé : on repart de zéro. Si la 1re page
  // est déjà là (préchargée au toucher, Q5), elle s'affiche tout de suite.
  useEffect(() => {
    const cached = refreshKey === 0 ? peekProfileFirstPage(userId) : null;
    const first: TabState = cached ? { items: cached.data, done: cached.data.filter((p: any) => !p.pinned_at).length < PROFILE_PAGE, loading: false, error: false } : EMPTY;
    setState({ shakes: first, reshakes: EMPTY });
    stateRef.current = { shakes: first, reshakes: EMPTY };
    busy.current = { shakes: false, reshakes: false };
    if (!cached?.fresh) loadMore('shakes', true);
  }, [userId, refreshKey, loadMore]);

  useEffect(() => {
    const t = state[tab];
    if (t.items.length === 0 && !t.done && !t.loading && !t.error) loadMore(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement au fil du défilement : la suite arrive quand le bas approche.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const t = state[tab];
      if (entries[0].isIntersecting && !t.done && !t.loading && !t.error && t.items.length > 0) loadMore(tab);
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, state, loadMore]);

  // Q11 : épingler / désépingler (appui long sur une vignette de mon profil).
  const [pinMenu, setPinMenu] = useState<any | null>(null);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const press = useRef<{ t: number; moved: boolean; fired: boolean } | null>(null);
  const startPress = (p: any) => {
    if (!isOwn || p.is_reshake) return;
    const s = { t: window.setTimeout(() => { s.fired = true; navigator.vibrate?.(10); setPinMenu(p); }, 480), moved: false, fired: false };
    press.current = s;
  };
  const endPress = () => { if (press.current) window.clearTimeout(press.current.t); };
  const doPin = async (p: any) => {
    setPinMenu(null);
    const msg = await togglePinPost(p);
    if (msg) { setPinNotice(msg); window.setTimeout(() => setPinNotice(null), 2500); }
  };
  // Épinglé ou désépinglé (ici ou depuis le post) : la grille se remet dans l'ordre.
  useEffect(() => {
    const on = () => { fetchProfileFirstPage(userId, true).catch(() => {}); loadMore('shakes', true); };
    window.addEventListener('shakemoi:pins-changed', on);
    return () => window.removeEventListener('shakemoi:pins-changed', on);
  }, [userId, loadMore]);

  const current = state[tab];
  // Q2 : le post ouvert connaît la liste (ordre de la grille) pour passer au
  // suivant / précédent ; un reshake ouvre le post d'origine.
  const openId = (p: any) => (p.is_reshake ? p.original_post_id : p.id);
  const gridRef = useRef<HTMLDivElement>(null);
  const thumbEl = (id: string) => gridRef.current?.querySelector<HTMLElement>(`[data-thumb="${CSS.escape(id)}"]`) || null;
  const thumbRect = (id: string) => {
    const r = thumbEl(id)?.getBoundingClientRect();
    return r && r.bottom > 0 && r.top < window.innerHeight ? r : null;
  };

  const handleDelete = async (postId: string) => {
    const wasShake = state.shakes.items.some((p: any) => p.id === postId);
    const r = await deletePost(postId).then(() => true, () => false);
    if (!r) { alert('La suppression a échoué. Réessaie.'); return; }
    setState(s => ({
      shakes: { ...s.shakes, items: s.shakes.items.filter((p: any) => p.id !== postId) },
      reshakes: { ...s.reshakes, items: s.reshakes.items.filter((p: any) => p.id !== postId && p.original_post_id !== postId) },
    }));
    onDeleted?.(wasShake);
  };

  // Like / reshake faits dans le détail : la grille suit sans tout recharger.
  const handleUpdated = (postId: string, patch: { likes_count?: number; reshaked?: boolean }) => {
    setState(s => {
      const fix = (p: any) => {
        if (p.id === postId && patch.likes_count != null) return { ...p, likes_count: patch.likes_count };
        if (p.original_post?.id === postId && patch.likes_count != null) return { ...p, original_post: { ...p.original_post, likes_count: patch.likes_count } };
        return p;
      };
      let reshakes = s.reshakes.items.map(fix);
      // Mon reshake annulé depuis mon profil : il quitte l'onglet Reshakes.
      if (isOwn && patch.reshaked === false) reshakes = reshakes.filter((p: any) => p.original_post_id !== postId);
      return { shakes: { ...s.shakes, items: s.shakes.items.map(fix) }, reshakes: { ...s.reshakes, items: reshakes } };
    });
    if (isOwn && patch.reshaked === true) loadMore('reshakes', true);
  };

  return (
    <div>
      {/* Onglets, collés en haut pendant le défilement */}
      <div className="border-y border-purple-800/20 px-4 sticky top-0 bg-[#1E1440] z-20">
        <div className="flex gap-6">
          {(['shakes', 'reshakes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 border-b-2 font-semibold text-sm transition-colors flex items-center gap-1.5 ${
                tab === t ? (t === 'shakes' ? 'border-purple-500 text-purple-200' : 'border-fuchsia-500 text-fuchsia-300') : 'border-transparent text-purple-300/80 hover:text-purple-200'
              }`}
            >
              {t === 'reshakes' && <Repeat2 className="w-3.5 h-3.5" />}
              {t === 'shakes' ? (isOwn ? 'Mes shakes' : 'Shakes') : 'Reshakes'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {current.items.length > 0 && (
          <div ref={gridRef} className="grid grid-cols-3 gap-1.5">
            {current.items.map((p: any) => {
              const shown = p.is_reshake ? p.original_post : p;
              const cover = shown?.cover_url || shown?.image_url;
              return (
                <button
                  key={p.id}
                  data-thumb={openId(p)}
                  onClick={() => { if (press.current?.fired) { press.current = null; return; } setOpenPostId(openId(p)); }}
                  onPointerDown={() => startPress(p)}
                  onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
                  onContextMenu={(e) => { if (isOwn && !p.is_reshake) { e.preventDefault(); setPinMenu(p); } }}
                  aria-label={`${shown?.track_name || 'Shake'}${shown?.artist ? ` — ${shown.artist}` : ''}`}
                  className="relative aspect-square rounded-lg overflow-hidden bg-violet-950/40 active:scale-[0.97] transition-transform"
                >
                  {cover
                    ? <img loading="lazy" src={thumb(cover, 300)} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-purple-300/80" /></div>}
                  {/* Q11 : petite épingle violette sur les Shakes épinglés */}
                  {!p.is_reshake && p.pinned_at && (
                    <span className="absolute top-1 right-1 w-6 h-6 rounded-full bg-purple-600 shadow-md shadow-black/40 flex items-center justify-center" aria-label="Épinglé">
                      <Pin className="w-3.5 h-3.5 text-white fill-white" />
                    </span>
                  )}
                  {p.is_reshake && shown?.user?.username && (
                    <span className="absolute top-1 left-1 max-w-[85%] truncate bg-black/60 rounded-full px-1.5 py-0.5 text-[9px] text-fuchsia-300 font-medium">@{shown.user.username}</span>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-pink-400" />
                    <span className="text-[9px] text-white font-medium">{shown?.likes_count || 0}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {current.loading && (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
        )}
        {current.error && (
          <div className="text-center py-6">
            <p className="text-sm text-purple-200/80">Impossible de charger les shakes. Vérifie ta connexion.</p>
            <button onClick={() => loadMore(tab)} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-900/40 hover:bg-purple-900/60 rounded-full text-sm font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> Réessayer
            </button>
          </div>
        )}
        {!current.loading && !current.error && current.done && current.items.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#1D0F3D] rounded-full flex items-center justify-center border border-purple-800/20">
              {tab === 'shakes' ? <Music className="w-8 h-8 text-[#FFEFD5]" /> : <Repeat2 className="w-8 h-8 text-[#FFEFD5]" />}
            </div>
            <p className="text-purple-300/85">{tab === 'shakes' ? 'Aucun shake pour le moment' : 'Aucun reshake pour le moment'}</p>
          </div>
        )}
        {/* Secours si le défilement automatique ne s'est pas déclenché. */}
        {!current.loading && !current.error && !current.done && current.items.length > 0 && (
          <button onClick={() => loadMore(tab)} className="mt-3 w-full py-2.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 text-sm text-purple-200/80">
            Voir plus
          </button>
        )}
        <div ref={sentinel} className="h-px" />
      </div>

      {pinNotice && createPortal(
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--nav-h)+1rem)] lg:bottom-6 z-[90] px-4 py-2 rounded-full bg-[#2A1852] border border-purple-400/40 text-sm font-semibold text-white shadow-xl">{pinNotice}</div>,
        document.body)}
      {pinMenu && createPortal(
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setPinMenu(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm bg-[#1D0F3D] border-t sm:border border-purple-500/40 rounded-t-3xl sm:rounded-2xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 px-2 pb-3 border-b border-purple-500/20">
              <img src={thumb(pinMenu.cover_url || pinMenu.image_url, 96)} alt="" className="w-10 h-10 rounded-md object-cover" />
              <p className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{pinMenu.track_name}</p>
              <button aria-label="Fermer" onClick={() => setPinMenu(null)} className="p-1.5 text-purple-200"><X className="w-5 h-5" /></button>
            </div>
            <button onClick={() => doPin(pinMenu)} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-purple-900/40 text-white text-sm font-semibold">
              {pinMenu.pinned_at ? <><PinOff className="w-5 h-5" /> Désépingler</> : <><Pin className="w-5 h-5" /> Épingler en haut du profil</>}
            </button>
          </div>
        </div>,
        document.body)}
      {/* Portail : jamais coincé dans une fenêtre animée (aperçu de profil). */}
      {createPortal(<AnimatePresence>
        {openPostId && (
          <PostDetailModal
            postId={openPostId}
            currentUser={currentUser}
            list={current.items.map(openId)}
            onNeedMore={() => { if (!current.done && !current.loading) loadMore(tab); }}
            // La grille garde la vignette du post affiché à l'écran : on y revient au bon endroit.
            onIndexChange={(id) => thumbEl(id)?.scrollIntoView({ block: 'nearest' })}
            originRect={thumbRect}
            onClose={(lastId) => { if (lastId) thumbEl(lastId)?.scrollIntoView({ block: 'nearest' }); setOpenPostId(null); }}
            onDeletePost={isOwn ? handleDelete : undefined}
            onUpdated={handleUpdated}
          />
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}
