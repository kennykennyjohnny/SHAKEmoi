import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, Music, Play, Loader2, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getConversations, getMessages, sendMessage, getUserFollowing, createCircle } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';

interface MessagesViewProps {
  currentUser: any;
}

export function MessagesView({ currentUser }: MessagesViewProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [searchingTracks, setSearchingTracks] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [createdCircle, setCreatedCircle] = useState<any>(null);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const convos = await getConversations();
      setConversations(convos);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (partner: any) => {
    setActiveConversation(partner);
    setShowNewConvo(false);
    try {
      const msgs = await getMessages(partner.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSend = async (track?: any) => {
    if (!activeConversation) return;
    if (!track && !newMessage.trim()) return;

    setSending(true);
    try {
      const result = await sendMessage(
        activeConversation.id,
        track ? null : newMessage.trim(),
        track || undefined
      );
      if (result.success) {
        setNewMessage('');
        setShowTrackSearch(false);
        setTrackQuery('');
        setTrackResults([]);
        const msgs = await getMessages(activeConversation.id);
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const searchTracks = async () => {
    if (trackQuery.length < 2) return;
    setSearchingTracks(true);
    try {
      const tracks = await spotify.searchTracks(trackQuery);
      setTrackResults(tracks);
    } catch (err) {
      console.error('Error searching tracks:', err);
    } finally {
      setSearchingTracks(false);
    }
  };

  useEffect(() => {
    if (trackQuery.length < 2) { setTrackResults([]); return; }
    const timer = setTimeout(searchTracks, 400);
    return () => clearTimeout(timer);
  }, [trackQuery]);

  const loadFriends = async () => {
    try {
      const following = await getUserFollowing(currentUser.id);
      setFriends(following);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const startNewConvo = () => {
    setShowNewConvo(true);
    setShowCreateCircle(false);
    setShowNewMenu(false);
    loadFriends();
  };

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return;
    setCreatingCircle(true);
    try {
      const result = await createCircle(newCircleName.trim());
      if (result.success) {
        setCreatedCircle(result.data);
        setNewCircleName('');
      }
    } catch (err) {
      console.error('Error creating circle:', err);
    }
    setCreatingCircle(false);
  };

  const openInMusicApp = (msg: any) => {
    const platform = currentUser?.musicService || 'spotify';
    const links = {
      spotify_url: msg.spotify_url,
      apple_music_url: msg.apple_music_url,
      deezer_url: msg.deezer_url,
      youtube_url: msg.youtube_url,
      youtube_music_url: msg.youtube_music_url,
      tidal_url: msg.tidal_url,
      odesli_page_url: msg.odesli_page_url,
    };
    const url = getPlatformUrl(links, platform);
    if (url) window.open(url, '_blank');
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Conversation list
  if (!activeConversation) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Messages</h2>
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90"
            >
              Nouveau
            </button>
            {showNewMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-[#0f0020] border border-rose-800/25 rounded-xl shadow-xl z-20 overflow-hidden">
                <button
                  onClick={startNewConvo}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-rose-900/25 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Nouveau message
                </button>
                <button
                  onClick={() => { setShowCreateCircle(true); setShowNewConvo(false); setShowNewMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-rose-900/25 transition-colors flex items-center gap-2"
                >
                  <Music className="w-4 h-4" />
                  Nouveau cercle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Create circle */}
        {showCreateCircle && (
          <div className="mb-4 bg-rose-950/20 rounded-xl border border-rose-800/25 p-3">
            {createdCircle ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-green-400">Cercle cree !</p>
                <p className="text-xs text-rose-200/70">Nom: {createdCircle.name}</p>
                <p className="text-xs text-rose-200/70">ID: {createdCircle.id}</p>
                <div className="bg-rose-950/20 border border-rose-800/25 rounded-lg p-2">
                  <p className="text-[10px] text-rose-300/50 mb-1">Lien de partage (bientot QR code)</p>
                  <p className="text-xs text-white font-mono break-all select-all">{`${window.location.origin}#/circle/${createdCircle.id}`}</p>
                </div>
                <button
                  onClick={() => { setShowCreateCircle(false); setCreatedCircle(null); }}
                  className="w-full py-2 text-sm text-rose-300/60 hover:text-white transition-colors"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-rose-200/70 mb-2">Creer un nouveau cercle :</p>
                <input
                  type="text"
                  value={newCircleName}
                  onChange={(e) => setNewCircleName(e.target.value)}
                  placeholder="Nom du cercle..."
                  className="w-full px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCircle()}
                  autoFocus
                />
                <button
                  onClick={handleCreateCircle}
                  disabled={creatingCircle || !newCircleName.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {creatingCircle ? 'Creation...' : 'Creer le cercle'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* New conversation: pick a friend */}
        {showNewConvo && (
          <div className="mb-4 bg-rose-950/20 rounded-xl border border-rose-800/25 p-3">
            <p className="text-sm text-rose-200/70 mb-2">Envoyer un message à :</p>
            {friends.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {friends.map((friend: any) => (
                  <button
                    key={friend.id}
                    onClick={() => openConversation(friend)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors"
                  >
                    <img
                      src={friend.profile_album_cover_url || `https://ui-avatars.com/api/?name=${friend.username}&background=random`}
                      className="w-8 h-8 rounded-full object-cover"
                      alt=""
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium">{friend.display_name || friend.username}</p>
                      <p className="text-xs text-rose-300/70">@{friend.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-300/50">Aucun ami pour l'instant</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((convo) => (
              <button
                key={convo.partnerId}
                onClick={() => openConversation(convo.partner)}
                className="w-full flex items-center gap-3 p-3 hover:bg-rose-950/20 rounded-xl transition-colors"
              >
                <div className="relative">
                  <img
                    src={convo.partner?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${convo.partner?.username}&background=random`}
                    className="w-12 h-12 rounded-full object-cover"
                    alt=""
                  />
                  {convo.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                      {convo.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm">{convo.partner?.display_name || convo.partner?.username}</p>
                  <p className="text-xs text-rose-200/70 truncate">
                    {convo.lastMessage?.track_name
                      ? `🎵 ${convo.lastMessage.track_name}`
                      : convo.lastMessage?.text || '...'}
                  </p>
                </div>
                <span className="text-xs text-rose-300/50">
                  {formatTime(convo.lastMessage?.created_at)}
                </span>
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

  // Active conversation
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-full">
      {/* Conversation header */}
      <div className="px-4 py-3 border-b border-rose-800/25 flex items-center gap-3">
        <button onClick={() => setActiveConversation(null)} className="p-1 hover:bg-purple-900/40 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img
          src={activeConversation.profile_album_cover_url || `https://ui-avatars.com/api/?name=${activeConversation.username}&background=random`}
          className="w-9 h-9 rounded-full object-cover"
          alt=""
        />
        <div>
          <p className="font-semibold text-sm">{activeConversation.display_name || activeConversation.username}</p>
          <p className="text-xs text-rose-300/70">@{activeConversation.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUser?.id;
          const isTrack = !!msg.track_name;
          const isEmbedOpen = activeEmbedId === msg.id;
          const embedUrl = msg.track_id ? `https://open.spotify.com/embed/track/${msg.track_id}` : null;

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl overflow-hidden ${
                isMine
                  ? 'bg-purple-600/30 border border-purple-500/30'
                  : 'bg-rose-950/25 border border-rose-800/25'
              }`}>
                {/* Text message */}
                {msg.text && (
                  <p className="px-3 py-2 text-sm">{msg.text}</p>
                )}

                {/* Track message */}
                {isTrack && (
                  <div className="p-2">
                    <div
                      className="flex gap-2 items-center cursor-pointer group"
                      onClick={() => setActiveEmbedId(isEmbedOpen ? null : msg.id)}
                    >
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
                      {isEmbedOpen && embedUrl && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-2"
                        >
                          <iframe
                            src={`${embedUrl}?theme=0`}
                            width="100%" height="152" frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy" className="rounded-xl"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); openInMusicApp(msg); }}
                            className="w-full mt-1 py-1.5 flex items-center justify-center gap-1.5 bg-purple-600/20 rounded-lg text-xs font-medium hover:bg-purple-600/30 transition-colors"
                          >
                            <Headphones className="w-3 h-3" />
                            Ouvrir dans mon app
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <p className={`px-3 pb-1.5 text-[10px] ${isMine ? 'text-purple-300/40 text-right' : 'text-purple-400/30'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Track search overlay */}
      <AnimatePresence>
        {showTrackSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-rose-800/25 bg-[#0a0012] max-h-60 overflow-y-auto"
          >
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/70" />
                <input
                  type="text"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  placeholder="Rechercher un son à envoyer..."
                  className="w-full pl-9 pr-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              {searchingTracks && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
              {trackResults.map((track: any) => (
                <button
                  key={track.id}
                  onClick={() => handleSend(track)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors"
                >
                  <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <p className="text-xs text-rose-200/70 truncate">{track.artist}</p>
                  </div>
                  <Send className="w-4 h-4 text-purple-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-rose-800/25 flex items-center gap-2">
        <button
          onClick={() => setShowTrackSearch(!showTrackSearch)}
          className={`p-2 rounded-full transition-colors ${showTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-purple-900/40 text-purple-400'}`}
        >
          <Music className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Envoie un message..."
          className="flex-1 px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-full text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button
          onClick={() => handleSend()}
          disabled={sending || !newMessage.trim()}
          className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
