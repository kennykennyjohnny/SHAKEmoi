import { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Repeat2, ExternalLink, Play, Loader2, Send, Pause, Trash2, Share2, Music, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPostById, likePost, unlikePost, hasLikedPost, getPostComments, addComment, getMusicReactions, addMusicReaction } from '../../lib/database';
import { getPlatformUrl } from '../../lib/odesli';
import { spotify } from '../../lib/spotify';

interface PostDetailModalProps {
  postId: string;
  currentUser: any;
  onClose: () => void;
  onDeletePost?: (postId: string) => void;
}

export function PostDetailModal({ postId, currentUser, onClose, onDeletePost }: PostDetailModalProps) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showEmbed, setShowEmbed] = useState(false);

  // Comments & music reactions
  const [tab, setTab] = useState<'comments' | 'music'>('comments');
  const [comments, setComments] = useState<any[]>([]);
  const [musicReactions, setMusicReactions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Music reaction states
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [musicComment, setMusicComment] = useState('');
  const [musicSending, setMusicSending] = useState(false);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  useEffect(() => {
    loadPost();
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

  const loadPost = async () => {
    setLoading(true);
    try {
      const data = await getPostById(postId);
      if (data) {
        setPost(data);
        setLikeCount(data.likes_count || data.likes || 0);
        const liked = await hasLikedPost(postId);
        setIsLiked(liked);
      }
      await loadComments();
      await loadMusicReactions();
    } catch (e) {
      console.error('Error loading post:', e);
    }
    setLoading(false);
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      setComments(await getPostComments(postId));
    } catch {}
    setCommentsLoading(false);
  };

  const loadMusicReactions = async () => {
    try {
      setMusicReactions(await getMusicReactions(postId));
    } catch {}
  };

  const toggleLike = async () => {
    if (isLiked) {
      await unlikePost(postId);
      setIsLiked(false);
      setLikeCount(c => c - 1);
    } else {
      await likePost(postId);
      setIsLiked(true);
      setLikeCount(c => c + 1);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const result = await addComment(postId, newComment.trim());
      if (result.success) {
        setNewComment('');
        await loadComments();
      }
    } catch {}
    setSending(false);
  };

  const handleSendMusicReaction = async (track: any) => {
    setMusicSending(true);
    try {
      const r = await addMusicReaction(postId, track, musicComment);
      if (r.success) { setSelectedTrack(null); setMusicComment(''); setMusicQuery(''); setMusicResults([]); await loadMusicReactions(); }
    } catch {}
    setMusicSending(false);
  };

  const openInMusicApp = () => {
    if (!post) return;
    const url = getPlatformUrl({
      spotify_url: post.spotify_url,
      apple_music_url: post.apple_music_url,
      deezer_url: post.deezer_url,
      youtube_url: post.youtube_url,
      youtube_music_url: post.youtube_music_url,
      tidal_url: post.tidal_url,
      odesli_page_url: post.odesli_page_url,
    }, currentUser?.musicService || 'spotify');
    if (url) window.open(url, '_blank');
  };

  const openReactionInApp = (r: any) => {
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

  const trackId = post?.track_id || (post?.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
  const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}?theme=0` : null;
  const coverUrl = post?.cover_url || post?.track_cover_url;
  const userName = post?.user?.display_name || post?.user?.username || '';
  const avatar = post?.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${post?.user?.username || 'U'}&background=random`;
  const isOwner = currentUser?.id === post?.user_id || currentUser?.id === post?.user?.id;

  if (loading) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </motion.div>
  );

  if (!post) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <p className="text-purple-300/50">Post introuvable</p>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0020] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-purple-800/30 overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center gap-3 flex-shrink-0">
          <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-700/30" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white truncate">{userName}</p>
            <p className="text-xs text-purple-300/60">@{post.user?.username}</p>
          </div>

          <button
            onClick={async () => {
              const url = `https://shakemoi.fr/#/s/${post.id}`;
              if (navigator.share) {
                try { await navigator.share({ title: `${post.track_name} - ${post.artist}`, text: `Écoute "${post.track_name}" de ${post.artist} sur SHAKEmoi ! 🎵`, url }); } catch {}
              } else {
                await navigator.clipboard.writeText(url);
              }
            }}
            className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <Share2 className="w-5 h-5 text-purple-300/60" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-6 h-6 text-purple-300/60" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover */}
          {coverUrl && (
            <div className="relative cursor-pointer" onClick={() => setShowEmbed(!showEmbed)}>
              <img src={coverUrl} alt="" className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                {showEmbed ? (
                  <Pause className="w-12 h-12 text-white fill-white drop-shadow-lg" />
                ) : (
                  <Play className="w-12 h-12 text-white fill-white drop-shadow-lg" />
                )}
              </div>
            </div>
          )}

          {/* Track info */}
          <div className="px-4 pt-3">
            <h3 className="font-bold text-lg text-white truncate">{post.track_name}</h3>
            <p className="text-sm text-purple-300/60 truncate">{post.artist}</p>
          </div>

          {/* Caption */}
          {post.text && (
            <div className="px-4 pt-2">
              <p className="text-sm text-purple-200/80">{post.text}</p>
            </div>
          )}

          {/* Embed */}
          <AnimatePresence>
            {showEmbed && embedUrl && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pt-2">
                <iframe src={embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action bar */}
          <div className="px-4 py-3 flex items-center gap-5">
            <button onClick={toggleLike} className="flex items-center gap-1.5 group">
              <Heart className={`w-6 h-6 transition-all ${isLiked ? 'text-pink-500 fill-pink-500' : 'text-purple-300/70 group-hover:text-pink-500'}`} />
              <span className={`text-sm font-medium ${isLiked ? 'text-pink-500' : 'text-purple-300/70'}`}>{likeCount}</span>
            </button>

            <button onClick={() => setTab('comments')} className="flex items-center gap-1.5 group">
              <MessageCircle className="w-6 h-6 text-purple-300/70 group-hover:text-fuchsia-400 transition-colors" />
              <span className="text-sm font-medium text-purple-300/70">{comments.length}</span>
            </button>

            <button onClick={openInMusicApp} className="flex items-center gap-1.5 group ml-auto px-3 py-1.5 rounded-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 transition-colors">
              <ExternalLink className="w-4 h-4 text-fuchsia-400" />
              <span className="text-xs font-medium text-fuchsia-400">Écouter</span>
            </button>

            {isOwner && onDeletePost && (
              <button
                onClick={() => { if (confirm('Supprimer ce shake ?')) { onDeletePost(post.id); onClose(); } }}
                className="p-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-pink-400" />
              </button>
            )}
          </div>

          {/* Tabs: Comments / Music reactions */}
          <div className="px-4 border-t border-purple-800/20">
            <div className="flex items-center gap-4 py-2">
              <button
                onClick={() => setTab('comments')}
                className={`text-sm font-bold transition-colors ${tab === 'comments' ? 'text-white' : 'text-purple-400/50 hover:text-purple-300'}`}
              >
                Commentaires ({comments.length})
              </button>
              <button
                onClick={() => setTab('music')}
                className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${tab === 'music' ? 'text-pink-400' : 'text-purple-400/50 hover:text-purple-300'}`}
              >
                <Music className="w-4 h-4" />
                Sons ({musicReactions.length})
              </button>
            </div>
          </div>

          {tab === 'comments' ? (
            <div className="px-4 pb-3 space-y-3">
              {commentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-purple-500 animate-spin" /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-purple-400/50 py-4 text-sm">Aucun commentaire</p>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2.5">
                    <img src={c.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${c.user?.username || 'U'}&background=random`} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">@{c.user?.username || 'inconnu'}</span>
                        <span className="text-[10px] text-purple-500/50">{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-purple-200/80">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 space-y-3">
              {musicReactions.map(r => {
                const rEmbedUrl = r.track_id ? `https://open.spotify.com/embed/track/${r.track_id}` : null;
                const isOpen = activeEmbedId === r.id;
                return (
                  <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={r.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${r.user?.username}&background=random`} className="w-6 h-6 rounded-full" alt="" />
                      <span className="text-xs font-medium">@{r.user?.username}</span>
                      {r.text && <span className="text-xs text-purple-300/60 ml-1">"{r.text}"</span>}
                    </div>
                    <div className="flex gap-2 items-center cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : r.id)}>
                      <img src={r.cover_url} className="w-10 h-10 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.track_name}</p>
                        <p className="text-xs text-purple-300/60 truncate">{r.artist}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); openReactionInApp(r); }} className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                        <Play className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                    </div>
                    <AnimatePresence>
                      {isOpen && rEmbedUrl && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                          <iframe src={`${rEmbedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {musicReactions.length === 0 && <p className="text-center text-purple-400/50 py-4 text-sm">Aucune réaction musicale</p>}

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
          )}
        </div>

        {/* Comment input (always visible when in comments tab) */}
        {tab === 'comments' && (
          <div className="px-4 py-3 border-t border-purple-500/25 flex items-center gap-2 flex-shrink-0">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              placeholder="Écrire un commentaire..."
              className="flex-1 bg-purple-950/40 border border-purple-800/30 rounded-full px-4 py-2 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              className="p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 rounded-full transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
