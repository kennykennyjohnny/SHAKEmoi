import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Send, Search, Loader2, Users, Plus, Copy, Check, X, Settings, LogOut, Camera, Trash2, BellOff, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getConversations, getUserFollowing, createCircle, getUserCirclesByActivity, getCircleMembers,
  searchUsers, addCircleMember, removeCircleMember, updateCirclePhoto, updateCircleName, deleteCircle,
} from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { useBackHandler } from '../../lib/navigation';
import { circleLink } from '../../lib/links';
import { MediaImg, defaultAvatar, avatarThumb } from '../../lib/media';
import { friendlyError } from '../../lib/errors';
import { formatListTime } from '../../lib/dates';
import { openProfile } from '../../lib/appNav';
import { ChatThread } from './ChatThread';
import { ImageCropDialog } from './ImageCropDialog';
import { circlePreviewText, dmPreviewText } from '../../lib/chat';
import { useSwipeTabs } from '../../lib/useSwipeTabs';

interface MessagesViewProps {
  currentUser: any;
  onOpenCircle?: (circleId: string | null) => void;
  onCircleCreated?: (circleId: string) => void;
  viewOptions?: any;
  /** Non-lus par onglet (P26). */
  inboxCounts?: { dms: number; circles: number };
}

const TAB_KEY = 'shakemoi_messages_tab';
const MSG_TABS = ['dms', 'circles'] as const;
type MsgTab = typeof MSG_TABS[number];

