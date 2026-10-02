import { useState, useEffect, useRef } from 'react';
import { formatRelative } from '../../lib/dates';
import { X, Heart, MessageCircle, Loader2, Send, Trash2, Share2, Music, Search, Repeat2, Flag, Pin } from 'lucide-react';
import { pinSong } from './PinnedSongs';
import { motion, AnimatePresence } from 'motion/react';
import { getPostById, likePost, unlikePost, hasLikedPost, getPostComments, addComment, getMusicReactions, addMusicReaction, deleteComment, reshakePost, unreshakePost, hasReshaked } from '../../lib/database';
import { ReshakeDialog } from './ReshakeDialog';
import { SendSongDialog } from './SendSongDialog';
import { getPlatformUrl } from '../../lib/odesli';
import { spotify } from '../../lib/spotify';
import { postLink } from '../../lib/links';
import { SongShareSheet } from './SongShareSheet';
import { openExternal } from '../../lib/platforms';
import { LikersSheet } from './LikersSheet';

import { defaultAvatar, avatarThumb } from '../../lib/media';
import { SongCover } from './SongCover';
import { MyAppLogo } from './PlatformLogo';
import { useBackHandler } from '../../lib/navigation';
import { openProfile, openReport } from '../../lib/appNav';
import { supabase } from '../../lib/supabase';
interface PostDetailModalProps {
  postId: string;
  currentUser: any;
  onClose: () => void;
  onDeletePost?: (postId: string) => void;
  /** Like / reshake faits ici : l'écran d'en dessous (profil, TOP…) suit. */
  onUpdated?: (postId: string, patch: { likes_count?: number; reshaked?: boolean }) => void;
}

// Un reshake ouvre le post d'origine (mêmes chiffres que dans le fil) : une
// notification qui pointe sur un reshake affichait sinon ses propres compteurs.
export function PostDetailModal(props: PostDetailModalProps) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    supabase.from('posts').select('is_reshake, original_post_id').eq('id', props.postId).maybeSingle()
      .then(({ data }) => { if (!off) setId(data?.is_reshake && data.original_post_id ? data.original_post_id : props.postId); },
            () => { if (!off) setId(props.postId); });
    return () => { off = true; };
  }, [props.postId]);
  if (!id) return null;
  return <PostDetailModalInner key={id} {...props} postId={id} />;
}

