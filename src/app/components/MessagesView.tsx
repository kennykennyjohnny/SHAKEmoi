import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Send, Search, Music, Play, Loader2, ExternalLink, Users, Plus, Copy, Check, X, Settings, LogOut, Camera, Smile, Image, Heart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getConversations, getMessages, sendMessage, getUserFollowing,
  createCircle, getUserCircles, getCircleMessages, getCircleMembers,
  searchUsers, addCircleMember, removeCircleMember, getCurrentUser,
  sendCircleMessage, hasLikedPosts, likeCircleMessage, unlikeCircleMessage,
  hasLikedCircleMessage, getCircleMessageLikes, hasLikedCircleMessages,
  updateCirclePhoto
} from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';

interface MessagesViewProps {
  currentUser: any;
  onOpenCircle?: (circleId: string | null) => void;
  onCircleCreated?: (circleId: string) => void;
  viewOptions?: any;
}

export function MessagesView({ currentUser, onOpenCircle, onCircleCreated, viewOptions }: MessagesViewProps) {
  const { initialTab = 'circles' } = viewOptions || {};
  const [tab, setTab] = useState<'dms' | 'circles'>(initialTab);
  const [inSubView, setInSubView] = useState(false);
  const [fabTrigger, setFabTrigger] = useState(0);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-hidden min-h-0 relative">
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
              {t === 'dms' ? 'Messages' : 'Groupes'}
              {tab === t && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'dms'
        ? <DmsPanel currentUser={currentUser} onSubViewActive={setInSubView} fabTrigger={fabTrigger} />
        : <CirclesPanel currentUser={currentUser} onOpenCircle={onOpenCircle} onCircleCreated={onCircleCreated} onSubViewActive={setInSubView} fabTrigger={fabTrigger} />
      }

      {/* FAB — bouton + fixe en bas à droite, au-dessus de la nav bar */}
      {!inSubView && (
        <button
          onClick={() => setFabTrigger(n => n + 1)}
          className="fixed bottom-[5.5rem] right-5 lg:bottom-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-xl shadow-purple-900/60 flex items-center justify-center active:scale-95 transition-transform hover:opacity-90 z-50"
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
        <button onClick={onClose}><X className="w-4 h-4 text-purple-300/60" /></button>
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
              <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=2A1852&color=FFEFD5`} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
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

function DmsPanel({ currentUser, onSubViewActive, fabTrigger }: { currentUser: any; onSubViewActive?: (active: boolean) => void; fabTrigger?: number }) {
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
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!fabTrigger) return;
    setShowNewConvo(true);
    getUserFollowing(currentUser.id).then(setFriends).catch(() => {});
  }, [fabTrigger]);

  // Realtime subscription for DMs
  useEffect(() => {
    if (!activeConversation || !currentUser) return;
    const channel = supabase
      .channel(`dm-${currentUser.id}-${activeConversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const msg = payload.new;
        if (
          (msg.sender_id === activeConversation.id && msg.receiver_id === currentUser.id) ||
          (msg.sender_id === currentUser.id && msg.receiver_id === activeConversation.id)
        ) {
          setMessages(prev => {
            if (prev.some((m: any) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
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

  const loadConversations = async () => {
    setLoading(true);
    try { setConversations(await getConversations()); } catch {}
    setLoading(false);
  };

  const openConversation = async (partner: any) => {
    setActiveConversation(partner);
    setShowNewConvo(false);
    onSubViewActive?.(true);
    try { setMessages(await getMessages(partner.id)); } catch {}
  };

  const handleSend = async (track?: any) => {
    if (!activeConversation || (!track && !newMessage.trim())) return;
    const msgText = track ? null : newMessage.trim();
    // Optimistic: add message to list immediately
    const optimisticMsg: any = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser?.id,
      receiver_id: activeConversation.id,
      text: msgText,
      created_at: new Date().toISOString(),
      ...(track ? { track_name: track.name || track.track_name, artist: track.artist, cover_url: track.cover || track.cover_url, track_id: track.id } : {}),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setShowTrackSearch(false);
    setTrackQuery('');
    setTrackResults([]);
    setSending(true);
    try {
      await sendMessage(activeConversation.id, msgText || undefined, track || undefined);
    } catch {}
    setSending(false);
  };

  const handleSendImage = async (file: File) => {
    if (!activeConversation) return;
    setSending(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('circle-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('circle-media').getPublicUrl(fileName);
      const r = await sendMessage(activeConversation.id, undefined, undefined, publicUrl);
      if (r.success) setMessages(await getMessages(activeConversation.id));
    } catch (err) {
      console.error('Error uploading photo:', err);
    }
    setSending(false);
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  const handleSendGif = async (gifUrl: string) => {
    if (!activeConversation || !gifUrl) return;
    setSending(true);
    try {
      const r = await sendMessage(activeConversation.id, undefined, undefined, gifUrl);
      if (r.success) setMessages(await getMessages(activeConversation.id));
    } catch {}
    setSending(false);
    setShowGifSearch(false);
    setGifQuery('');
    setGifResults([]);
  };

  const handlePhotoSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Photo trop lourde (max 10 Mo)'); return; }
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
          const res = await fetch(`https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=shakemoi&limit=20&media_filter=tinygif,gif`);
          const data = await res.json();
          setGifResults(data.results || []);
        } catch { setGifResults([]); }
        setGifSearching(false);
      })();
      return;
    }
    const timer = setTimeout(async () => {
      setGifSearching(true);
      try {
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(gifQuery)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=shakemoi&limit=20&media_filter=tinygif,gif`);
        const data = await res.json();
        setGifResults(data.results || []);
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
        <div className="px-4 py-3 border-b border-purple-500/25 flex items-center gap-3 flex-shrink-0 bg-[#14092A]/95 backdrop-blur-sm">
          <button onClick={() => { setActiveConversation(null); onSubViewActive?.(false); }} className="p-1 hover:bg-violet-900/25 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={activeConversation.profile_album_cover_url || `https://ui-avatars.com/api/?name=${activeConversation.username}&background=2A1852&color=FFEFD5`} className="w-9 h-9 rounded-full object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{activeConversation.display_name || activeConversation.username}</p>
            <p className="text-xs text-purple-300/70">@{activeConversation.username}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-3 min-h-0">
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUser?.id;
            const isTrack = !!msg.track_name;
            const isStoryInteraction = !!msg.story_id;
            const isOpen = activeEmbedId === msg.id;
            const embedUrl = msg.track_id ? `https://open.spotify.com/embed/track/${msg.track_id}` : null;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl overflow-hidden ${isMine ? 'bg-purple-600/30 border border-purple-500/30' : 'bg-violet-950/25 border border-purple-500/25'}`}>
                  {/* Story interaction preview */}
                  {isStoryInteraction && !msg.text && (
                    <div className="px-3 py-2.5 text-center text-sm font-medium text-purple-100">
                      ❤️ liked your story
                    </div>
                  )}
                  {isStoryInteraction && msg.text?.startsWith('💭') && (
                    <div className="px-3 py-2 text-sm">
                      <p className="font-medium text-purple-200 mb-1">💭 commented on your story</p>
                      <p className="text-purple-100/80">{msg.text.replace('💭 Commentaire sur ', '').split(':\n')[1] || msg.text}</p>
                    </div>
                  )}
                  {msg.text && !msg.story_id && <p className="px-3 py-2 text-sm">{msg.text}</p>}
                  {msg.image_url && (
                    <div className="p-1">
                      <img src={msg.image_url} alt="" className="max-w-full max-h-64 rounded-xl object-cover" loading="lazy" />
                    </div>
                  )}
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
                          <p className="text-xs text-purple-200/70 truncate">{msg.artist}</p>
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
                              <ExternalLink className="w-3 h-3" /> Ouvrir dans mon app
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <p className={`px-3 pb-1.5 text-[10px] ${isMine ? 'text-purple-300/60 text-right' : 'text-purple-400/50'}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showTrackSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#14092A] max-h-60 overflow-y-auto flex-shrink-0">
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/70" />
                  <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son à envoyer..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
                </div>
                {trackResults.map((t: any) => (
                  <button key={t.id} onClick={() => handleSend(t)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
                    <img src={t.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-purple-200/70 truncate">{t.artist}</p></div>
                    <Send className="w-4 h-4 text-purple-400" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          {showGifSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-72 overflow-hidden border-t border-purple-500/25 bg-[#14092A] flex flex-col flex-shrink-0">
              <div className="p-3 pb-0">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                  <input autoFocus type="text" value={gifQuery} onChange={(e: any) => setGifQuery(e.target.value)} placeholder="Rechercher un GIF..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {gifSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
                <div className="grid grid-cols-2 gap-2">
                  {gifResults.map((gif: any) => (
                    <button key={gif.id} onClick={() => handleSendGif(gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url)} className="rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all">
                      <img src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {photoPreview && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-3 border-t border-purple-500/25 bg-[#14092A] flex-shrink-0">
              <div className="flex items-end gap-3">
                <div className="relative inline-block">
                  <img src={photoPreview} alt="Aperçu" className="max-h-40 rounded-lg object-cover" />
                  <button onClick={() => { setPhotoFile(null); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
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

        {createPortal(
          <div className="fixed bottom-[4.5rem] lg:bottom-0 left-0 right-0 z-40 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto bg-[#14092A] border-t border-purple-500/25 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
              <div className="px-3 py-2 flex items-center gap-2">
                <button onClick={() => { setShowTrackSearch(!showTrackSearch); setShowGifSearch(false); }} className={`p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}>
                  <Music className="w-5 h-5" />
                </button>
                <button onClick={() => { setShowGifSearch(!showGifSearch); setShowTrackSearch(false); }} className={`p-2 rounded-full transition-colors ${showGifSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}>
                  <Smile className="w-5 h-5" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-purple-900/40 text-purple-400 transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Envoie un message..." className="flex-1 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <button onClick={() => handleSend()} disabled={sending || !newMessage.trim()} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[4.5rem] lg:pb-4">
      {showNewConvo && (
        <NewConvoSearch
          friends={friends}
          onSelect={openConversation}
          onClose={() => setShowNewConvo(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : conversations.length > 0 ? (
        <div className="space-y-0.5">
          {conversations.map((c) => (
            <button key={c.partnerId} onClick={() => openConversation(c.partner)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-950/25 rounded-xl transition-colors">
              <div className="relative flex-shrink-0">
                <img
                  src={c.partner?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${c.partner?.username}&background=2A1852&color=FFEFD5`}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-purple-700/30"
                  alt=""
                />
                {c.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-pink-500 border-2 border-[#14092A] rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm truncate ${c.unreadCount > 0 ? 'font-bold text-white' : 'font-semibold text-white/90'}`}>
                  {c.partner?.display_name || c.partner?.username}
                </p>
                <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-purple-200/80 font-medium' : 'text-purple-300/60'}`}>
                  {c.lastMessage?.track_name ? `🎵 ${c.lastMessage.track_name}` : c.lastMessage?.text || '…'}
                </p>
              </div>
              <span className="text-[10px] text-purple-300/50 flex-shrink-0">
                {new Date(c.lastMessage?.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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

function CirclesPanel({ currentUser, onOpenCircle, onCircleCreated, onSubViewActive, fabTrigger }: { currentUser: any; onOpenCircle?: (circleId: string | null) => void; onCircleCreated?: (circleId: string) => void; onSubViewActive?: (active: boolean) => void; fabTrigger?: number }) {
  const [circles, setCircles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!fabTrigger) return;
    setShowCreate(true);
    onSubViewActive?.(true);
  }, [fabTrigger]);

  const load = async () => {
    setLoading(true);
    try {
      const circlesData = await getUserCircles();
      if (circlesData.length === 0) { setCircles([]); setLoading(false); return; }
      // Fetch last message timestamp per circle to sort by activity
      const circleIds = circlesData.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('circle_messages')
        .select('circle_id, created_at')
        .in('circle_id', circleIds)
        .order('created_at', { ascending: false });
      const lastActivity: Record<string, string> = {};
      (lastMsgs || []).forEach((m: any) => {
        if (!lastActivity[m.circle_id]) lastActivity[m.circle_id] = m.created_at;
      });
      const sorted = [...circlesData].sort((a: any, b: any) => {
        const aTime = lastActivity[a.id] || a.created_at;
        const bTime = lastActivity[b.id] || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      setCircles(sorted);
    } catch {}
    setLoading(false);
  };

  if (showCreate) {
    return <CreateCircleFlow currentUser={currentUser} onDone={() => { setShowCreate(false); onSubViewActive?.(false); load(); }} onCreated={(circle) => { setShowCreate(false); onSubViewActive?.(false); onCircleCreated?.(circle.id); }} onBack={() => { setShowCreate(false); onSubViewActive?.(false); }} />;
  }

  if (selectedCircleId) {
    const circle = circles.find(c => c.id === selectedCircleId);
    if (circle) {
      return <CircleView circle={circle} currentUser={currentUser} onBack={() => { setSelectedCircleId(null); onSubViewActive?.(false); }} />;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[4.5rem] lg:pb-4">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
      ) : circles.length > 0 ? (
        <div className="space-y-2">
          {circles.map((c) => (
            <button key={c.id} onClick={() => { setSelectedCircleId(c.id); onSubViewActive?.(true); }} className="w-full flex items-center gap-3 p-3 bg-violet-950/20 hover:bg-violet-950/30 rounded-xl border border-purple-500/25 transition-all">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                {c.photo_url ? (
                  <img src={c.photo_url} className="w-full h-full object-cover" alt="" />
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
        <button onClick={step === 1 ? onBack : () => setStep(s => (s - 1) as any)} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors">
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
                  <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=2A1852&color=FFEFD5`} className="w-4 h-4 rounded-full" alt="" />
                  @{f.username}
                  <button onClick={() => toggleFriend(f)} className="text-purple-300/60 hover:text-pink-400 ml-0.5"><X className="w-3 h-3" /></button>
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
                  <img src={f.profile_album_cover_url || `https://ui-avatars.com/api/?name=${f.username}&background=2A1852&color=FFEFD5`} className="w-9 h-9 rounded-full object-cover" alt="" />
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
  // Photo/GIF support in circles
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  // Likes system
  const [likedMessages, setLikedMessages] = useState<Record<string, boolean>>({});
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([getCircleMessages(circle.id), getCircleMembers(circle.id)]);
      setPosts(p);
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
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(gifQuery)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=shakemoi&limit=20&media_filter=tinygif,gif`);
        const data = await res.json();
        setGifResults(data.results || []);
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
        .upload(fileName, photoFile, { cacheControl: '3600', upsert: false });
      
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
    if (isLiked) {
      await unlikeCircleMessage(messageId);
    } else {
      await likeCircleMessage(messageId);
    }
    setLikedMessages(prev => ({ ...prev, [messageId]: !isLiked }));
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
    const user = await getCurrentUser();
    if (user) { await removeCircleMember(circle.id, user.id); onBack(); }
  };

  const handleCirclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo trop lourde (max 5 Mo)'); return; }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `circle-avatars/${circle.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('circle-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('circle-media').getPublicUrl(fileName);
      await updateCirclePhoto(circle.id, publicUrl);
      setCirclePhotoUrl(publicUrl);
    } catch (err) {
      console.error('Error uploading circle photo:', err);
    }
    setUploadingPhoto(false);
    if (e.target) e.target.value = '';
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
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Instagram-style: sticky circle header */}
      <div className="px-4 py-3 border-b border-purple-500/25 flex items-center gap-3 flex-shrink-0 bg-[#14092A]/95 backdrop-blur-sm">
        <button onClick={onBack} className="p-1 hover:bg-violet-900/25 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
          {circlePhotoUrl ? (
            <img src={circlePhotoUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{circle.name}</p>
          <p className="text-xs text-purple-300/60">{members.length} membre{members.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={copyLink} className={`p-2 rounded-full transition-colors ${copied ? 'text-fuchsia-400' : 'text-purple-300/60 hover:text-white hover:bg-violet-900/25'}`} title="Copier le lien d'invitation">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-violet-900/40 text-white' : 'text-purple-300/60 hover:text-white hover:bg-violet-900/25'}`}>
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-purple-500/25 bg-[#14092A] flex-shrink-0">
            <div className="p-4 space-y-3">
              {/* Group Photo */}
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                  {circlePhotoUrl ? (
                    <img src={circlePhotoUrl} className="w-full h-full object-cover" alt="" />
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
                    Photo du groupe
                  </button>
                  <input ref={circlePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleCirclePhotoUpload} />
                </div>
              </div>
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
                    <img src={m.profile_album_cover_url || `https://ui-avatars.com/api/?name=${m.username}&background=2A1852&color=FFEFD5`} className="w-4 h-4 rounded-full" alt="" />
                    @{m.username}
                    {m.id !== currentUser?.id && <button onClick={() => removeMember(m.id)} className="text-purple-300/60 hover:text-pink-400 ml-0.5"><X className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-300/60" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Ajouter un ami..." className="w-full pl-8 pr-3 py-2 bg-violet-950/20 border border-purple-500/25 rounded-lg text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500" />
              </div>
              {searchRes.filter(u => !members.find((m: any) => m.id === u.id)).slice(0, 4).map(u => (
                <button key={u.id} onClick={() => addMember(u.id)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg text-sm">
                  <img src={u.profile_album_cover_url || `https://ui-avatars.com/api/?name=${u.username}&background=2A1852&color=FFEFD5`} className="w-6 h-6 rounded-full" alt="" />
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
        ) : posts.length > 0 ? [...posts].reverse().map((msg: any) => {
          const trackId = msg.track_id || msg.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1] || null;
          const embedUrl = msg.spotify_embed_url || (trackId ? `https://open.spotify.com/embed/track/${trackId}` : null);
          const isOpen = activeEmbedId === msg.id;
          const user = msg.user;
          const isLiked = likedMessages[msg.id];
          const likersData = messageLikers[msg.id] || [];
          if (!msg.track_name && !msg.text && !msg.image_url) return null;
          return (
            <div key={msg.id} className={`rounded-xl border transition-all overflow-hidden group ${isOpen ? 'bg-violet-950/30 border-purple-600/30' : 'bg-violet-950/15 border-purple-500/20'}`}>
              <div className="p-2.5 flex items-center gap-2">
                <img src={user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user?.username}&background=2A1852&color=FFEFD5`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                <span className="text-xs font-medium text-purple-200/80">@{user?.username}</span>
                <span className="text-xs text-purple-300/60 ml-auto">{formatTs(msg.created_at)}</span>
              </div>
              
              {/* Text-only message */}
              {msg.text && !msg.track_name && !msg.image_url && <p className="px-3 pb-2.5 text-sm">{msg.text}</p>}
              
              {/* Photo/GIF message */}
              {msg.image_url && (
                <div className="px-2.5 pb-2">
                  <img src={msg.image_url} alt="" className="max-w-full max-h-64 rounded-xl object-cover" loading="lazy" />
                  {msg.text && <p className="text-xs text-purple-300/60 mt-1.5">{msg.text}</p>}
                </div>
              )}
              
              {/* Track message */}
              {msg.track_name && (
                <div className="px-2.5 pb-2">
                  <div className="flex gap-2 items-center cursor-pointer group/track" onClick={() => setActiveEmbedId(isOpen ? null : msg.id)}>
                    <div className="relative flex-shrink-0">
                      <img src={msg.cover_url} alt="" className="w-11 h-11 rounded-lg object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/track:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{msg.track_name}</p>
                      <p className="text-xs text-purple-200/60 truncate">{msg.artist}</p>
                      {msg.text && <p className="text-xs text-purple-300/60 truncate mt-0.5 italic">"{msg.text}"</p>}
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
                      <img src={liker.profile_album_cover_url || `https://ui-avatars.com/api/?name=${liker.username}&background=2A1852&color=FFEFD5`} className="w-4 h-4 rounded-full object-cover" alt="" />
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
            <img src={photoPreview} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <button onClick={() => { setPhotoPreview(null); setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 hover:bg-red-600">
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <p className="text-xs text-purple-300/60">Photo prête à envoyer</p>
            <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Ajouter une légende..." className="w-full px-2 py-1 bg-violet-950/20 border border-purple-500/30 rounded-lg text-xs text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
          </div>
          <button onClick={sendChatPhoto} disabled={chatSending} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Track search overlay */}
      <AnimatePresence>
        {showTrackSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#14092A] max-h-52 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={trackQuery} onChange={e => setTrackQuery(e.target.value)} placeholder="Rechercher un son..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {trackResults.map((t: any) => (
                <button key={t.id} onClick={() => sendChatTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-violet-900/25 rounded-lg transition-colors">
                  <img src={t.cover} alt="" className="w-9 h-9 rounded-md object-cover" />
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-purple-500/25 bg-[#14092A] max-h-52 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                <input autoFocus type="text" value={gifQuery} onChange={e => setGifQuery(e.target.value)} placeholder="Chercher un GIF..." className="w-full pl-9 pr-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" />
              </div>
              {gifSearching ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-purple-500 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {gifResults.map((g: any) => (
                    <button key={g.id} onClick={() => sendChatGif(g.media_formats.tinygif.url)} className="relative group overflow-hidden rounded-lg">
                      <img src={g.media_formats.tinygif.url} alt="" className="w-full aspect-square object-cover" />
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
      <div className="px-3 py-2.5 pb-[calc(0.625rem+4.5rem)] lg:pb-2.5 border-t border-purple-500/25 flex items-center gap-2 flex-shrink-0 bg-[#14092A]/95 backdrop-blur-lg">
        <button onClick={() => setShowTrackSearch(!showTrackSearch)} className={`p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`} title="Partager un son">
          <Music className="w-5 h-5" />
        </button>
        
        <button onClick={() => setShowGifSearch(!showGifSearch)} className={`p-2 rounded-full transition-colors ${showGifSearch ? 'bg-purple-500 text-white' : 'hover:bg-violet-900/25 text-purple-300/60'}`} title="Envoyer un GIF">
          <Smile className="w-5 h-5" />
        </button>
        
        <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors text-purple-300/60" title="Envoyer une photo">
          <Camera className="w-5 h-5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        
        <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message au cercle..." className="flex-1 px-3 py-2 bg-violet-950/20 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (photoFile) sendChatPhoto(); else sendChatText(); } }} />
        
        <button onClick={photoFile ? sendChatPhoto : sendChatText} disabled={chatSending || (!chatText.trim() && !photoFile)} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {chatSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
