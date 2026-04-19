import { useState, useEffect } from 'react';
import { X, Send, Loader2, Music, Search, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPostComments, addComment, getMusicReactions, addMusicReaction } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';

interface CommentsDialogProps {
  postId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
  currentUser?: any;
}

export function CommentsDialog({ postId, onClose, onCommentAdded, currentUser }: CommentsDialogProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [musicReactions, setMusicReactions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'comments' | 'music'>('comments');

  // Music reaction states
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [musicComment, setMusicComment] = useState('');
  const [musicSending, setMusicSending] = useState(false);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
    loadMusicReactions();
  }, [postId]);

  useEffect(() => {
    if (musicQuery.length < 2) { setMusicResults([]); return; }
    const t = setTimeout(async () => {
      setMusicSearching(true);
      try { setMusicResults(await spotify.searchTracks(musicQuery)); } catch {}
      setMusicSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [musicQuery]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await getPostComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMusicReactions = async () => {
    try {
      setMusicReactions(await getMusicReactions(postId));
    } catch {}
  };

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const result = await addComment(postId, newComment.trim());
      if (result.success) {
        setNewComment('');
        await loadComments();
        onCommentAdded?.();
      }
    } catch (error) {
      console.error('Error sending comment:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMusicReaction = async (track: any) => {
    setMusicSending(true);
    try {
      const r = await addMusicReaction(postId, track, musicComment);
      if (r.success) { setSelectedTrack(null); setMusicComment(''); setMusicQuery(''); setMusicResults([]); await loadMusicReactions(); }
    } catch {}
    setMusicSending(false);
  };

  const openInApp = (r: any) => {
    const url = getPlatformUrl({ spotify_url: r.spotify_url, apple_music_url: r.apple_music_url, deezer_url: r.deezer_url, youtube_url: r.youtube_url, youtube_music_url: r.youtube_music_url, tidal_url: r.tidal_url, odesli_page_url: r.odesli_page_url }, currentUser?.musicService || 'spotify');
    if (url) window.open(url, '_blank');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}j`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1D0F3D] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col border border-purple-500/30 mb-[4.5rem] sm:mb-0"
      >
        {/* Header with tabs */}
        <div className="border-b border-purple-800/20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setTab('comments')}
                className={`font-bold text-sm transition-colors ${tab === 'comments' ? 'text-white' : 'text-purple-400/50 hover:text-purple-300'}`}
              >
                Commentaires ({comments.length})
              </button>
              <button
                onClick={() => setTab('music')}
                className={`font-bold text-sm transition-colors flex items-center gap-1.5 ${tab === 'music' ? 'text-pink-400' : 'text-purple-400/50 hover:text-purple-300'}`}
              >
                <Music className="w-4 h-4" />
                Sons ({musicReactions.length})
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
              <X className="w-6 h-6 text-purple-300/60" />
            </button>
          </div>
        </div>

        {tab === 'comments' ? (
          <>
            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-purple-400/50 py-8">Aucun commentaire. Sois le premier !</p>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <img
                      src={comment.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${comment.user?.username || 'U'}&background=2A1852&color=FFEFD5`}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-purple-700/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="bg-purple-950/40 rounded-xl px-3 py-2 border border-purple-800/15">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">@{comment.user?.username || 'inconnu'}</span>
                          <span className="text-xs text-purple-500/50">{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-purple-200/80 mt-0.5">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-purple-500/25 flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Écrire un commentaire..."
                className="flex-1 bg-purple-950/40 border border-purple-800/30 rounded-full px-4 py-2 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!newComment.trim() || sending}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 rounded-full transition-all"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Music reactions list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {musicReactions.map(r => {
                const embedUrl = r.track_id ? `https://open.spotify.com/embed/track/${r.track_id}` : null;
                const isOpen = activeEmbedId === r.id;
                return (
                  <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={r.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${r.user?.username}&background=2A1852&color=FFEFD5`} className="w-6 h-6 rounded-full" alt="" />
                      <span className="text-xs font-medium">@{r.user?.username}</span>
                      {r.text && <span className="text-xs text-purple-300/60 ml-1">"{r.text}"</span>}
                    </div>
                    <div className="flex gap-2 items-center cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : r.id)}>
                      <img src={r.cover_url} className="w-10 h-10 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.track_name}</p>
                        <p className="text-xs text-purple-300/60 truncate">{r.artist}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); openInApp(r); }} className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                        <Play className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                    </div>
                    <AnimatePresence>
                      {isOpen && embedUrl && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                          <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {musicReactions.length === 0 && (
                <p className="text-center text-purple-400/50 py-4">Aucune réaction musicale</p>
              )}

              {/* Add music reaction */}
              <div className="border-t border-purple-800/20 pt-3">
                <p className="text-sm font-medium text-purple-200/80 mb-2">Réponds avec un son</p>
                {!selectedTrack ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                      <input type="text" value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Chercher un morceau..." className="w-full pl-9 pr-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500" />
                    </div>
                    {musicSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
                    {musicResults.slice(0, 5).map(t => (
                      <button key={t.id} onClick={() => setSelectedTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-purple-900/30 rounded-lg mt-1">
                        <img src={t.cover} className="w-9 h-9 rounded-md object-cover" alt="" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-purple-300/60 truncate">{t.artist}</p>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center bg-purple-950/40 rounded-lg p-2 border border-pink-500/30">
                      <img src={selectedTrack.cover} className="w-10 h-10 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedTrack.name}</p>
                        <p className="text-xs text-purple-300/60 truncate">{selectedTrack.artist}</p>
                      </div>
                      <button onClick={() => setSelectedTrack(null)} className="text-purple-400/50 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <input type="text" value={musicComment} onChange={e => setMusicComment(e.target.value)} placeholder="Commentaire (optionnel)" className="w-full px-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-pink-500" maxLength={200} />
                    <button onClick={() => handleSendMusicReaction(selectedTrack)} disabled={musicSending} className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {musicSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer la réaction</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
