import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, Music, Loader2, Users, Plus, Copy, Check, X, Settings, LogOut, Camera, Smile, Heart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getConversations, getMessages, sendMessage, getUserFollowing,
  getMessageById, markConversationRead, deleteMessage, MESSAGES_PAGE,
  createCircle, getUserCirclesByActivity, getCircleMessages, getCircleMembers,
  searchUsers, addCircleMember, removeCircleMember, getCurrentUser,
  sendCircleMessage, deleteCircleMessage, likeCircleMessage, unlikeCircleMessage, getCircleMessageLikes, hasLikedCircleMessages,
  updateCirclePhoto, updateCircleName
} from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';
import { useBackHandler } from '../../lib/navigation';
import { circleLink } from '../../lib/links';
import { openExternal } from '../../lib/platforms';
import { SongCover } from './SongCover';
import { MediaImg, thumb, defaultAvatar, compressImage, extFor } from '../../lib/media';
import { searchGifs, GIF_ERROR_TEXT } from '../../lib/gifs';
import { friendlyError } from '../../lib/errors';
import { formatListTime, formatDayLabel, isSameDay, formatRelative } from '../../lib/dates';
import { MyAppLogo } from './PlatformLogo';

interface MessagesViewProps {
  currentUser: any;
  onOpenCircle?: (circleId: string | null) => void;
  onCircleCreated?: (circleId: string) => void;
  viewOptions?: any;
}