function PostDetailModalInner({ postId, currentUser, onClose, onDeletePost, onUpdated }: PostDetailModalProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
  const [post, setPost] = useState<any>(null);
  const [showShare, setShowShare] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  // Reshake (P2) : un par personne, jamais le sien, annulable (F1).
  const [reshaked, setReshaked] = useState(false);
  const [reshakeCount, setReshakeCount] = useState(0);
  const [showReshake, setShowReshake] = useState(false);
  const [reshakeNotice, setReshakeNotice] = useState<string | null>(null);
  const [sendTrack, setSendTrack] = useState<any>(null);

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
        setReshakeCount(data.reshakes_count || 0);
        const [liked, didReshake] = await Promise.all([hasLikedPost(postId), hasReshaked(postId)]);
        setIsLiked(liked);
        setReshaked(didReshake);
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

  // Like optimiste (F4) : affiché tout de suite, annulé si le serveur refuse.
  const likeBusyRef = useRef(false);
  const toggleLike = async () => {
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    const r = next ? await likePost(postId) : await unlikePost(postId);
    if (!r.success) {
      setIsLiked(!next);
      setLikeCount(c => Math.max(0, c + (next ? -1 : 1)));
    } else {
      onUpdated?.(postId, { likes_count: Math.max(0, likeCount + (next ? 1 : -1)) });
    }
    likeBusyRef.current = false;
  };

  const notice = (text: string) => { setReshakeNotice(text); setTimeout(() => setReshakeNotice(null), 3000); };
  const handleReshakeButton = async () => {
    if (isOwner) { notice('C’est ton shake : partage-le plutôt avec le bouton Partager.'); return; }
    if (!reshaked) { setShowReshake(true); return; }
    setReshaked(false);
    setReshakeCount(c => Math.max(0, c - 1));
    const r = await unreshakePost(postId);
    if (!r.success) { setReshaked(true); setReshakeCount(c => c + 1); notice('Impossible d’annuler le reshake. Réessaie.'); return; }
    onUpdated?.(postId, { reshaked: false });
  };
  const confirmReshake = async (comment?: string) => {
    const r = await reshakePost(postId, comment);
    if (!r.success) { notice(r.error || 'Le reshake n’a pas marché. Réessaie.'); return; }
    setReshaked(true);
    setReshakeCount(c => c + 1);
    onUpdated?.(postId, { reshaked: true });
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const result = await addComment(postId, newComment.trim());
      if (result.success) {
        setNewComment('');
        await loadComments();
      } else {
        alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
      }
    } catch {
      alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
    }
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
    }, currentUser?.musicService || 'spotify', { title: post.track_name, artist: post.artist });
    if (url) openExternal(url);
  };

  const openReactionInApp = (r: any) => {
    const url = getPlatformUrl({ spotify_url: r.spotify_url, apple_music_url: r.apple_music_url, deezer_url: r.deezer_url, youtube_url: r.youtube_url, youtube_music_url: r.youtube_music_url, tidal_url: r.tidal_url, odesli_page_url: r.odesli_page_url }, currentUser?.musicService || 'spotify', { title: r.track_name, artist: r.artist });
    if (url) openExternal(url);
  };

  // Même format de date partout (lib/dates).
  const formatTime = (ts: string) => formatRelative(ts);

  const trackId = post?.track_id || (post?.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
  const coverUrl = post?.cover_url || post?.track_cover_url;
  const userName = post?.user?.display_name || post?.user?.username || '';
  const avatar = avatarThumb(post?.user?.profile_album_cover_url) || defaultAvatar(post?.user?.username || 'U');
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
      <p className="text-purple-300/60">Ce shake n’existe plus (ou n’est pas visible pour toi).</p>
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
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-lg max-h-[90dvh] flex flex-col border border-purple-800/30 overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center gap-3 flex-shrink-0">
          {/* L'auteur : ouvre son profil par-dessus (le retour ramène ici). */}
          <button onClick={() => openProfile(post.user_id || post.user?.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <img loading="lazy" src={avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-700/30" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">{userName}</p>
              <p className="text-xs text-purple-300/60">@{post.user?.username}</p>
            </div>
          </button>

          {!isOwner && currentUser && (
            <button aria-label="Signaler ce shake" onClick={() => openReport('post', post.id)} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
              <Flag className="w-4 h-4 text-purple-300/60" />
            </button>
          )}
          <button aria-label="Partager"
            onClick={() => setShowShare(true)}
            className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <Share2 className="w-5 h-5 text-purple-300/60" />
          </button>
          {showShare && (
            <SongShareSheet
              song={{ title: post.track_name, artist: post.artist, cover: post.cover_url, previewUrl: post.preview_url }}
              by={currentUser?.username}
              link={postLink(post.id)}
              onClose={() => setShowShare(false)}
            />
          )}
          <button aria-label="Fermer" onClick={onClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-6 h-6 text-purple-300/60" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover */}
          {coverUrl && (
            // M2 : la grande pochette lance l'extrait dans notre lecteur.
            <SongCover
              songKey={`post-${post.id}`}
              title={post.track_name} artist={post.artist} cover={coverUrl}
              previewUrl={post.preview_url} spotifyId={trackId} spotifyUrl={post.spotify_url}
              className="w-full aspect-square" rounded="rounded-none" iconSize="lg"
            />
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


          {/* Action bar */}
          <div className="px-4 py-3 flex items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <button onClick={toggleLike} aria-label={isLiked ? 'Retirer le like' : 'Liker'} className="group">
                <Heart className={`w-6 h-6 transition-all ${isLiked ? 'text-pink-500 fill-pink-500' : 'text-purple-300/70 group-hover:text-pink-500'}`} />
              </button>
              {isOwner && likeCount > 0 ? (
                <button
                  onClick={() => setShowLikers(true)}
                  title="Voir qui a liké"
                  className="text-sm font-medium text-pink-400/90 underline underline-offset-2 decoration-dotted px-1 -mx-1 py-1"
                >{likeCount}</button>
              ) : (
                <span className={`text-sm font-medium ${isLiked ? 'text-pink-500' : 'text-purple-300/70'}`}>{likeCount}</span>
              )}
            </div>
            {showLikers && post && <LikersSheet postId={post.id} onClose={() => setShowLikers(false)} />}

            <button onClick={() => setTab('comments')} className="flex items-center gap-1.5 group">
              <MessageCircle className="w-6 h-6 text-purple-300/70 group-hover:text-fuchsia-400 transition-colors" />
              {/* Texte + réponses en musique (O3), comme dans le fil. */}
              <span className="text-sm font-medium text-purple-300/70">{comments.length + musicReactions.length}</span>
            </button>

            <button
              onClick={handleReshakeButton}
              aria-label={reshaked ? 'Annuler le reshake' : 'Reshaker'}
              aria-pressed={reshaked}
              className={`flex items-center gap-1.5 group ${isOwner ? 'opacity-40' : ''}`}
            >
              <Repeat2 className={`w-6 h-6 transition-colors ${reshaked ? 'text-fuchsia-400' : 'text-purple-300/70 group-hover:text-fuchsia-400'}`} />
              <span className={`text-sm font-medium ${reshaked ? 'text-fuchsia-400' : 'text-purple-300/70'}`}>{reshakeCount}</span>
            </button>

            <button
              onClick={() => setSendTrack({ id: post.track_id, title: post.track_name, artist: post.artist, coverUrl: post.cover_url, spotifyUrl: post.spotify_url, previewUrl: post.preview_url })}
              aria-label="Envoyer à un ami"
              className="p-1 group"
            >
              <Send className="w-5 h-5 text-purple-300/70 group-hover:text-fuchsia-400 transition-colors" />
            </button>

            <button onClick={openInMusicApp} className="flex items-center gap-1.5 group ml-auto px-3 py-1.5 rounded-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 transition-colors">
              <MyAppLogo className="w-4 h-4 text-fuchsia-400" />
              <span className="text-xs font-medium text-fuchsia-400">Écouter</span>
            </button>

            {isOwner && (
              <button aria-label="Épingler sur mon profil" title="Épingler sur mon profil"
                onClick={async () => { const err = await pinSong(null, post); notice(err || 'Épinglé sur ton profil 📌'); }}
                className="p-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 rounded-lg transition-colors">
                <Pin className="w-4 h-4 text-fuchsia-300" />
              </button>
            )}
            {isOwner && onDeletePost && (
              <button aria-label="Supprimer"
                onClick={() => { if (confirm('Supprimer ce shake ?')) { onDeletePost(post.id); onClose(); } }}
                className="p-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-pink-400" />
              </button>
            )}
          </div>

          {reshakeNotice && <p className="mx-4 mb-2 text-xs text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2">{reshakeNotice}</p>}

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
                    <button onClick={() => openProfile(c.user_id || c.user?.id)} aria-label={`Profil de @${c.user?.username || ''}`} className="flex-shrink-0 self-start">
                      <img loading="lazy" src={avatarThumb(c.user?.profile_album_cover_url) || defaultAvatar(c.user?.username || 'U')} alt="" className="w-7 h-7 rounded-full object-cover" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openProfile(c.user_id || c.user?.id)} className="font-semibold text-xs text-white hover:underline">@{c.user?.username || 'inconnu'}</button>
                        <span className="text-[10px] text-purple-500/50">{formatTime(c.created_at)}</span>
                        {currentUser?.id && c.user_id !== currentUser.id && (
                          <button onClick={() => openReport('comment', c.id)} aria-label="Signaler le commentaire" className="ml-auto p-1 text-purple-400/40 hover:text-pink-300">
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                        {currentUser?.id && (c.user_id === currentUser.id || isOwner) && (
                          <button
                            onClick={async () => {
                              const before = comments;
                              setComments(prev => prev.filter((x: any) => x.id !== c.id));
                              const r = await deleteComment(c.id);
                              if (!r.success) setComments(before);
                            }}
                            aria-label="Supprimer le commentaire"
                            className="ml-auto p-1 text-purple-400/50 hover:text-pink-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-purple-200/80">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 space-y-3">
              {musicReactions.map(r => (
                  <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => openProfile(r.user_id || r.user?.id)} className="flex items-center gap-2">
                        <img loading="lazy" src={avatarThumb(r.user?.profile_album_cover_url) || defaultAvatar(r.user?.username)} className="w-6 h-6 rounded-full object-cover" alt="" />
                        <span className="text-xs font-medium hover:underline">@{r.user?.username}</span>
                      </button>
                      {r.text && <span className="text-xs text-purple-300/60 ml-1">"{r.text}"</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      <SongCover songKey={`reaction-${r.id}`} title={r.track_name} artist={r.artist} cover={r.cover_url} previewUrl={r.preview_url} spotifyId={r.track_id} spotifyUrl={r.spotify_url} className="w-10 h-10" rounded="rounded-md" iconSize="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.track_name}</p>
                        <p className="text-xs text-purple-300/60 truncate">{r.artist}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); openReactionInApp(r); }} aria-label="Ouvrir dans mon appli de musique" className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                        <MyAppLogo className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                    </div>
                  </div>
              ))}
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
                        <img loading="lazy" src={t.cover} className="w-9 h-9 rounded-md object-cover" alt="" />
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
                      <img loading="lazy" src={selectedTrack.cover} className="w-10 h-10 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedTrack.name}</p>
                        <p className="text-xs text-purple-300/60 truncate">{selectedTrack.artist}</p>
                      </div>
                      <button aria-label="Retirer le son" onClick={() => setSelectedTrack(null)} className="text-purple-400/50 hover:text-white"><X className="w-4 h-4" /></button>
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
              enterKeyHint="send"
              className="flex-1 min-w-0 bg-purple-950/40 border border-purple-800/30 rounded-full px-4 py-2 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              aria-label="Envoyer le commentaire"
              className="flex-shrink-0 p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 rounded-full transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </motion.div>
      <div onClick={(e) => e.stopPropagation()}>
        {showReshake && (
          <ReshakeDialog
            shake={{ track: { coverUrl: post.cover_url, title: post.track_name, artist: post.artist }, user: { username: post.user?.username }, caption: post.text }}
            onClose={() => setShowReshake(false)}
            onConfirm={confirmReshake}
          />
        )}
        <AnimatePresence>
          {sendTrack && <SendSongDialog track={sendTrack} onClose={() => setSendTrack(null)} />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
