import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, Music, Play, Loader2, Headphones, Users, Plus, Copy, Check, X, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getConversations, getMessages, sendMessage, getUserFollowing,
  createCircle, getUserCircles, getCircleFeed, getCircleMembers,
  searchUsers, addCircleMember, removeCircleMember, getCurrentUser,
  createPost
} from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';

interface MessagesViewProps {
  currentUser: any;
  onOpenCircle?: (circleId: string | null) => void;
  onCircleCreated?: (circleId: string) => void;
  viewOptions?: any;
}

export function MessagesView({ currentUser, onOpenCircle, onCircleCreated, viewOptions }: MessagesViewProps) {
  const { initialTab = 'dms' } = viewOptions || {};
  const [tab, setTab] = useState<'dms' | 'circles'>(initialTab);

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-rose-800/25 px-4 pt-3 gap-6">
        {(['dms', 'circles'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-sm font-semibold transition-colors relative ${tab === t ? 'text-white' : 'text-rose-300/50 hover:text-white'}`}
          >
            {t === 'dms' ? 'Messages' : 'Cercles'}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'dms'
        ? <DmsPanel currentUser={currentUser} />
        : <CirclesPanel currentUser={currentUser} onOpenCircle={onOpenCircle} onCircleCreated={onCircleCreated} />
      }
    </div>
  );
}

// ==================== DMs ====================

function DmsPanel({ currentUser }: { currentUser: any }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (trackQuery.length < 2) { setTrackResults([]); return; }
    const t = setTimeout(async () => {
      try { setTrackResults(await spotify.searchTracks(trackQuery)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [trackQuery]);

  const loadConversations = async () => {
    setLoading(true);
    try { setConversations(await getConversations()); } catch {}
    setLoading(false);
  };

  const openConversation = async (partner: any) => {
    setActiveConversation(partner);
    setShowNewConvo(false);
    try { setMessages(await getMessages(partner.id)); } catch {}
  };

  const handleSend = async (track?: any) => {
    if (!activeConversation || (!track && !newMessage.trim())) return;
    setSending(true);
    try {
      const r = await sendMessage(activeConversation.id, track ? null : newMessage.trim(), track || undefined);
      if (r.success) {
        setNewMessage('');
        setShowTrackSearch(false);
        setTrackQuery('');
        setTrackResults([]);
        setMessages(await getMessages(activeConversation.id));
      }
    } catch {}
    setSending(false);
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (activeConversation) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-rose-800/25 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setActiveConversation(null)} className="p-1 hover:bg-rose-900/25 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={activeConversation.profile_album_cover_url || `https://ui-avatars.com/api/?name=${activeConversation.username}&background=random`} className="w-9 h-9 rounded-full object-cover" alt="" />
          <div>
            <p className="font-semibold text-sm">{activeConversation.display_name || activeConversation.username}</p>
            <p className="text-xs text-rose-300/70">@{activeConversation.username}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUser?.id;
            const isTrack = !!msg.track_name;
            const isOpen = activeEmbedId === msg.id;
            const embedUrl = msg.track_id ? `https://open.spotify.com/embed/track/${msg.track_id}` : null;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl overflow-hidden ${isMine ? 'bg-purple-600/30 border border-purple-500/30' : 'bg-rose-950/25 border border-rose-800/25'}`}>
                  {msg.text && <p className="px-3 py-2 text-sm">{msg.text}</p>}
                  {isTrack && (
                    <div className="p-2">
                      <div className="flex gap-2 items-center cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : msg.id)}>
                        <div className="relative flex-shrink-0">
                          <img src={msg.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{msg.track_name}</p>
                          <p className="text-xs text-rose-200/70 truncate">{msg.artist}</p>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isOpen && embedUrl && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                            <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                            <button
                              onClick={(e) => { e.stopPropagation(); const url = getPlatformUrl({ spotify_url: msg.spotify_url, apple_music_url: msg.apple_music_url, deezer_url: msg.deezer_url, youtube_url: msg.youtube_url, youtube_music_url: msg.youtube_music_url, tidal_url: msg.tidal_url, odesli_page_url: msg.odesli_page_url }, currentUser?.musicService || 'spotify'); if (url) window.open(url, '_blank'); }}
                              className="w-full mt-1 py-1.5 flex items-center justify-center gap-1.5 bg-purple-600/20 rounded-lg text-xs font-medium hover:bg-purple-600/30 transition-colors"
                            >
                              <Headphones className="w-3 h-3" /> Ouvrir dans mon app
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <p className={`px-3 pb-1.5 text-[10px] ${isMine ? 'text-purple-300/40 text-right' : 'text-purple-400/30'}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showTrackSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-rose-800/25 bg-[#0a0012] max-h-60 overflow-y-auto flex-shrink-0">
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/70" />
                  <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son à envoyer..." className="w-full pl-9 pr-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500" />
                </div>
                {trackResults.map((t: any) => (
                  <button key={t.id} onClick={() => handleSend(t)} className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors">
                    <img src={t.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-rose-200/70 truncate">{t.artist}</p></div>
                    <Send className="w-4 h-4 text-purple-400" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 py-3 border-t border-rose-800/25 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowTrackSearch(!showTrackSearch)} className={`p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}>
            <Music className="w-5 h-5" />
          </button>
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Envoie un message..." className="flex-1 px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-full text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button onClick={() => handleSend()} disabled={sending || !newMessage.trim()} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Messages directs</h2>
        <button onClick={() => { setShowNewConvo(true); getUserFollowing(currentUser.id).then(setFriends).catch(() => {}); }} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nouveau
        </button>
      </div>

      {showNewConvo && (
        <div className="mb-4 bg-rose-950/20 rounded-xl border border-rose-800/25 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Envoyer à :</p>
            <button onClick={() => setShowNewConvo(false)}><X className="w-4 h-4 text-rose-300/50" /></button>
          </div>
          {friends.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {friends.map((f: any) => (
                <button key={f.id} onClick={() => openConversation(f)} className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors">
                  <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=random`} className="w-8 h-8 rounded-full object-cover" alt="" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{f.display_name || f.username}</p>
                    <p className="text-xs text-rose-300/70">@{f.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="text-xs text-rose-300/50">Aucun ami pour l'instant</p>}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : conversations.length > 0 ? (
        <div className="space-y-1">
          {conversations.map((c) => (
            <button key={c.partnerId} onClick={() => openConversation(c.partner)} className="w-full flex items-center gap-3 p-3 hover:bg-rose-950/20 rounded-xl transition-colors">
              <div className="relative">
                <img src={c.partner?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${c.partner?.username}&background=random`} className="w-12 h-12 rounded-full object-cover" alt="" />
                {c.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center">{c.unreadCount}</span>}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm">{c.partner?.display_name || c.partner?.username}</p>
                <p className="text-xs text-rose-200/70 truncate">{c.lastMessage?.track_name ? `🎵 ${c.lastMessage.track_name}` : c.lastMessage?.text || '...'}</p>
              </div>
              <span className="text-xs text-rose-300/50">{new Date(c.lastMessage?.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Send className="w-10 h-10 text-purple-600 mx-auto mb-2" />
          <p className="text-rose-200/70 text-sm">Aucune conversation</p>
          <p className="text-purple-400/30 text-xs mt-1">Envoie un son à un ami !</p>
        </div>
      )}
    </div>
  );
}

// ==================== Cercles ====================

function CirclesPanel({ currentUser, onOpenCircle, onCircleCreated }: { currentUser: any; onOpenCircle?: (circleId: string | null) => void; onCircleCreated?: (circleId: string) => void }) {
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setCircles(await getUserCircles()); } catch {}
    setLoading(false);
  };

  if (showCreate) {
    return <CreateCircleFlow currentUser={currentUser} onDone={() => { setShowCreate(false); load(); }} onCreated={(circle) => { setShowCreate(false); onCircleCreated?.(circle.id); }} onBack={() => setShowCreate(false)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Mes Cercles</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nouveau cercle
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : circles.length > 0 ? (
        <div className="space-y-2">
          {circles.map((c) => (
            <button key={c.id} onClick={() => onOpenCircle?.(c.id)} className="w-full flex items-center gap-3 p-3 bg-rose-950/20 hover:bg-rose-950/30 rounded-xl border border-rose-800/25 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-rose-300/60">{c.invite_code ? `Code: ${c.invite_code}` : 'Cercle privé'}</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-rose-300/40 rotate-180" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-full flex items-center justify-center border border-purple-700/20">
            <Users className="w-9 h-9 text-purple-400/60" />
          </div>
          <p className="text-rose-200/70 text-sm font-medium">Aucun cercle</p>
          <p className="text-purple-400/40 text-xs mt-1">Crée un espace privé avec tes amis</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90">
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
    setCreating(true);
    setCreateError('');
    try {
      const r = await createCircle(name.trim());
      if (r.success) {
        setCreatedCircle(r.data);
        setStep(2);
      } else {
        setCreateError(r.error || 'Erreur lors de la création');
      }
    } catch (e: any) {
      setCreateError(e?.message || 'Erreur inconnue');
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

  const shareLink = createdCircle ? `${window.location.origin}${window.location.pathname}#/circle/${createdCircle.id}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={step === 1 ? onBack : () => setStep(s => (s - 1) as any)} className="p-2 hover:bg-rose-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-bold text-lg">Nouveau cercle</h2>
          <p className="text-xs text-rose-300/50">Étape {step}/3</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1.5 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-rose-900/30'}`} />
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
            <p className="text-sm text-rose-300/60 mt-1">Un espace privé pour partager de la musique</p>
          </div>
          <input
            autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Ex: Les potes du lycée, Crew 94..."
            className="w-full px-4 py-3 bg-rose-950/20 border border-rose-800/30 rounded-xl text-white placeholder-rose-300/40 focus:outline-none focus:border-purple-500 text-center text-lg font-medium"
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleCreate()}
          />
          {createError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">{createError}</p>
          )}
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Créer le cercle →'}
          </button>
        </motion.div>
      )}

      {/* Step 2 — Add friends */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className="text-center py-2">
            <h3 className="font-bold text-lg">Ajoute des amis</h3>
            <p className="text-sm text-rose-300/60 mt-1">Qui intègre <span className="text-white font-medium">{createdCircle?.name}</span> ?</p>
          </div>

          {selectedFriends.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-rose-950/15 rounded-xl border border-rose-800/20">
              {selectedFriends.map(f => (
                <span key={f.id} className="flex items-center gap-1 bg-purple-600/20 border border-purple-500/30 rounded-full px-2.5 py-1 text-xs">
                  <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=random`} className="w-4 h-4 rounded-full" alt="" />
                  @{f.username}
                  <button onClick={() => toggleFriend(f)} className="text-rose-300/50 hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
            <input type="text" value={friendSearch} onChange={e => setFriendSearch(e.target.value)} placeholder="Rechercher un ami..." className="w-full pl-9 pr-3 py-2.5 bg-rose-950/20 border border-rose-800/30 rounded-xl text-sm text-white placeholder-rose-300/40 focus:outline-none focus:border-purple-500" />
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {(friendSearch.length > 0 ? friendResults : friends).map((f: any) => {
              const selected = !!selectedFriends.find(x => x.id === f.id);
              return (
                <button key={f.id} onClick={() => toggleFriend(f)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${selected ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-rose-900/25 border border-transparent'}`}>
                  <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=random`} className="w-9 h-9 rounded-full object-cover" alt="" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium">{f.display_name || f.username}</p>
                    <p className="text-xs text-rose-300/60">@{f.username}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-purple-500 border-purple-500' : 'border-rose-600/40'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
            {friends.length === 0 && <p className="text-center text-xs text-rose-300/40 py-4">Aucun ami à ajouter</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep(3)} className="flex-1 py-3 bg-rose-950/20 border border-rose-800/25 rounded-xl text-sm text-rose-300/60 hover:text-white transition-colors">
              Passer
            </button>
            <button onClick={handleAddMembers} disabled={addingMembers || selectedFriends.length === 0} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 text-sm">
              {addingMembers ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Ajouter (${selectedFriends.length}) →`}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3 — Share */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 text-center">
          <div className="py-4">
            <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-green-500/30 to-purple-500/30 rounded-full flex items-center justify-center border border-green-500/30">
              <Check className="w-9 h-9 text-green-400" />
            </div>
            <h3 className="font-bold text-xl text-green-400">Cercle créé !</h3>
            <p className="text-sm text-rose-300/60 mt-1">
              <span className="text-white font-semibold">{createdCircle?.name}</span> est prêt
              {selectedFriends.length > 0 && ` · ${selectedFriends.length} membre${selectedFriends.length > 1 ? 's' : ''} ajouté${selectedFriends.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Invite Code — big and prominent */}
          {createdCircle?.invite_code && (
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-rose-300/50 mb-1 font-medium uppercase tracking-wider">Code du cercle</p>
              <p className="text-3xl font-black tracking-[0.3em] text-white font-mono select-all">{createdCircle.invite_code}</p>
              <p className="text-xs text-rose-300/40 mt-2">Tes amis peuvent chercher ce code dans l'onglet Recherche pour rejoindre</p>
            </div>
          )}

          <div className="bg-rose-950/20 border border-rose-800/25 rounded-xl p-4 text-left">
            <p className="text-xs text-rose-300/50 mb-2 font-medium uppercase tracking-wider">Lien d'invitation</p>
            <p className="text-xs font-mono text-white/70 break-all leading-relaxed mb-3 select-all">{shareLink}</p>
            <button onClick={copyLink} className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30'}`}>
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

function CircleView({ circle, currentUser, onBack }: { circle: any; currentUser: any; onBack: () => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([getCircleFeed(circle.id), getCircleMembers(circle.id)]);
      setPosts(p);
      setMembers(m);
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

  const sendChatText = async () => {
    if (!chatText.trim() || chatSending) return;
    setChatSending(true);
    try {
      await createPost('', '', '', chatText.trim(), null, null, null, false, circle?.id);
      setChatText('');
      await loadData();
    } catch {}
    setChatSending(false);
  };

  const sendChatTrack = async (track: any) => {
    setChatSending(true);
    try {
      await createPost(track.name, track.artist, track.cover, '', track.preview_url, track.spotify_url, track.id, false, circle?.id);
      setShowTrackSearch(false);
      setTrackQuery('');
      setTrackResults([]);
      await loadData();
    } catch {}
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
    const user = await getCurrentUser();
    if (user) { await removeCircleMember(circle.id, user.id); onBack(); }
  };

  const shareLink = `${window.location.origin}${window.location.pathname}#/circle/${circle.id}`;
  const [copied, setCopied] = useState(false);
  const copyLink = () => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const formatTs = (ts: string) => {
    const d = new Date(ts), now = new Date(), diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'À l\'instant';
    if (diff < 60) return `${diff}min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}j`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Circle header */}
      <div className="px-4 py-3 border-b border-rose-800/25 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-rose-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{circle.name}</p>
          <p className="text-xs text-rose-300/60">{members.length} membre{members.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={copyLink} className={`p-2 rounded-full transition-colors ${copied ? 'text-green-400' : 'text-rose-300/50 hover:text-white hover:bg-rose-900/25'}`} title="Copier le lien d'invitation">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-rose-900/40 text-white' : 'text-rose-300/50 hover:text-white hover:bg-rose-900/25'}`}>
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-rose-800/25 bg-[#0a0012] flex-shrink-0">
            <div className="p-4 space-y-3">
              {/* Invite Code */}
              {circle.invite_code && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-rose-300/40 uppercase tracking-wider mb-1">Code d'invitation</p>
                  <p className="text-xl font-black tracking-[0.25em] text-white font-mono select-all">{circle.invite_code}</p>
                </div>
              )}
              <p className="text-xs font-semibold text-rose-300/50 uppercase tracking-wider">Membres ({members.length})</p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <span key={m.id} className="flex items-center gap-1 bg-rose-950/30 rounded-full px-2.5 py-1 text-xs border border-rose-800/20">
                    <img src={m.profile_album_cover_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`} className="w-4 h-4 rounded-full" alt="" />
                    @{m.username}
                    {m.id !== currentUser?.id && <button onClick={() => removeMember(m.id)} className="text-rose-300/40 hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-300/40" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Ajouter un ami..." className="w-full pl-8 pr-3 py-2 bg-rose-950/20 border border-rose-800/25 rounded-lg text-sm text-white placeholder-rose-300/40 focus:outline-none focus:border-purple-500" />
              </div>
              {searchRes.filter(u => !members.find((m: any) => m.id === u.id)).slice(0, 4).map(u => (
                <button key={u.id} onClick={() => addMember(u.id)} className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg text-sm">
                  <img src={u.profile_album_cover_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`} className="w-6 h-6 rounded-full" alt="" />
                  @{u.username}
                  <span className="ml-auto text-purple-400 text-xs">+ Ajouter</span>
                </button>
              ))}
              <button onClick={leaveCircle} className="flex items-center gap-2 text-red-400/70 hover:text-red-400 text-sm transition-colors">
                <LogOut className="w-4 h-4" /> Quitter ce cercle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
        ) : posts.length > 0 ? posts.map((post: any) => {
          const trackId = post.track_id || post.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null;
          const embedUrl = post.spotify_embed_url || (trackId ? `https://open.spotify.com/embed/track/${trackId}` : null);
          const isOpen = activeEmbedId === post.id;
          const user = post.user;
          if (!post.track_name && !post.text) return null;
          return (
            <div key={post.id} className={`rounded-xl border transition-all overflow-hidden ${isOpen ? 'bg-rose-950/30 border-purple-600/30' : 'bg-rose-950/15 border-rose-800/20'}`}>
              <div className="p-2.5 flex items-center gap-2">
                <img src={user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user?.username}&background=random`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                <span className="text-xs font-medium text-rose-200/80">@{user?.username}</span>
                <span className="text-xs text-rose-300/40 ml-auto">{formatTs(post.created_at)}</span>
              </div>
              {post.text && !post.track_name && <p className="px-3 pb-2.5 text-sm">{post.text}</p>}
              {post.track_name && (
                <div className="px-2.5 pb-2">
                  <div className="flex gap-2 items-center cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : post.id)}>
                    <div className="relative flex-shrink-0">
                      <img src={post.cover_url} alt="" className="w-11 h-11 rounded-lg object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{post.track_name}</p>
                      <p className="text-xs text-rose-200/60 truncate">{post.artist}</p>
                      {post.text && <p className="text-xs text-rose-300/50 truncate mt-0.5 italic">"{post.text}"</p>}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isOpen && embedUrl && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                        <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="text-center py-12">
            <Music className="w-10 h-10 text-purple-600/40 mx-auto mb-2" />
            <p className="text-rose-300/50 text-sm">Aucun shake dans ce cercle</p>
            <p className="text-rose-300/30 text-xs mt-1">Partage un son ci-dessous !</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Track search overlay */}
      <AnimatePresence>
        {showTrackSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-rose-800/25 bg-[#0a0012] max-h-52 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son..." className="w-full pl-9 pr-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {trackResults.map((t: any) => (
                <button key={t.id} onClick={() => sendChatTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors">
                  <img src={t.cover} alt="" className="w-9 h-9 rounded-md object-cover" />
                  <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-rose-200/70 truncate">{t.artist}</p></div>
                  <Send className="w-4 h-4 text-purple-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat bar */}
      <div className="px-3 py-2.5 border-t border-rose-800/25 flex items-center gap-2 flex-shrink-0 bg-[#0a0012]/95 backdrop-blur-lg">
        <button onClick={() => setShowTrackSearch(!showTrackSearch)} className={`p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-rose-900/25 text-rose-300/60'}`}>
          <Music className="w-5 h-5" />
        </button>
        <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message au cercle..." className="flex-1 px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-full text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatText(); } }} />
        <button onClick={sendChatText} disabled={chatSending || !chatText.trim()} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {chatSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