export function MessagesView({ currentUser, onOpenCircle, onCircleCreated, viewOptions, inboxCounts }: MessagesViewProps) {
  const { initialTab, openPartnerId = null, openPartner = null, openCircleId = null, nonce = 0, reset = 0 } = viewOptions || {};
  // Onglet gardé à l'actualisation et au retour (N2), sauf ouverture demandée.
  const [tab, setTabState] = useState<MsgTab>(() => {
    if (initialTab) return initialTab;
    try { return (sessionStorage.getItem(TAB_KEY) as MsgTab) || 'dms'; } catch { return 'dms'; }
  });
  const setTab = (t: MsgTab) => { setTabState(t); try { sessionStorage.setItem(TAB_KEY, t); } catch { /* pas grave */ } };
  // Ouverture depuis la colonne de gauche (ordinateur) ou une notif alors
  // qu'on est déjà dans Messages : on suit l'onglet demandé.
  useEffect(() => { if (initialTab) setTab(initialTab); }, [viewOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  // Une conversation ouverte PAR onglet (avant : un seul drapeau pour les deux,
  // d'où un écran incohérent en passant d'un privé à un cercle depuis la colonne).
  const [sub, setSub] = useState({ dms: false, circles: false });
  const inSubView = sub[tab];
  const setDmsSub = (v: boolean) => setSub((s) => (s.dms === v ? s : { ...s, dms: v }));
  const setCirclesSub = (v: boolean) => setSub((s) => (s.circles === v ? s : { ...s, circles: v }));
  // Un compteur par onglet : le + n'ouvre que l'écran de l'onglet affiché.
  const [fab, setFab] = useState({ dms: 0, circles: 0 });

  // P10 : glisser du doigt entre Messages et Cercles, les listes et l'indicateur
  // suivent le doigt. Seulement sur les listes, jamais dans une conversation.
  const swipe = useSwipeTabs(MSG_TABS, tab, setTab, !inSubView);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-hidden min-h-0 relative">
      {/* Onglets — masqués dans une conversation ou un cercle */}
      {!inSubView && (
        <div className="relative grid grid-cols-2 border-b border-purple-500/20 px-2 pt-2 flex-shrink-0">
          {MSG_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative py-2.5 text-sm font-semibold transition-colors ${tab === t ? 'text-white' : 'text-purple-300/50 hover:text-purple-200'}`}
            >
              {t === 'dms' ? 'Messages' : 'Cercles'}
              {(t === 'dms' ? inboxCounts?.dms : inboxCounts?.circles) ? (
                <span className="ml-1.5 inline-flex min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-[10px] font-bold items-center justify-center align-middle">
                  {t === 'dms' ? inboxCounts?.dms : inboxCounts?.circles}
                </span>
              ) : null}
            </button>
          ))}
          <span className="absolute bottom-0 left-2 right-2 h-0.5 pointer-events-none">
            <span className="block h-full" style={swipe.indicatorStyle}>
              <span className="block h-full mx-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            </span>
          </span>
        </div>
      )}

      <div ref={swipe.ref} className="flex-1 min-h-0 overflow-hidden" {...swipe.handlers}>
        <div className="flex h-full" style={swipe.trackStyle}>
          <div className="w-full flex-shrink-0 flex flex-col min-h-0 overflow-hidden" aria-hidden={tab !== 'dms'}>
            <DmsPanel currentUser={currentUser} onSubViewActive={setDmsSub} fabTrigger={fab.dms} openPartnerId={openPartnerId} openPartner={openPartner} openNonce={nonce} resetNonce={reset} />
          </div>
          <div className="w-full flex-shrink-0 flex flex-col min-h-0 overflow-hidden" aria-hidden={tab !== 'circles'}>
            <CirclesPanel currentUser={currentUser} onOpenCircle={onOpenCircle} onCircleCreated={onCircleCreated} onSubViewActive={setCirclesSub} fabTrigger={fab.circles} openCircleId={openCircleId} openNonce={nonce} resetNonce={reset} />
          </div>
        </div>
      </div>

      {/* + : nouvelle conversation ou nouveau cercle, selon l'onglet */}
      {!inSubView && (
        <button aria-label={tab === 'dms' ? 'Nouvelle conversation' : 'Nouveau cercle'}
          onClick={() => setFab(f => ({ ...f, [tab]: f[tab] + 1 }))}
          className="fixed bottom-[calc(var(--nav-h)+1rem)] right-5 lg:bottom-6 lg:right-[17rem] bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-xl shadow-purple-900/60 flex items-center justify-center active:scale-95 transition-transform hover:opacity-90 z-50"
          style={{ width: 52, height: 52 }}
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ==================== New conversation search ====================

function NewConvoSearch({ friends, onSelect, onClose }: { friends: any[]; onSelect: (f: any) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(friends); return; }
    const local = friends.filter(f =>
      f.username?.toLowerCase().includes(q.toLowerCase()) ||
      f.display_name?.toLowerCase().includes(q.toLowerCase())
    );
    setResults(local);
    // Also search all users after a short debounce
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const all = await searchUsers(q);
        // merge: local first, then non-duplicate remote results
        const ids = new Set(local.map((f: any) => f.id));
        setResults([...local, ...all.filter((u: any) => !ids.has(u.id))]);
      } catch {}
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, friends]);

  // init with friends list
  useEffect(() => { setResults(friends); }, [friends]);

  return (
    <div className="mb-4 bg-violet-950/20 rounded-xl border border-purple-500/25 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold">Nouvelle conversation</p>
        <button aria-label="Fermer" onClick={onClose}><X className="w-4 h-4 text-purple-300/60" /></button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full pl-9 pr-3 py-2 bg-violet-950/30 border border-purple-500/25 rounded-lg text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400 animate-spin" />}
      </div>
      {results.length > 0 ? (
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          {results.map((f: any) => (
            <button key={f.id} onClick={() => onSelect(f)} className="w-full flex items-center gap-2.5 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
              <img loading="lazy" src={avatarThumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">{f.display_name || f.username}</p>
                <p className="text-xs text-purple-300/60">@{f.username}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-purple-300/50 text-center py-3">{query ? 'Aucun résultat' : 'Aucun ami pour l\'instant'}</p>
      )}
    </div>
  );
}

// ==================== DMs ====================

function DmsPanel({ currentUser, onSubViewActive, fabTrigger, openPartnerId, openPartner, openNonce, resetNonce }: { currentUser: any; onSubViewActive?: (active: boolean) => void; fabTrigger?: number; openPartnerId?: string | null; openPartner?: any; openNonce?: number; resetNonce?: number }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ partner: any; unread: number } | null>(null);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    setListError(null);
    try { setConversations(await getConversations()); }
    catch (err) { if (!silent) setListError(friendlyError(err)); }
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, []);
  // Ouverture directe d'une conversation (notification, profil, colonne ordinateur, D1).
  // Clics rapides (colonne ordinateur, P13) : seule la DERNIÈRE demande compte,
  // une réponse plus lente ne peut plus ouvrir la mauvaise conversation.
  const openReq = useRef(0);
  useEffect(() => {
    if (!openPartnerId) return;
    const req = ++openReq.current;
    if (openPartner?.id === openPartnerId) { openConversation(openPartner); return; }
    supabase.from('users_profile').select('id, username, display_name, profile_album_cover_url')
      .eq('id', openPartnerId).maybeSingle()
      .then(({ data }) => { if (data && req === openReq.current) openConversation(data); });
  }, [openPartnerId, openNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // « Messages » dans le menu : retour à la liste.
  useEffect(() => { if (resetNonce && active) closeConversation(); }, [resetNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fabTrigger) return;
    setShowNewConvo(true);
    getUserFollowing(currentUser.id).then(setFriends).catch(() => {});
  }, [fabTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Liste en direct (C8) : un message reçu, lu, retiré ou une sourdine la remet à jour.
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel(`dm-list-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, () => loadConversations(true))
      .subscribe();
    const onRead = () => loadConversations(true);
    window.addEventListener('shakemoi:messages-read', onRead);
    return () => { supabase.removeChannel(channel); window.removeEventListener('shakemoi:messages-read', onRead); };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retour système depuis une conversation : on revient à la liste.
  useBackHandler(!!active, () => closeConversation());

  const openConversation = (partner: any) => {
    const entry = conversations.find((c) => c.partnerId === partner.id);
    setActive({ partner, unread: entry?.unreadCount || 0 });
    setShowNewConvo(false);
    onSubViewActive?.(true);
    // Ouvrir la conversation la marque lue (A3).
    setConversations((prev) => prev.map((c) => (c.partnerId === partner.id ? { ...c, unreadCount: 0 } : c)));
  };
  const closeConversation = () => {
    setActive(null);
    onSubViewActive?.(false);
    loadConversations(true);
  };

  if (active) {
    const p = active.partner;
    return (
      <ChatThread
        key={p.id}
        chat={{ kind: 'dm', id: p.id }}
        currentUser={currentUser}
        title={p.display_name || p.username}
        subtitle={`@${p.username}`}
        avatarUrl={p.profile_album_cover_url}
        avatarName={p.username}
        initialUnread={active.unread}
        onBack={closeConversation}
        onHeaderClick={() => openProfile(p.id)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[var(--nav-h)] lg:pb-4">
      {showNewConvo && <NewConvoSearch friends={friends} onSelect={openConversation} onClose={() => setShowNewConvo(false)} />}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : listError ? (
        <div className="text-center py-10">
          <p className="text-pink-300 text-sm mb-3">{listError}</p>
          <button onClick={() => loadConversations()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold">Réessayer</button>
        </div>
      ) : conversations.length > 0 ? (
        <div className="space-y-0.5">
          {conversations.map((c) => {
            const unread = (c.unreadCount > 0 || c.unreadLikes > 0) && !c.muted;
            return (
              <button key={c.partnerId} onClick={() => openConversation(c.partner)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-950/25 rounded-xl transition-colors">
                <div className="relative flex-shrink-0">
                  <img loading="lazy" src={avatarThumb(c.partner?.profile_album_cover_url) || defaultAvatar(c.partner?.username)} className="w-12 h-12 rounded-full object-cover ring-1 ring-purple-700/30" alt="" />
                  {unread && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-pink-500 border-2 border-[#1E1440] rounded-full text-[9px] font-bold flex items-center justify-center text-white">{c.unreadCount || '♥'}</span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className={`text-sm truncate flex items-center gap-1.5 ${unread ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>
                    <span className="truncate">{c.partner?.display_name || c.partner?.username}</span>
                    {c.muted && <BellOff className="w-3 h-3 text-purple-300/60 flex-shrink-0" />}
                  </p>
                  <p className={`text-xs truncate ${unread ? 'text-purple-200/80 font-medium' : 'text-purple-300/60'}`}>{c.unreadLikes > 0 && !c.unreadCount ? '❤️ a aimé ton message' : dmPreviewText(c.lastMessage, currentUser?.id)}</p>
                </div>
                <span className={`text-[10px] flex-shrink-0 ${unread ? 'text-pink-300 font-semibold' : 'text-purple-300/50'}`}>{formatListTime(c.lastMessage?.created_at)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Send className="w-10 h-10 text-purple-600 mx-auto mb-2" />
          <p className="text-purple-200/70 text-sm">Aucune conversation</p>
          <p className="text-purple-400/50 text-xs mt-1">Envoie un son à un ami !</p>
        </div>
      )}
    </div>
  );
}

// ==================== Cercles ====================

function CirclesPanel({ currentUser, onCircleCreated, onSubViewActive, fabTrigger, openCircleId, openNonce, resetNonce }: { currentUser: any; onOpenCircle?: (circleId: string | null) => void; onCircleCreated?: (circleId: string) => void; onSubViewActive?: (active: boolean) => void; fabTrigger?: number; openCircleId?: string | null; openNonce?: number; resetNonce?: number }) {
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Cercle renommé ou modifié ailleurs (P8) : la liste se met à jour.
    const onChanged = () => load(true);
    window.addEventListener('shakemoi:circles-changed', onChanged);
    // Nouveau message dans un de mes cercles : il remonte en haut, en direct (P13).
    const channel = supabase
      .channel(`circles-list-${currentUser?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_messages' }, () => load(true))
      .subscribe();
    return () => { window.removeEventListener('shakemoi:circles-changed', onChanged); supabase.removeChannel(channel); };
  }, []);
  // Ouverture directe d'un cercle (depuis une notification, D1).
  // Cercle pas encore dans la liste (on vient d'y entrer) : on recharge une fois.
  const reloadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!openCircleId) return;
    if (circles.some(c => c.id === openCircleId)) {
      setSelectedCircleId(openCircleId);
      setShowCreate(false);
      onSubViewActive?.(true);
    } else if (!loading && reloadedFor.current !== `${openCircleId}-${openNonce}`) {
      reloadedFor.current = `${openCircleId}-${openNonce}`;
      load(true);
    }
  }, [openCircleId, circles.length, openNonce, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  // « Messages » dans le menu : retour à la liste.
  useEffect(() => {
    if (!resetNonce || !selectedCircleId) return;
    setSelectedCircleId(null);
    onSubViewActive?.(false);
  }, [resetNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fabTrigger) return;
    setShowCreate(true);
    onSubViewActive?.(true);
  }, [fabTrigger]);

  // Retour système : on referme le cercle / la création avant de quitter.
  useBackHandler(!!selectedCircleId, () => { setSelectedCircleId(null); onSubViewActive?.(false); });
  useBackHandler(showCreate, () => { setShowCreate(false); onSubViewActive?.(false); });

  // silent : rafraîchissement en fond (nouveau message, cercle lu ou renommé), sans spinner.
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      // Plus actif en premier (P13) : même fonction que la colonne ordinateur.
      const sorted = await getUserCirclesByActivity();
      setCircles(sorted);
    } catch (err) {
      setLoadError(friendlyError(err, 'Impossible de charger tes cercles. Vérifie ta connexion.'));
    }
    setLoading(false);
  };

  if (showCreate) {
    return <CreateCircleFlow currentUser={currentUser} onDone={() => { setShowCreate(false); onSubViewActive?.(false); load(); }} onCreated={(circle) => { setShowCreate(false); onSubViewActive?.(false); onCircleCreated?.(circle.id); }} onBack={() => { setShowCreate(false); onSubViewActive?.(false); }} />;
  }

  if (selectedCircleId) {
    const circle = circles.find(c => c.id === selectedCircleId);
    if (circle) {
      return <CircleView circle={circle} currentUser={currentUser} onBack={(left?: boolean) => { setSelectedCircleId(null); onSubViewActive?.(false); load(!left); }} />;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[var(--nav-h)] lg:pb-4">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-purple-200/80 text-sm">{loadError}</p>
          <button onClick={() => load()} className="mt-4 px-5 py-2 bg-purple-900/40 hover:bg-purple-900/60 rounded-full text-sm font-semibold">
            Réessayer
          </button>
        </div>
      ) : circles.length > 0 ? (
        <div className="space-y-2">
          {circles.map((c) => (
            <button key={c.id} onClick={() => { setSelectedCircleId(c.id); onSubViewActive?.(true); }} className="w-full flex items-center gap-3 p-3 bg-violet-950/20 hover:bg-violet-950/30 rounded-xl border border-purple-500/25 transition-all">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                {c.photo_url ? (
                  <MediaImg src={c.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className={`text-sm truncate flex-1 flex items-center gap-1.5 ${c.unread_count > 0 && !c.muted ? 'font-bold text-white' : 'font-semibold'}`}>
                    <span className="truncate">{c.name}</span>
                    {c.muted && <BellOff className="w-3 h-3 text-purple-300/60 flex-shrink-0" />}
                  </p>
                  <span className="text-[11px] text-purple-300/60 flex-shrink-0">{formatListTime(c.last_activity_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-xs truncate flex-1 ${c.unread_count > 0 && !c.muted ? 'text-white font-semibold' : 'text-purple-300/60'}`}>{c.unread_likes > 0 && !c.unread_count ? '❤️ On a aimé ton message' : circlePreviewText(c, currentUser?.id)}</p>
                  {/* @ : on t'a mentionné (P28), même en sourdine. */}
                  {c.has_mention && (
                    <span className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0" aria-label="On t'a mentionné"><AtSign className="w-3 h-3 text-white" /></span>
                  )}
                  {c.unread_count > 0 && (
                    <span className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${c.muted ? 'bg-purple-800/60 text-purple-200' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}>{c.unread_count > 99 ? '99+' : c.unread_count}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-full flex items-center justify-center border border-purple-700/20">
            <Users className="w-9 h-9 text-purple-400/60" />
          </div>
          <p className="text-purple-200/70 text-sm font-medium">Aucun cercle</p>
          <p className="text-purple-400/50 text-xs mt-1">Crée un espace privé avec tes amis</p>
          <button onClick={() => { setShowCreate(true); onSubViewActive?.(true); }} className="mt-4 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90">
            Créer un cercle
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== Create Circle Flow (3 steps) ====================

function CreateCircleFlow({ currentUser, onDone, onCreated, onBack }: { currentUser: any; onDone: () => void; onCreated: (circle: any) => void; onBack: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCircle, setCreatedCircle] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendResults, setFriendResults] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<any[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getUserFollowing(currentUser.id).then(setFriends).catch(() => {});
  }, []);

  useEffect(() => {
    if (friendSearch.length < 1) { setFriendResults(friends); return; }
    setFriendResults(friends.filter((f: any) => f.username?.toLowerCase().includes(friendSearch.toLowerCase()) || f.display_name?.toLowerCase().includes(friendSearch.toLowerCase())));
  }, [friendSearch, friends]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    // Déjà créé (retour à l'étape 1 puis « Créer ») : on ne le recrée pas.
    if (createdCircle) { setStep(2); return; }
    setCreating(true);
    setCreateError('');
    try {
      const r = await createCircle(name.trim());
      if (r.success) {
        setCreatedCircle(r.data);
        setStep(2);
      } else {
        setCreateError(friendlyError(r.error, "Le cercle n'a pas pu être créé. Réessaie."));
      }
    } catch (e: any) {
      setCreateError(friendlyError(e, "Le cercle n'a pas pu être créé. Réessaie."));
    }
    setCreating(false);
  };

  const toggleFriend = (f: any) => {
    setSelectedFriends(prev => prev.find(x => x.id === f.id) ? prev.filter(x => x.id !== f.id) : [...prev, f]);
  };

  const handleAddMembers = async () => {
    if (!createdCircle) return;
    setAddingMembers(true);
    await Promise.all(selectedFriends.map(f => addCircleMember(createdCircle.id, f.id)));
    setAddingMembers(false);
    setStep(3);
  };

  const shareLink = createdCircle ? circleLink(createdCircle.id, currentUser?.username) : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <button aria-label="Retour" onClick={step === 1 ? onBack : () => setStep(s => (s - 1) as any)} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-bold text-lg">Nouveau cercle</h2>
          <p className="text-xs text-purple-300/60">Étape {step}/3</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1.5 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-violet-900/30'}`} />
        ))}
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-lg">Nomme ton cercle</h3>
            <p className="text-sm text-purple-300/60 mt-1">Un espace privé pour partager de la musique</p>
          </div>
          <input
            autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Ex: Les potes du lycée, Crew 94..."
            className="w-full px-4 py-3 bg-violet-950/20 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500 text-center text-lg font-medium"
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleCreate()}
          />
          {createError && (
            <p className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2 text-center">{createError}</p>
          )}
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Créer le cercle ?'}
          </button>
        </motion.div>
      )}

      {/* Step 2 — Add friends */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="text-center py-2">
            <h3 className="font-bold text-lg">Ajoute des amis</h3>
            <p className="text-sm text-purple-300/60 mt-1">Qui intègre <span className="text-white font-medium">{createdCircle?.name}</span> ?</p>
          </div>

          {selectedFriends.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-violet-950/15 rounded-xl border border-purple-500/20">
              {selectedFriends.map(f => (
                <span key={f.id} className="flex items-center gap-1 bg-purple-600/20 border border-purple-500/30 rounded-full px-2.5 py-1 text-xs">
                  <img loading="lazy" src={avatarThumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-4 h-4 rounded-full object-cover" alt="" />
                  @{f.username}
                  <button aria-label="Retirer" onClick={() => toggleFriend(f)} className="text-purple-300/60 hover:text-pink-400 ml-0.5"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
            <input type="text" value={friendSearch} onChange={e => setFriendSearch(e.target.value)} placeholder="Rechercher un ami..." className="w-full pl-9 pr-3 py-2.5 bg-violet-950/20 border border-purple-500/30 rounded-xl text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500" />
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {(friendSearch.length > 0 ? friendResults : friends).map((f: any) => {
              const selected = !!selectedFriends.find(x => x.id === f.id);
              return (
                <button key={f.id} onClick={() => toggleFriend(f)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${selected ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-violet-900/25 border border-transparent'}`}>
                  <img loading="lazy" src={avatarThumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium">{f.display_name || f.username}</p>
                    <p className="text-xs text-purple-300/60">@{f.username}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-purple-500 border-purple-500' : 'border-purple-600/40'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
            {friends.length === 0 && <p className="text-center text-xs text-purple-300/60 py-4">Aucun ami à ajouter</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep(3)} className="flex-1 py-3 bg-violet-950/20 border border-purple-500/25 rounded-xl text-sm text-purple-300/60 hover:text-white transition-colors">
              Passer
            </button>
            <button onClick={handleAddMembers} disabled={addingMembers || selectedFriends.length === 0} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 text-sm">
              {addingMembers ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Ajouter (${selectedFriends.length}) ?`}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3 — Share */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 text-center">
          <div className="py-4">
            <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-green-500/30 to-purple-500/30 rounded-full flex items-center justify-center border border-fuchsia-500/30">
              <Check className="w-9 h-9 text-fuchsia-400" />
            </div>
            <h3 className="font-bold text-xl text-fuchsia-400">Cercle créé !</h3>
            <p className="text-sm text-purple-300/60 mt-1">
              <span className="text-white font-semibold">{createdCircle?.name}</span> est prêt
              {selectedFriends.length > 0 && ` · ${selectedFriends.length} membre${selectedFriends.length > 1 ? 's' : ''} ajouté${selectedFriends.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Invite Code — big and prominent */}
          {createdCircle?.invite_code && (
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-purple-300/60 mb-1 font-medium uppercase tracking-wider">Code du cercle</p>
              <p className="text-3xl font-black tracking-[0.3em] text-white font-mono select-all">{createdCircle.invite_code}</p>
              <p className="text-xs text-purple-300/60 mt-2">Tes amis peuvent chercher ce code dans l'onglet Recherche pour rejoindre</p>
            </div>
          )}

          <div className="bg-violet-950/20 border border-purple-500/25 rounded-xl p-4 text-left">
            <p className="text-xs text-purple-300/60 mb-2 font-medium uppercase tracking-wider">Lien d'invitation</p>
            <p className="text-xs font-mono text-white/70 break-all leading-relaxed mb-3 select-all">{shareLink}</p>
            <button onClick={copyLink} className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400' : 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30'}`}>
              {copied ? <><Check className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier le lien</>}
            </button>
          </div>

          <button onClick={() => { onCreated(createdCircle); onDone(); }} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90">
            Accéder au cercle
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ==================== Un cercle : conversation + infos ====================

function CircleView({ circle, currentUser, onBack }: { circle: any; currentUser: any; onBack: (left?: boolean) => void }) {
  const [name, setName] = useState<string>(circle.name);
  const [photoUrl, setPhotoUrl] = useState<string | null>(circle.photo_url || null);
  const [members, setMembers] = useState<any[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const isOwner = circle.created_by === currentUser?.id;

  const loadMembers = async () => setMembers(await getCircleMembers(circle.id));
  useEffect(() => { loadMembers(); }, [circle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Renommé par un membre (P8) : l'en-tête suit, ici et chez les autres.
  useEffect(() => {
    const ch = supabase.channel(`circle-meta-${circle.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'circles', filter: `id=eq.${circle.id}` }, (p: any) => {
        if (p.new?.name) setName(p.new.name);
        if (p.new && 'photo_url' in p.new) setPhotoUrl(p.new.photo_url || null);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_members', filter: `circle_id=eq.${circle.id}` }, () => loadMembers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [circle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useBackHandler(showInfo, () => setShowInfo(false));

  return (
    <>
      <ChatThread
        key={circle.id}
        chat={{ kind: 'circle', id: circle.id }}
        currentUser={currentUser}
        title={name}
        subtitle={`${members.length || circle.member_count || 0} membre${(members.length || circle.member_count) > 1 ? 's' : ''} · infos`}
        circlePhoto={photoUrl}
        members={members}
        isCircleOwner={isOwner}
        initialUnread={circle.unread_count || 0}
        onBack={() => onBack()}
        onHeaderClick={() => setShowInfo(true)}
        headerActions={
          <button aria-label="Infos du cercle" onClick={() => setShowInfo(true)} className="p-2 rounded-full text-purple-300/70 hover:text-white hover:bg-violet-900/25">
            <Settings className="w-4 h-4" />
          </button>
        }
      />
      <AnimatePresence>
        {showInfo && (
          <CircleInfoSheet
            circle={{ ...circle, name, photo_url: photoUrl }}
            currentUser={currentUser}
            members={members}
            isOwner={isOwner}
            onClose={() => setShowInfo(false)}
            onRenamed={(n) => { setName(n); window.dispatchEvent(new CustomEvent('shakemoi:circles-changed')); }}
            onPhoto={(u) => { setPhotoUrl(u); window.dispatchEvent(new CustomEvent('shakemoi:circles-changed')); }}
            onMembersChanged={loadMembers}
            onLeft={() => { setShowInfo(false); onBack(true); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Infos du cercle (P12-10) : photo, nom (tous les membres, P8), lien d'invitation,
// membres avec leur rôle, ajouter, retirer (créateur), quitter, supprimer (créateur).
function CircleInfoSheet({ circle, currentUser, members, isOwner, onClose, onRenamed, onPhoto, onMembersChanged, onLeft }: {
  circle: any; currentUser: any; members: any[]; isOwner: boolean; onClose: () => void;
  onRenamed: (name: string) => void; onPhoto: (url: string) => void; onMembersChanged: () => void; onLeft: () => void;
}) {
  const [nameDraft, setNameDraft] = useState<string>(circle.name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const link = circleLink(circle.id, currentUser?.username);

  useEffect(() => {
    if (searchQ.trim().length < 2) { setSearchRes([]); return; }
    const t = setTimeout(async () => setSearchRes(await searchUsers(searchQ.trim())), 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  const saveName = async () => {
    const d = nameDraft.trim();
    if (!d || d === circle.name) return;
    setSaving(true);
    setMsg(null);
    const r: any = await updateCircleName(circle.id, d);
    setSaving(false);
    if (r.success) { onRenamed(r.name || d); setMsg('Nom enregistré'); }
    else setMsg(friendlyError(r.error, 'Impossible de renommer le cercle. Réessaie.'));
  };

  const [cropFile, setCropFile] = useState<File | null>(null);
  const uploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setCropFile(file);
  };
  const uploadCropped = async (cropped: Blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      // Photo du cercle déjà cadrée (P11) : espace public (page d'invitation et aperçu du lien).
      const fileName = `${currentUser.id}/circle-${circle.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, cropped, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const r = await updateCirclePhoto(circle.id, publicUrl);
      if (!r.success) throw new Error(r.error);
      onPhoto(publicUrl);
    } catch {
      setMsg(isOwner ? 'La photo n’a pas pu être changée. Réessaie.' : 'Seul le créateur du cercle peut changer la photo.');
    }
    setUploading(false);
  };

  const add = async (u: any) => {
    const r = await addCircleMember(circle.id, u.id);
    if (!r.success) setMsg('Impossible d’ajouter cette personne.');
    setSearchQ('');
    onMembersChanged();
  };
  const remove = async (u: any) => {
    if (!confirm(`Retirer @${u.username} du cercle ?`)) return;
    const r = await removeCircleMember(circle.id, u.id);
    if (!r.success) setMsg('Impossible de retirer cette personne.');
    onMembersChanged();
  };
  const leave = async () => {
    if (!confirm(`Quitter le cercle « ${circle.name} » ?`)) return;
    const r = await removeCircleMember(circle.id, currentUser.id);
    if (r.success) onLeft(); else setMsg('Impossible de quitter le cercle. Réessaie.');
  };
  const destroy = async () => {
    const typed = prompt(`Supprimer « ${circle.name} » pour tout le monde ? Messages et sons partagés seront effacés.\n\nTape SUPPRIMER pour confirmer.`);
    if (typed?.trim().toUpperCase() !== 'SUPPRIMER') return;
    const r = await deleteCircle(circle.id);
    if (r.success) onLeft(); else setMsg('La suppression a échoué. Réessaie.');
  };
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: circle.name, text: `Rejoins « ${circle.name} » sur SHAKEmoi`, url: link }); return; }
    } catch { return; }
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sorted = [...members].sort((a, b) => (a.id === circle.created_by ? -1 : b.id === circle.created_by ? 1 : (a.username || '').localeCompare(b.username || '')));

  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }}
          className="pointer-events-auto w-full sm:max-w-md h-[90dvh] sm:h-[80dvh] bg-[#1D0F3D] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col overflow-hidden"
          role="dialog" aria-label="Infos du cercle">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-800/30">
            <p className="flex-1 font-bold">Infos du cercle</p>
            <button aria-label="Fermer" onClick={onClose} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => isOwner ? photoRef.current?.click() : setMsg('Seul le créateur du cercle peut changer la photo.')} className="relative w-24 h-24 rounded-full overflow-hidden" aria-label="Photo du cercle">
                {circle.photo_url ? <MediaImg src={circle.photo_url} width={256} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><Users className="w-9 h-9 text-white" /></div>}
                <span className="absolute bottom-0 inset-x-0 py-1 bg-black/50 text-[10px] flex items-center justify-center gap-1">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />} Photo
                </span>
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
              {cropFile && <ImageCropDialog file={cropFile} title="Cadre la photo du cercle" onCancel={() => setCropFile(null)} onDone={uploadCropped} />}
            </div>

            <div>
              <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-1">Nom du cercle</p>
              <div className="flex gap-2">
                <input value={nameDraft} onChange={(e) => { setNameDraft(e.target.value); setMsg(null); }} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} maxLength={40}
                  className="flex-1 min-w-0 bg-violet-950/40 border border-purple-500/30 rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-400/60" />
                <button onClick={saveName} disabled={saving || !nameDraft.trim() || nameDraft.trim() === circle.name} className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-semibold disabled:opacity-40">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
              <p className="text-[11px] text-purple-300/50 mt-1">Tous les membres peuvent renommer le cercle.</p>
            </div>

            {msg && <p className="text-xs text-pink-200 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2">{msg}</p>}

            <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-3">
              <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-2">Lien d'invitation</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 text-xs font-mono text-purple-100 truncate">{link.replace(/^https?:\/\//, '')}</p>
                <button onClick={share} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${copied ? 'bg-fuchsia-500' : 'bg-purple-600'}`}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Partager</>}
                </button>
              </div>
              {circle.invite_code && <p className="text-[11px] text-purple-300/60 mt-2">Code : <span className="font-mono font-bold tracking-widest text-white select-all">{circle.invite_code}</span></p>}
            </div>

            <div>
              <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-2">Membres ({members.length})</p>
              <div className="space-y-1">
                {sorted.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-purple-900/25">
                    <button onClick={() => openProfile(m.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <img src={avatarThumb(m.profile_album_cover_url, 64) || defaultAvatar(m.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.display_name || m.username}{m.id === currentUser?.id ? ' (toi)' : ''}</p>
                        <p className="text-xs text-purple-300/60 truncate">@{m.username}</p>
                      </div>
                    </button>
                    {m.id === circle.created_by
                      ? <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-[10px] font-semibold text-fuchsia-200">Créateur</span>
                      : <span className="px-2 py-0.5 rounded-md bg-purple-800/40 text-[10px] text-purple-200">Membre</span>}
                    {isOwner && m.id !== currentUser?.id && (
                      <button aria-label={`Retirer @${m.username}`} onClick={() => remove(m)} className="p-1.5 rounded-full text-purple-300/60 hover:text-pink-300"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-300/60" />
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Ajouter quelqu'un…" className="w-full pl-8 pr-3 py-2 bg-violet-950/20 border border-purple-500/25 rounded-lg text-base sm:text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500" />
              </div>
              {searchRes.filter((u) => !members.some((m: any) => m.id === u.id)).slice(0, 5).map((u) => (
                <button key={u.id} onClick={() => add(u)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg text-sm">
                  <img src={avatarThumb(u.profile_album_cover_url, 64) || defaultAvatar(u.username)} className="w-7 h-7 rounded-full object-cover" alt="" />
                  @{u.username}
                  <span className="ml-auto text-purple-300 text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</span>
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t border-purple-800/30">
              <button onClick={leave} className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-pink-300 hover:bg-pink-500/10 text-sm"><LogOut className="w-4 h-4" /> Quitter ce cercle</button>
              {isOwner && <button onClick={destroy} className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-red-300 hover:bg-red-500/10 text-sm"><Trash2 className="w-4 h-4" /> Supprimer le cercle pour tout le monde</button>}
            </div>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