export function MessagesView({ currentUser, onOpenCircle, onCircleCreated, viewOptions }: MessagesViewProps) {
  const { initialTab = 'dms', openPartnerId = null, openCircleId = null, nonce = 0 } = viewOptions || {};
  const [tab, setTab] = useState<'dms' | 'circles'>(initialTab);
  // Ouverture depuis la colonne de gauche (ordinateur) ou une notif alors
  // qu'on est déjà dans Messages : on suit l'onglet demandé.
  useEffect(() => { setTab(initialTab); }, [viewOptions]);
  const [inSubView, setInSubView] = useState(false);
  const [fabTrigger, setFabTrigger] = useState(0);

  // Glisser du doigt entre Messages et Cercles (P10), seulement sur les listes
  // (pas dans une conversation ouverte). On ignore les bords de l'écran pour
  // laisser le geste retour d'iPhone/Android, et les gestes surtout verticaux.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (inSubView) { swipe.current = null; return; }
    const t = e.touches[0];
    const edge = 28;
    swipe.current = t.clientX < edge || t.clientX > window.innerWidth - edge ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || inSubView) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && tab === 'dms') setTab('circles');
    if (dx > 0 && tab === 'circles') setTab('dms');
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-hidden min-h-0 relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Tab bar — masqué quand on est dans une conversation ou un cercle */}
      {!inSubView && (
        <div className="flex items-center border-b border-purple-500/20 px-4 pt-2 pb-0 gap-1 flex-shrink-0">
          {(['dms', 'circles'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-all rounded-t-lg ${
                tab === t
                  ? 'text-white'
                  : 'text-purple-300/50 hover:text-purple-200'
              }`}
            >
              {t === 'dms' ? 'Messages' : 'Cercles'}
              {tab === t && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className={tab === 'dms' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}>
        <DmsPanel currentUser={currentUser} onSubViewActive={setInSubView} fabTrigger={fabTrigger} openPartnerId={openPartnerId} openNonce={nonce} />
      </div>
      <div className={tab === 'circles' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}>
        <CirclesPanel currentUser={currentUser} onOpenCircle={onOpenCircle} onCircleCreated={onCircleCreated} onSubViewActive={setInSubView} fabTrigger={fabTrigger} openCircleId={openCircleId} openNonce={nonce} />
      </div>

      {/* FAB — bouton + fixe en bas à droite, au-dessus de la nav bar */}
      {!inSubView && (
        <button aria-label="Nouveau"
          onClick={() => setFabTrigger(n => n + 1)}
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
              <img loading="lazy" src={thumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
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

function DmsPanel({ currentUser, onSubViewActive, fabTrigger, openPartnerId, openNonce }: { currentUser: any; onSubViewActive?: (active: boolean) => void; fabTrigger?: number; openPartnerId?: string | null; openNonce?: number }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending] = useState(false);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifSearching, setGifSearching] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Toujours coller en bas de la conversation (comme les autres messageries) :
  // instantané à l'ouverture, animé ensuite pour les nouveaux messages.
  const initialScrollRef = useRef(true);
  // Chargement de messages plus anciens : on garde la position de lecture.
  const skipAutoScrollRef = useRef<number | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'end' });
  };

  useEffect(() => { loadConversations(); }, []);
  // Ouverture directe d'une conversation (depuis une notification, D1).
  useEffect(() => {
    if (!openPartnerId) return;
    supabase.from('users_profile').select('id, username, display_name, profile_album_cover_url')
      .eq('id', openPartnerId).maybeSingle()
      .then(({ data }) => { if (data) openConversation(data); });
  }, [openPartnerId, openNonce]); // nonce : rouvrir la même conversation marche aussi
  useEffect(() => {
    if (!messages.length) return;
    if (skipAutoScrollRef.current !== null) {
      const box = scrollBoxRef.current;
      if (box) box.scrollTop = box.scrollHeight - skipAutoScrollRef.current;
      skipAutoScrollRef.current = null;
      return;
    }
    const instant = initialScrollRef.current;
    initialScrollRef.current = false;
    scrollToBottom(instant);
    // Les images/pochettes changent la hauteur après coup : on recale.
    const t = setTimeout(() => scrollToBottom(true), 150);
    return () => clearTimeout(t);
  }, [messages]);

  // Retour système depuis une conversation : on revient à la liste des
  // messages, pas au site précédent.
  useBackHandler(!!activeConversation, () => closeConversation());

  // Ouverture du clavier mobile : la zone visible rétrécit, on reste en bas.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !activeConversation) return;
    const onResize = () => scrollToBottom(true);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [activeConversation?.id]);
  useEffect(() => {
    if (!fabTrigger) return;
    setShowNewConvo(true);
    getUserFollowing(currentUser.id).then(setFriends).catch(() => {});
  }, [fabTrigger]);

  // Liste des conversations en direct (C8) : un message reçu la remet à jour.
  useEffect(() => {
    if (activeConversation || !currentUser) return;
    const channel = supabase
      .channel(`dm-list-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` },
        () => { loadConversations(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, currentUser?.id]);

  // Realtime subscription for DMs
  useEffect(() => {
    if (!activeConversation || !currentUser) return;
    const channel = supabase
      .channel(`dm-${currentUser.id}-${activeConversation.id}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload: any) => {
        // Message supprimé par son expéditeur (C9).
        const id = payload.old?.id;
        if (id) setMessages(prev => prev.filter((m: any) => m.id !== id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
        const msg = payload.new;
        const involvesPartner =
          (msg.sender_id === activeConversation.id && msg.receiver_id === currentUser.id) ||
          (msg.sender_id === currentUser.id && msg.receiver_id === activeConversation.id);
        if (!involvesPartner) return;

        // Le temps réel n'envoie pas le profil ni l'aperçu de la story : on
        // relit le message complet (réponse à une story visible tout de suite, C7).
        let enriched = msg;
        try {
          const full = await getMessageById(msg.id);
          if (full) enriched = full;
        } catch {}

        setMessages(prev => {
          // Already present (real id)
          if (prev.some((m: any) => m.id === enriched.id)) return prev;
          // Replace matching optimistic temp (same sender + text/track/image within 10s)
          const tempIdx = prev.findIndex((m: any) =>
            typeof m.id === 'string' && m.id.startsWith('temp-') &&
            m.sender_id === enriched.sender_id &&
            (m.text || null) === (enriched.text || null) &&
            (m.image_url || null) === (enriched.image_url || null) &&
            (m.track_id || null) === (enriched.track_id || null)
          );
          if (tempIdx >= 0) {
            const next = [...prev];
            next[tempIdx] = enriched;
            return next;
          }
          return [...prev, enriched];
        });

        // Conversation ouverte : le message reçu est lu tout de suite (A3).
        if (msg.receiver_id === currentUser.id) {
          markConversationRead(activeConversation.id).catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, currentUser?.id]);

  useEffect(() => {
    if (trackQuery.length < 2) { setTrackResults([]); return; }
    const t = setTimeout(async () => {
      try { setTrackResults(await spotify.searchTracks(trackQuery)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [trackQuery]);

  const [listError, setListError] = useState<string | null>(null);
  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    setListError(null);
    try { setConversations(await getConversations()); }
    catch (err) { if (!silent) setListError(friendlyError(err)); }
    setLoading(false);
  };

  // Pagination vers le haut : messages plus anciens (C1).
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const loadOlder = async () => {
    if (!activeConversation || loadingMore) return;
    const oldest = messages.find((m: any) => !String(m.id).startsWith('temp-'));
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const older = await getMessages(activeConversation.id, MESSAGES_PAGE, oldest.created_at);
      setHasMore(older.length === MESSAGES_PAGE);
      const box = scrollBoxRef.current;
      skipAutoScrollRef.current = box ? box.scrollHeight - box.scrollTop : 0;
      setMessages(prev => [...older, ...prev]);
    } catch {}
    setLoadingMore(false);
  };

  const openConversation = async (partner: any) => {
    setActiveConversation(partner);
    setShowNewConvo(false);
    onSubViewActive?.(true);
    setMessages([]);
    setConvError(null);
    initialScrollRef.current = true;   // on ouvre directement en bas
    // Ouvrir la conversation la marque lue (A3), pas ouvrir l'onglet.
    setConversations(prev => prev.map(c => c.partnerId === partner.id ? { ...c, unreadCount: 0 } : c));
    markConversationRead(partner.id).catch(() => {});
    try {
      const page = await getMessages(partner.id);
      setMessages(page);
      setHasMore(page.length === MESSAGES_PAGE);
    } catch (err) {
      setConvError(friendlyError(err));
    }
  };

  const closeConversation = () => {
    setActiveConversation(null);
    onSubViewActive?.(false);
    loadConversations(true);
  };

  // Envoi optimiste : le message s'affiche tout de suite, « Envoi… », puis
  // soit il est confirmé, soit il passe en échec avec « Réessayer » (C2).
  const sendOptimistic = async (temp: any, send: () => Promise<{ success: boolean; data?: any }>) => {
    setMessages(prev => {
      const without = prev.filter((m: any) => m.id !== temp.id);
      return [...without, { ...temp, _status: 'sending' }];
    });
    let r: { success: boolean; data?: any } = { success: false };
    try { r = await send(); } catch {}
    setMessages(prev => {
      if (!r.success) return prev.map((m: any) => m.id === temp.id ? { ...m, _status: 'failed' } : m);
      // Le temps réel a pu arriver avant : pas de doublon.
      if (prev.some((m: any) => m.id === r.data?.id)) return prev.filter((m: any) => m.id !== temp.id);
      return prev.map((m: any) => m.id === temp.id ? { ...m, ...r.data, _status: undefined, _retry: undefined } : m);
    });
  };

  const handleSend = async (track?: any) => {
    if (!activeConversation || (!track && !newMessage.trim())) return;
    const msgText = track ? null : newMessage.trim();
    const partnerId = activeConversation.id;
    const optimisticMsg: any = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser?.id,
      receiver_id: partnerId,
      text: msgText,
      created_at: new Date().toISOString(),
      ...(track ? { track_name: track.name || track.track_name, artist: track.artist, cover_url: track.cover || track.cover_url, track_id: track.id } : {}),
    };
    optimisticMsg._retry = () => sendOptimistic(optimisticMsg, () => sendMessage(partnerId, msgText || undefined, track || undefined));
    setNewMessage('');
    setShowTrackSearch(false);
    setTrackQuery('');
    setTrackResults([]);
    await optimisticMsg._retry();
  };

  const handleSendImage = async (file: File) => {
    if (!activeConversation) return;
    const partnerId = activeConversation.id;
    const preview = photoPreview;
    setPhotoPreview(null);
    setPhotoFile(null);
    const temp: any = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser?.id,
      receiver_id: partnerId,
      image_url: preview,
      created_at: new Date().toISOString(),
    };
    const upload = async () => {
      // Dossier de la conversation : seules les deux personnes peuvent l'ouvrir.
      const small = await compressImage(file, 1280);
      const fileName = `dm/${currentUser.id}/${partnerId}/${Date.now()}.${extFor(small, file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('circle-media')
        .upload(fileName, small, { cacheControl: '3600', upsert: false, contentType: small.type || undefined });
      if (uploadError) return { success: false };
      const { data: { publicUrl } } = supabase.storage.from('circle-media').getPublicUrl(fileName);
      return sendMessage(partnerId, undefined, undefined, publicUrl);
    };
    temp._retry = () => sendOptimistic(temp, upload);
    await temp._retry();
  };

  const handleSendGif = async (gifUrl: string) => {
    if (!activeConversation || !gifUrl) return;
    const partnerId = activeConversation.id;
    setShowGifSearch(false);
    setGifQuery('');
    setGifResults([]);
    const temp: any = { id: `temp-${Date.now()}`, sender_id: currentUser?.id, receiver_id: partnerId, image_url: gifUrl, created_at: new Date().toISOString() };
    temp._retry = () => sendOptimistic(temp, () => sendMessage(partnerId, undefined, undefined, gifUrl));
    await temp._retry();
  };

  // Supprimer un de ses messages (C9) : on touche la bulle, puis « Supprimer ».
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const handleDeleteMessage = async (msg: any) => {
    setSelectedMsgId(null);
    if (String(msg.id).startsWith('temp-')) {
      setMessages(prev => prev.filter((m: any) => m.id !== msg.id));
      return;
    }
    const before = messages;
    setMessages(prev => prev.filter((m: any) => m.id !== msg.id));
    const r = await deleteMessage(msg.id);
    if (!r.success) { setMessages(before); setConvError('Le message n\'a pas pu être supprimé. Réessaie.'); }
  };

  const handlePhotoSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { setConvError('Photo trop lourde (30 Mo max).'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // GIF search
  useEffect(() => {
    if (!showGifSearch) return;
    if (gifQuery.length < 2) {
      // Load trending
      (async () => {
        setGifSearching(true);
        try {
          const r = await searchGifs('');
        setGifResults(r.gifs);
        setGifError(r.error ? GIF_ERROR_TEXT[r.error] : null);
        } catch { setGifResults([]); }
        setGifSearching(false);
      })();
      return;
    }
    const timer = setTimeout(async () => {
      setGifSearching(true);
      try {
        const r = await searchGifs(gifQuery);
        setGifResults(r.gifs);
        setGifError(r.error ? GIF_ERROR_TEXT[r.error] : null);
      } catch { setGifResults([]); }
      setGifSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [gifQuery, showGifSearch]);

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (activeConversation) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Instagram-style: sticky header, scrollable messages, sticky input */}
        <div className="px-4 py-3 border-b border-purple-500/25 flex items-center gap-3 flex-shrink-0 bg-[#1E1440]/95 backdrop-blur-sm">
          <button onClick={closeConversation} aria-label="Retour aux messages" className="p-1 hover:bg-violet-900/25 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img loading="lazy" src={thumb(activeConversation.profile_album_cover_url) || defaultAvatar(activeConversation.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{activeConversation.display_name || activeConversation.username}</p>
            <p className="text-xs text-purple-300/70">@{activeConversation.username}</p>
          </div>
        </div>

        <div ref={scrollBoxRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" onClick={() => setSelectedMsgId(null)}>
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); loadOlder(); }}
                disabled={loadingMore}
                className="px-3 py-1.5 rounded-full bg-violet-950/40 border border-purple-500/25 text-xs text-purple-200/80 hover:text-white disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Messages plus anciens'}
              </button>
            </div>
          )}
          {convError && (
            <p className="text-center text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2" onClick={() => setConvError(null)}>{convError}</p>
          )}
          {messages.map((msg, idx) => {
            const isMine = msg.sender_id === currentUser?.id;
            const isTrack = !!msg.track_name;
            const isStoryInteraction = !!msg.story_id;
            // Séparateur quand le jour change (C5).
            const prev = messages[idx - 1];
            const newDay = !prev || !isSameDay(prev.created_at, msg.created_at);
            const selected = selectedMsgId === msg.id;
            return (
              <div key={msg.id}>
              {newDay && (
                <div className="flex justify-center my-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-950/50 text-[11px] font-medium text-purple-300/70">{formatDayLabel(msg.created_at)}</span>
                </div>
              )}
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  onClick={(e) => { if (!isMine || msg._status) return; e.stopPropagation(); setSelectedMsgId(selected ? null : msg.id); }}
                  className={`max-w-[80%] rounded-2xl overflow-hidden ${msg._status === 'failed' ? 'bg-pink-900/30 border border-pink-500/50' : isMine ? 'bg-purple-600/30 border border-purple-500/30' : 'bg-violet-950/25 border border-purple-500/25'} ${msg._status === 'sending' ? 'opacity-70' : ''} ${selected ? 'ring-2 ring-pink-400/60' : ''}`}>
                  {/* Réaction à une story : aperçu de la story + like ou réponse */}
                  {isStoryInteraction && (
                    <div className="flex gap-2.5 p-2 pr-3 items-start">
                      {(msg.story?.image_url || msg.story?.cover_url) ? (
                        <img loading="lazy"
                          src={thumb(msg.story.image_url, 256) || msg.story.cover_url}
                          alt=""
                          className="w-11 h-[4.5rem] rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="w-11 h-[4.5rem] rounded-lg bg-gradient-to-br from-purple-700 to-pink-700 flex-shrink-0" />
                      )}
                      <div className="min-w-0 text-sm">
                        <p className="text-[11px] font-semibold text-purple-300/80 mb-0.5">
                          {msg.text
                            ? (isMine ? 'Tu as répondu à sa story' : 'A répondu à ta story')
                            : (isMine ? 'Tu as aimé sa story' : 'A aimé ta story')}
                        </p>
                        {msg.text
                          ? <p className="text-purple-50 break-words">{msg.text.startsWith('💭') ? (msg.text.split(':\n')[1] || msg.text) : msg.text}</p>
                          : <p className="text-lg leading-none">❤️</p>}
                        {msg.story?.track_name && (
                          <p className="text-[10px] text-purple-300/60 mt-1 truncate">🎵 {msg.story.track_name}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.text && !msg.story_id && <p className="px-3 py-2 text-sm">{msg.text}</p>}
                  {msg.image_url && (
                    <div className="p-1">
                      <MediaImg src={msg.image_url} alt="" className="max-w-full max-h-64 min-w-[6rem] min-h-[6rem] rounded-xl object-cover" />
                    </div>
                  )}
                  {isTrack && (
                    <div className="p-2">
                      {/* M2 : pochette jouable, jamais d'embed Spotify. */}
                      <div className="flex gap-2 items-center">
                        <SongCover
                          songKey={`dm-${msg.id}`}
                          title={msg.track_name} artist={msg.artist} cover={msg.cover_url}
                          previewUrl={msg.preview_url} spotifyId={msg.track_id} spotifyUrl={msg.spotify_url}
                          className="w-12 h-12"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{msg.track_name}</p>
                          <p className="text-xs text-purple-200/70 truncate">{msg.artist}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); const url = getPlatformUrl({ spotify_url: msg.spotify_url, apple_music_url: msg.apple_music_url, deezer_url: msg.deezer_url, youtube_url: msg.youtube_url, youtube_music_url: msg.youtube_music_url, tidal_url: msg.tidal_url, odesli_page_url: msg.odesli_page_url }, currentUser?.musicService || 'spotify', { title: msg.track_name, artist: msg.artist }); if (url) openExternal(url); }}
                          aria-label="Ouvrir dans mon appli de musique"
                          className="flex-shrink-0 p-2 rounded-full bg-purple-600/20 hover:bg-purple-600/30"
                        >
                          <MyAppLogo className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <p className={`px-3 pb-1.5 text-[10px] ${isMine ? 'text-purple-300/60 text-right' : 'text-purple-400/50'}`}>
                    {msg._status === 'sending' ? 'Envoi…' : formatTime(msg.created_at)}
                  </p>
                </div>
                {/* Échec d'envoi : visible, avec renvoi (C2). */}
                {msg._status === 'failed' && (
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    <span className="text-pink-300">Pas envoyé</span>
                    <button onClick={(e) => { e.stopPropagation(); msg._retry?.(); }} className="font-semibold text-white underline">Réessayer</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }} className="text-purple-300/70">Annuler</button>
                  </div>
                )}
                {selected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                    className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-[11px] font-semibold text-pink-300"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer pour tous
                  </button>
                )}
              </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showTrackSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#1E1440] max-h-60 overflow-y-auto flex-shrink-0">
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/70" />
                  <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son à envoyer..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
                </div>
                {trackResults.map((t: any) => (
                  <button aria-label="Envoyer" key={t.id} onClick={() => handleSend(t)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
                    <img loading="lazy" src={t.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-purple-200/70 truncate">{t.artist}</p></div>
                    <Send className="w-4 h-4 text-purple-400" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          {showGifSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-72 overflow-hidden border-t border-purple-500/25 bg-[#1E1440] flex flex-col flex-shrink-0">
              <div className="p-3 pb-0">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                  <input autoFocus type="text" value={gifQuery} onChange={(e: any) => setGifQuery(e.target.value)} placeholder="Rechercher un GIF..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {gifSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
                <div className="grid grid-cols-2 gap-2">
                  {gifError && <p className="col-span-full text-center text-xs text-purple-200/80 py-3 px-2">{gifError}</p>}
                  {gifResults.map((gif: any) => (
                    <button key={gif.id} onClick={() => handleSendGif(gif.url)} className="rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all">
                      <img src={gif.preview} alt="" className="w-full h-24 object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {photoPreview && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-3 border-t border-purple-500/25 bg-[#1E1440] flex-shrink-0">
              <div className="flex items-end gap-3">
                <div className="relative inline-block">
                  <img loading="lazy" src={photoPreview} alt="Aperçu" className="max-h-40 rounded-lg object-cover" />
                  <button aria-label="Retirer la photo" onClick={() => { setPhotoFile(null); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
                <button onClick={() => photoFile && handleSendImage(photoFile)} disabled={sending} className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-shrink-0 bg-[#1E1440] border-t border-purple-500/25 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] pb-[var(--nav-h)] lg:pb-0">
          <div className="px-3 py-2 flex items-center gap-2">
                <button onClick={() => { setShowTrackSearch(!showTrackSearch); setShowGifSearch(false); }} className={`flex-shrink-0 p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}>
                  <Music className="w-5 h-5" />
                </button>
                <button onClick={() => { setShowGifSearch(!showGifSearch); setShowTrackSearch(false); }} className={`flex-shrink-0 p-2 rounded-full transition-colors ${showGifSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}>
                  <Smile className="w-5 h-5" />
                </button>
                <button aria-label="Ajouter une photo" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 p-2 rounded-full hover:bg-purple-900/40 text-purple-400 transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Envoie un message..." enterKeyHint="send" className="flex-1 min-w-0 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" onFocus={() => setTimeout(() => scrollToBottom(true), 300)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <button onClick={() => handleSend()} disabled={sending || !newMessage.trim()} aria-label="Envoyer" className="flex-shrink-0 p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[var(--nav-h)] lg:pb-4">
      {showNewConvo && (
        <NewConvoSearch
          friends={friends}
          onSelect={openConversation}
          onClose={() => setShowNewConvo(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : listError ? (
        <div className="text-center py-10">
          <p className="text-pink-300 text-sm mb-3">{listError}</p>
          <button onClick={() => loadConversations()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold">Réessayer</button>
        </div>
      ) : conversations.length > 0 ? (
        <div className="space-y-0.5">
          {conversations.map((c) => (
            <button key={c.partnerId} onClick={() => openConversation(c.partner)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-950/25 rounded-xl transition-colors">
              <div className="relative flex-shrink-0">
                <img loading="lazy"
                  src={thumb(c.partner?.profile_album_cover_url) || defaultAvatar(c.partner?.username)}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-purple-700/30"
                  alt=""
                />
                {c.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-pink-500 border-2 border-[#1E1440] rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm truncate ${c.unreadCount > 0 ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>
                  {c.partner?.display_name || c.partner?.username}
                </p>
                <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-purple-200/80 font-medium' : 'text-purple-300/60'}`}>
                  {c.lastMessage?.track_name
                    ? `🎵 ${c.lastMessage.track_name}`
                    : c.lastMessage?.story_id
                      ? (c.lastMessage.text ? `Story : ${c.lastMessage.text}` : '❤️ a aimé une story')
                      : c.lastMessage?.image_url && !c.lastMessage?.text
                        ? '📷 Photo'
                        : c.lastMessage?.text || '…'}
                </p>
              </div>
              <span className={`text-[10px] flex-shrink-0 ${c.unreadCount > 0 ? 'text-pink-300 font-semibold' : 'text-purple-300/50'}`}>
                {formatListTime(c.lastMessage?.created_at)}
              </span>
            </button>
          ))}
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

function CirclesPanel({ currentUser, onCircleCreated, onSubViewActive, fabTrigger, openCircleId, openNonce }: { currentUser: any; onOpenCircle?: (circleId: string | null) => void; onCircleCreated?: (circleId: string) => void; onSubViewActive?: (active: boolean) => void; fabTrigger?: number; openCircleId?: string | null; openNonce?: number }) {
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Cercle renommé ou modifié ailleurs (P8) : la liste se met à jour.
    const onChanged = () => load();
    window.addEventListener('shakemoi:circles-changed', onChanged);
    return () => window.removeEventListener('shakemoi:circles-changed', onChanged);
  }, []);
  // Ouverture directe d'un cercle (depuis une notification, D1).
  useEffect(() => {
    if (openCircleId && circles.some(c => c.id === openCircleId)) {
      setSelectedCircleId(openCircleId);
      onSubViewActive?.(true);
    }
  }, [openCircleId, circles.length, openNonce]);
  useEffect(() => {
    if (!fabTrigger) return;
    setShowCreate(true);
    onSubViewActive?.(true);
  }, [fabTrigger]);

  // Retour système : on referme le cercle / la création avant de quitter.
  useBackHandler(!!selectedCircleId, () => { setSelectedCircleId(null); onSubViewActive?.(false); });
  useBackHandler(showCreate, () => { setShowCreate(false); onSubViewActive?.(false); });

  const load = async () => {
    setLoading(true);
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
      return <CircleView circle={circle} currentUser={currentUser} onBack={(left?: boolean) => { setSelectedCircleId(null); onSubViewActive?.(false); if (left) load(); }} />;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[var(--nav-h)] lg:pb-4">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-purple-200/80 text-sm">{loadError}</p>
          <button onClick={load} className="mt-4 px-5 py-2 bg-purple-900/40 hover:bg-purple-900/60 rounded-full text-sm font-semibold">
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
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-purple-300/60">{c.invite_code ? `Code: ${c.invite_code}` : 'Cercle privé'}</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-purple-300/60 rotate-180" />
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
                  <img loading="lazy" src={thumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-4 h-4 rounded-full" alt="" />
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
                  <img loading="lazy" src={thumb(f.profile_album_cover_url) || defaultAvatar(f.username)} className="w-9 h-9 rounded-full object-cover" alt="" />
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

// ==================== Circle View (feed + settings) ====================

function CircleView({ circle, currentUser, onBack }: { circle: any; currentUser: any; onBack: (left?: boolean) => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const loadedOnce = useRef(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  // Renommer le cercle (P8) : tous les membres peuvent le faire, la base le vérifie aussi.
  const [circleName, setCircleName] = useState<string>(circle.name);
  const [nameDraft, setNameDraft] = useState<string>(circle.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const saveCircleName = async () => {
    const draft = nameDraft.trim();
    if (!draft || draft === circleName) return;
    setSavingName(true);
    setNameMsg(null);
    const r: any = await updateCircleName(circle.id, draft);
    setSavingName(false);
    if (r.success) {
      setCircleName(r.name || draft);
      circle.name = r.name || draft;
      setNameMsg('Nom enregistré');
      window.dispatchEvent(new CustomEvent('shakemoi:circles-changed'));
    } else {
      setNameMsg(r.error || 'Impossible de renommer le cercle. Réessaie.');
    }
  };
  const [members, setMembers] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  // Photo/GIF support in circles
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifSearching, setGifSearching] = useState(false);
  // Likes system
  const [likedMessages, setLikedMessages] = useState<Record<string, boolean>>({});
  // Double-tap = like (P9), appui long sur son message = Retirer (P12).
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const [heartBurst, setHeartBurst] = useState<string | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [circleMsgError, setCircleMsgError] = useState<string | null>(null);
  const isInteractive = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('button, a, input, textarea');
  const handleBubbleTap = (e: React.MouseEvent, msg: any) => {
    if (isInteractive(e.target)) return;
    const now = Date.now();
    if (lastTap.current && lastTap.current.id === msg.id && now - lastTap.current.t < 320) {
      lastTap.current = null;
      setHeartBurst(msg.id);
      window.setTimeout(() => setHeartBurst(h => (h === msg.id ? null : h)), 700);
      toggleLikeMessage(msg.id);
    } else {
      lastTap.current = { id: msg.id, t: now };
    }
  };
  const startPress = (e: React.TouchEvent, msg: any) => {
    if (msg.sender_id !== currentUser?.id || isInteractive(e.target)) return;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setActionMsgId(msg.id), 500);
  };
  const cancelPress = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const handleRemoveCircleMessage = async (msg: any) => {
    setActionMsgId(null);
    const before = posts;
    setPosts(prev => prev.filter((m: any) => m.id !== msg.id));
    const r = await deleteCircleMessage(msg.id);
    if (!r.success) { setPosts(before); setCircleMsgError('Le message n\'a pas pu être retiré. Réessaie.'); }
  };
  const [messageLikers, setMessageLikers] = useState<Record<string, any[]>>({});
  const [showLikers, setShowLikers] = useState<string | null>(null);
  // Circle group photo
  const [circlePhotoUrl, setCirclePhotoUrl] = useState<string | null>(circle.photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const circlePhotoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, []);

  // Realtime subscription for circle messages
  useEffect(() => {
    if (!circle?.id) return;
    const channel = supabase
      .channel(`circle-chat-${circle.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'circle_messages',
        filter: `circle_id=eq.${circle.id}`
      }, (payload: any) => {
        if (payload.new?.sender_id === currentUser?.id) return;
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [circle?.id, currentUser?.id]);

  // Auto-scroll to bottom when posts change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts.length]);

  // Spinner seulement au premier chargement : un message reçu ou envoyé ne
  // remplace plus toute la conversation par un chargement (la lecture sautait).
  const loadData = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const [p, m] = await Promise.all([getCircleMessages(circle.id), getCircleMembers(circle.id)]);
      setPosts(p);
      loadedOnce.current = true;
      setMembers(m);
      // Load likes status for all messages
      const messageIds = p.map((msg: any) => msg.id);
      if (messageIds.length > 0) {
        const likedStatus = await hasLikedCircleMessages(messageIds);
        setLikedMessages(likedStatus);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (searchQ.length < 2) { setSearchRes([]); return; }
    const t = setTimeout(async () => { setSearchRes(await searchUsers(searchQ)); }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (trackQuery.length < 2) { setTrackResults([]); return; }
    const t = setTimeout(async () => {
      try { setTrackResults(await spotify.searchTracks(trackQuery)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [trackQuery]);

  useEffect(() => {
    if (!showGifSearch || gifQuery.length < 1) { setGifResults([]); return; }
    const t = setTimeout(async () => {
      setGifSearching(true);
      try {
        const r = await searchGifs(gifQuery);
        setGifResults(r.gifs);
        setGifError(r.error ? GIF_ERROR_TEXT[r.error] : null);
      } catch { setGifResults([]); }
      setGifSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [gifQuery, showGifSearch]);

  const handlePhotoSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Photo trop lourde (max 10 Mo)'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const sendChatPhoto = async () => {
    if (!photoFile) return;
    setChatSending(true);
    try {
      const fileName = `circle-${circle.id}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('circle-media')
        .upload(fileName, await compressImage(photoFile, 1280), { cacheControl: '3600', upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('circle-media').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      
      const result = await sendCircleMessage(circle.id, chatText || undefined, undefined, publicUrl);
      if (result.success) {
        setChatText('');
        setPhotoPreview(null);
        setPhotoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadData();
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      alert('Erreur lors de l\'upload de la photo');
    }
    setChatSending(false);
  };

  const sendChatGif = async (gifUrl: string) => {
    setChatSending(true);
    try {
      const result = await sendCircleMessage(circle.id, undefined, undefined, gifUrl);
      if (result.success) {
        setShowGifSearch(false);
        setGifQuery('');
        setGifResults([]);
        await loadData();
      }
    } catch (err) {
      console.error('Error sending GIF:', err);
    }
    setChatSending(false);
  };

  const toggleLikeMessage = async (messageId: string) => {
    const isLiked = likedMessages[messageId];
    // Mise à jour immédiate (cœur + compteur), annulée si la base refuse.
    const bump = (d: number) => setPosts(prev => prev.map(m => m.id === messageId ? { ...m, likes_count: Math.max(0, (m.likes_count || 0) + d) } : m));
    setLikedMessages(prev => ({ ...prev, [messageId]: !isLiked }));
    bump(isLiked ? -1 : 1);
    const r = isLiked ? await unlikeCircleMessage(messageId) : await likeCircleMessage(messageId);
    if (!r.success) {
      setLikedMessages(prev => ({ ...prev, [messageId]: isLiked }));
      bump(isLiked ? 1 : -1);
      return;
    }
    // Optionally reload likes count
    const likers = await getCircleMessageLikes(messageId);
    if (likers.length > 0) {
      setMessageLikers(prev => ({ ...prev, [messageId]: likers }));
    }
  };

  useEffect(() => {
    if (searchQ.length < 2) { setSearchRes([]); return; }
    const t = setTimeout(async () => { setSearchRes(await searchUsers(searchQ)); }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (trackQuery.length < 2) { setTrackResults([]); return; }
    const t = setTimeout(async () => {
      try { setTrackResults(await spotify.searchTracks(trackQuery)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [trackQuery]);

  const sendChatText = async () => {
    if (!chatText.trim() || chatSending) return;
    setChatSending(true);
    const text = chatText.trim();
    setChatText('');

    // Optimistic UI: add the message immediately
    const optimisticMsg: any = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser?.id,
      text,
      circle_id: circle?.id,
      created_at: new Date().toISOString(),
      user: currentUser,
    };
    setPosts(prev => [optimisticMsg, ...prev]);

    try {
      const result = await sendCircleMessage(circle.id, text);
      if (!result.success) {
        console.error('Circle send failed:', result.error);
        setChatText(text);
        setPosts(prev => prev.filter(p => p.id !== optimisticMsg.id));
      } else {
        await loadData();
      }
    } catch (e) {
      console.error('Circle send error:', e);
      setChatText(text);
      setPosts(prev => prev.filter(p => p.id !== optimisticMsg.id));
    }
    setChatSending(false);
  };

  const sendChatTrack = async (track: any) => {
    setChatSending(true);
    try {
      const result = await sendCircleMessage(circle.id, undefined, track);
      if (!result.success) {
        console.error('Circle track send failed:', result.error);
      } else {
        setShowTrackSearch(false);
        setTrackQuery('');
        setTrackResults([]);
      }
      await loadData();
    } catch (e) {
      console.error('Circle track send error:', e);
    }
    setChatSending(false);
  };

  const addMember = async (userId: string) => {
    await addCircleMember(circle.id, userId);
    setMembers(await getCircleMembers(circle.id));
    setSearchQ('');
  };

  const removeMember = async (userId: string) => {
    await removeCircleMember(circle.id, userId);
    setMembers(await getCircleMembers(circle.id));
  };

  const leaveCircle = async () => {
    if (!confirm(`Quitter le cercle « ${circle.name} » ?`)) return;
    const user = await getCurrentUser();
    if (user) { await removeCircleMember(circle.id, user.id); onBack(true); }
  };

  const handleCirclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo trop lourde (max 5 Mo)'); return; }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      // Photo du groupe : espace public (elle s'affiche sur la page
      // d'invitation et l'aperçu du lien, visibles sans être membre).
      const fileName = `${currentUser.id}/circle-${circle.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, await compressImage(file, 256), { cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await updateCirclePhoto(circle.id, publicUrl);
      setCirclePhotoUrl(publicUrl);
    } catch (err) {
      console.error('Error uploading circle photo:', err);
    }
    setUploadingPhoto(false);
    if (e.target) e.target.value = '';
  };

  const shareLink = circleLink(circle.id, currentUser?.username);
  const [copied, setCopied] = useState(false);
  const copyLink = () => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // Même format de date partout (lib/dates).
  const formatTs = (ts: string) => formatRelative(ts);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Instagram-style: sticky circle header */}
      <div className="px-4 py-3 border-b border-purple-500/25 flex items-center gap-3 flex-shrink-0 bg-[#1E1440]/95 backdrop-blur-sm">
        <button aria-label="Retour" onClick={() => onBack()} className="p-1 hover:bg-violet-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
          {circlePhotoUrl ? (
            <MediaImg src={circlePhotoUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{circleName}</p>
          <p className="text-xs text-purple-300/60">{members.length} membre{members.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={copyLink} className={`flex-shrink-0 p-2 rounded-full transition-colors ${copied ? 'text-fuchsia-400' : 'text-purple-300/60 hover:text-white hover:bg-violet-900/25'}`} title="Copier le lien d'invitation">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <button aria-label="Paramètres" onClick={() => setShowSettings(!showSettings)} className={`flex-shrink-0 p-2 rounded-full transition-colors ${showSettings ? 'bg-violet-900/40 text-white' : 'text-purple-300/60 hover:text-white hover:bg-violet-900/25'}`}>
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-purple-500/25 bg-[#1E1440] flex-shrink-0">
            <div className="p-4 space-y-3">
              {/* Group Photo */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                  {circlePhotoUrl ? (
                    <MediaImg src={circlePhotoUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => circlePhotoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="text-xs px-3 py-1.5 bg-violet-900/30 border border-purple-500/30 rounded-full hover:bg-violet-900/50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    Photo du cercle
                  </button>
                  <input ref={circlePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleCirclePhotoUpload} />
                </div>
              </div>
              {/* Nom du cercle (P8) */}
              {(
                <div>
                  <p className="text-[10px] text-purple-300/60 uppercase tracking-wider mb-1">Nom du cercle</p>
                  <div className="flex gap-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => { setNameDraft(e.target.value); setNameMsg(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveCircleName(); }}
                      maxLength={40}
                      className="flex-1 min-w-0 bg-violet-950/40 border border-purple-500/30 rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-400/60"
                    />
                    <button
                      onClick={saveCircleName}
                      disabled={savingName || !nameDraft.trim() || nameDraft.trim() === circleName}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-semibold disabled:opacity-40"
                    >
                      {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enregistrer'}
                    </button>
                  </div>
                  {nameMsg && <p className="text-[11px] text-purple-200/80 mt-1">{nameMsg}</p>}
                </div>
              )}
              {/* Invite Code */}
              {circle.invite_code && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-purple-300/60 uppercase tracking-wider mb-1">Code d'invitation</p>
                  <p className="text-xl font-black tracking-[0.25em] text-white font-mono select-all">{circle.invite_code}</p>
                </div>
              )}
              <p className="text-xs font-semibold text-purple-300/60 uppercase tracking-wider">Membres ({members.length})</p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <span key={m.id} className="flex items-center gap-1 bg-violet-950/30 rounded-full px-2.5 py-1 text-xs border border-purple-500/20">
                    <img loading="lazy" src={thumb(m.profile_album_cover_url) || defaultAvatar(m.username)} className="w-4 h-4 rounded-full" alt="" />
                    @{m.username}
                    {m.id !== currentUser?.id && <button aria-label="Retirer du cercle" onClick={() => removeMember(m.id)} className="text-purple-300/60 hover:text-pink-400 ml-0.5"><X className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-300/60" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Ajouter un ami..." className="w-full pl-8 pr-3 py-2 bg-violet-950/20 border border-purple-500/25 rounded-lg text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500" />
              </div>
              {searchRes.filter(u => !members.find((m: any) => m.id === u.id)).slice(0, 4).map(u => (
                <button key={u.id} onClick={() => addMember(u.id)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg text-sm">
                  <img loading="lazy" src={thumb(u.profile_album_cover_url) || defaultAvatar(u.username)} className="w-6 h-6 rounded-full" alt="" />
                  @{u.username}
                  <span className="ml-auto text-purple-400 text-xs">+ Ajouter</span>
                </button>
              ))}
              <button onClick={leaveCircle} className="flex items-center gap-2 text-pink-400/70 hover:text-pink-400 text-sm transition-colors">
                <LogOut className="w-4 h-4" /> Quitter ce cercle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" onClick={() => setActionMsgId(null)}>
        {circleMsgError && (
          <p className="text-center text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2" onClick={() => setCircleMsgError(null)}>{circleMsgError}</p>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
        ) : posts.length > 0 ? [...posts].reverse().map((msg: any) => {
          const trackId = msg.track_id || msg.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null;
          const isOpen = false;
          const user = msg.user;
          const isLiked = likedMessages[msg.id];
          const likersData = messageLikers[msg.id] || [];
          if (!msg.track_name && !msg.text && !msg.image_url) return null;
          return (
            <div key={msg.id}
              onClick={(e) => { if (actionMsgId === msg.id) { e.stopPropagation(); return; } handleBubbleTap(e, msg); }}
              onTouchStart={(e) => startPress(e, msg)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onContextMenu={(e) => { if (msg.sender_id === currentUser?.id) { e.preventDefault(); setActionMsgId(msg.id); } }}
              className={`relative select-none rounded-xl border transition-all overflow-hidden group ${actionMsgId === msg.id ? 'ring-2 ring-pink-400/60' : ''} ${isOpen ? 'bg-violet-950/30 border-purple-600/30' : 'bg-violet-950/15 border-purple-500/20'}`}>
              {heartBurst === msg.id && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                  <Heart className="w-12 h-12 text-pink-500 fill-current drop-shadow-lg animate-ping" />
                </div>
              )}
              {actionMsgId === msg.id && (
                <div className="absolute top-2 right-2 z-20 flex gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveCircleMessage(msg); }} className="px-2.5 py-1 rounded-lg bg-red-500/90 text-white text-xs font-semibold">Retirer le message</button>
                  <button onClick={(e) => { e.stopPropagation(); setActionMsgId(null); }} className="px-2 py-1 rounded-lg bg-violet-900/90 text-purple-100 text-xs">Annuler</button>
                </div>
              )}
              <div className="p-2.5 flex items-center gap-2">
                <img loading="lazy" src={thumb(user?.profile_album_cover_url) || defaultAvatar(user?.username)} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                <span className="text-xs font-medium text-purple-200/80">@{user?.username}</span>
                <span className="text-xs text-purple-300/60 ml-auto">{formatTs(msg.created_at)}</span>
              </div>
              
              {/* Text-only message */}
              {msg.text && !msg.track_name && !msg.image_url && <p className="px-3 pb-2.5 text-sm">{msg.text}</p>}
              
              {/* Photo/GIF message */}
              {msg.image_url && (
                <div className="px-2.5 pb-2">
                  <MediaImg src={msg.image_url} alt="" className="max-w-full max-h-64 min-w-[6rem] min-h-[6rem] rounded-xl object-cover" />
                  {msg.text && <p className="text-xs text-purple-300/60 mt-1.5">{msg.text}</p>}
                </div>
              )}
              
              {/* Track message */}
              {msg.track_name && (
                <div className="px-2.5 pb-2">
                  <div className="flex gap-2 items-center">
                    <SongCover
                      songKey={`circle-${msg.id}`}
                      title={msg.track_name} artist={msg.artist} cover={msg.cover_url}
                      previewUrl={msg.preview_url} spotifyId={trackId} spotifyUrl={msg.spotify_url}
                      className="w-11 h-11" iconSize="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{msg.track_name}</p>
                      <p className="text-xs text-purple-200/60 truncate">{msg.artist}</p>
                      {msg.text && <p className="text-xs text-purple-300/60 truncate mt-0.5 italic">"{msg.text}"</p>}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Likes bar */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center gap-1.5 border-t border-purple-500/10">
                <button
                  onClick={() => toggleLikeMessage(msg.id)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-xs ${isLiked ? 'bg-red-500/20 text-red-400' : 'text-purple-400/70 hover:text-purple-300 hover:bg-purple-500/10'}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                  {msg.likes_count || 0}
                </button>
                
                {msg.likes_count > 0 && (
                  <button
                    onClick={() => setShowLikers(showLikers === msg.id ? null : msg.id)}
                    className="text-xs text-purple-400/70 hover:text-purple-300 px-1"
                  >
                    +{msg.likes_count} {msg.likes_count === 1 ? 'like' : 'likes'}
                  </button>
                )}
              </div>
              
              {/* Likers list */}
              {showLikers === msg.id && likersData.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-2.5 pb-2.5 border-t border-purple-500/10 space-y-1"
                >
                  {likersData.map((liker: any) => (
                    <div key={liker.id} className="flex items-center gap-1.5 text-xs">
                      <img loading="lazy" src={thumb(liker.profile_album_cover_url) || defaultAvatar(liker.username)} className="w-4 h-4 rounded-full object-cover" alt="" />
                      <span className="text-purple-300">{liker.username}</span>
                      <span className="text-purple-400 ml-auto">{liker.emoji}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          );
        }) : (
          <div className="text-center py-12">
            <Music className="w-10 h-10 text-[#FFEFD5] mx-auto mb-2" />
            <p className="text-purple-300/60 text-sm">Aucun message dans ce cercle</p>
            <p className="text-purple-300/60 text-xs mt-1">Envoie un message ou partage un son !</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Photo preview */}
      {photoPreview && (
        <div className="px-3 py-2 border-t border-purple-500/25 bg-violet-950/15 flex items-end gap-2 flex-shrink-0">
          <div className="relative">
            <img loading="lazy" src={photoPreview} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <button aria-label="Retirer la photo" onClick={() => { setPhotoPreview(null); setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <p className="text-xs text-purple-300/60">Photo prête à envoyer</p>
            <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Ajouter une légende..." className="w-full px-2 py-1 bg-violet-950/20 border border-purple-500/30 rounded-lg text-xs text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
          </div>
          <button onClick={sendChatPhoto} disabled={chatSending} aria-label="Envoyer" className="flex-shrink-0 p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Track search overlay */}
      <AnimatePresence>
        {showTrackSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#1E1440] max-h-52 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {trackResults.map((t: any) => (
                <button aria-label="Envoyer" key={t.id} onClick={() => sendChatTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
                  <img loading="lazy" src={t.cover} alt="" className="w-9 h-9 rounded-md object-cover" />
                  <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-purple-200/70 truncate">{t.artist}</p></div>
                  <Send className="w-4 h-4 text-purple-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIF search overlay */}
      <AnimatePresence>
        {showGifSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#1E1440] max-h-52 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={gifQuery} onChange={e => setGifQuery(e.target.value)} placeholder="Chercher un GIF..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {gifSearching ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-purple-500 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {gifError && <p className="col-span-full text-center text-xs text-purple-200/80 py-3 px-2">{gifError}</p>}
                  {gifResults.map((g: any) => (
                    <button aria-label="Envoyer" key={g.id} onClick={() => sendChatGif(g.url)} className="relative group overflow-hidden rounded-lg">
                      <img loading="lazy" src={g.preview} alt="" className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Send className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat bar */}
      <div className="px-3 py-2.5 pb-[calc(0.625rem+var(--nav-h))] lg:pb-2.5 border-t border-purple-500/25 flex items-center gap-2 flex-shrink-0 bg-[#1E1440]/95 backdrop-blur-lg">
        <button onClick={() => setShowTrackSearch(!showTrackSearch)} className={`flex-shrink-0 p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`} title="Partager un son">
          <Music className="w-5 h-5" />
        </button>
        
        <button onClick={() => setShowGifSearch(!showGifSearch)} className={`flex-shrink-0 p-2 rounded-full transition-colors ${showGifSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`} title="Envoyer un GIF">
          <Smile className="w-5 h-5" />
        </button>
        
        <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 p-2 hover:bg-violet-900/25 rounded-full transition-colors text-purple-300/60" title="Envoyer une photo">
          <Camera className="w-5 h-5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        
        <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message au cercle..." enterKeyHint="send" className="flex-1 min-w-0 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (photoFile) sendChatPhoto(); else sendChatText(); } }} />
        
        <button onClick={photoFile ? sendChatPhoto : sendChatText} disabled={chatSending || (!chatText.trim() && !photoFile)} aria-label="Envoyer" className="flex-shrink-0 p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {chatSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
