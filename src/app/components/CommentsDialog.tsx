import { useState, useEffect } from 'react';
import { formatRelative } from '../../lib/dates';
import { X, Send, Loader2, Music, Search, Trash2 } from 'lucide-react';
import { SongCover } from './SongCover';
import { motion } from 'motion/react';
import { getPostComments, addComment, getMusicReactions, addMusicReaction, deleteComment, getPostOwnerId, deleteMusicReaction } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';
import { openExternal } from '../../lib/platforms';

import { thumb, defaultAvatar } from '../../lib/media';
import { MyAppLogo } from './PlatformLogo';
import { useBackHandler } from '../../lib/navigation';
import { openProfile } from '../../lib/appNav';
interface CommentsDialogProps {
  postId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
  currentUser?: any;
}

export function CommentsDialog({ postId, onClose, onCommentAdded, onCommentDeleted, currentUser }: CommentsDialogProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
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

  // F5 : supprimer son commentaire, ou n'importe lequel sous son propre post.
  const [postOwnerId, setPostOwnerId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEffect(() => { getPostOwnerId(postId).then(setPostOwnerId); }, [postId]);
  const canDelete = (c: any) => !!currentUser?.id && (c.user_id === currentUser.id || postOwnerId === currentUser.id);
  const handleDelete = async (commentId: string) => {
    setConfirmDeleteId(null);
    const before = comments;
    setComments(prev => prev.filter(c => c.id !== commentId));
    const r = await deleteComment(commentId);
    if (!r.success) setComments(before);
    else onCommentDeleted?.();
  };

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
      } else {
        alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
      }
    } catch (error) {
      console.error('Error sending comment:', error);
      alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
    } finally {
      setSending(false);
    }
  };

  const handleSendMusicReaction = async (track: any) => {
    setMusicSending(true);
    try {
      const r = await addMusicReaction(postId, track, musicComment);
      if (r.success) {
        setSelectedTrack(null); setMusicComment(''); setMusicQuery(''); setMusicResults([]);
        await loadMusicReactions();
        onCommentAdded?.(); // une réponse en musique compte comme un commentaire (O3)
      }
    } catch {}
    setMusicSending(false);
  };

  const handleDeleteMusic = async (id: string) => {
    const before = musicReactions;
    setMusicReactions(prev => prev.filter(r => r.id !== id));
    const r = await deleteMusicReaction(id);
    if (!r.success) setMusicReactions(before);
    else onCommentDeleted?.();
  };

  const openInApp = (r: any) => {
    const url = getPlatformUrl({ spotify_url: r.spotify_url, apple_music_url: r.apple_music_url, deezer_url: r.deezer_url, youtube_url: r.youtube_url, youtube_music_url: r.youtube_music_url, tidal_url: r.tidal_url, odesli_page_url: r.odesli_page_url }, currentUser?.musicService || 'spotify', { title: r.track_name, artist: r.artist });
    if (url) openExternal(url);
  };

  // Même format de date partout (lib/dates).
  const formatTime = (ts: string) => formatRelative(ts);

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
        className="bg-[#1D0F3D] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80dvh] flex flex-col border border-purple-500/30"
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
            <button aria-label="Fermer" onClick={onClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
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
                    <button onClick={() => openProfile(comment.user_id || comment.user?.id)} aria-label={`Profil de @${comment.user?.username || ''}`} className="flex-shrink-0 self-start">
                      <img loading="lazy"
                        src={thumb(comment.user?.profile_album_cover_url) || defaultAvatar(comment.user?.username || 'U')}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-purple-700/30"
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="bg-purple-950/40 rounded-xl px-3 py-2 border border-purple-800/15">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openProfile(comment.user_id || comment.user?.id)} className="font-semibold text-sm text-white hover:underline">@{comment.user?.username || 'inconnu'}</button>
                          <span className="text-xs text-purple-500/50">{formatTime(comment.created_at)}</span>
                          {canDelete(comment) && (
                            confirmDeleteId === comment.id ? (
                              <span className="ml-auto flex items-center gap-2 text-xs">
                                <button onClick={() => handleDelete(comment.id)} className="font-semibold text-pink-400">Supprimer</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-purple-300/70">Annuler</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(comment.id)} aria-label="Supprimer le commentaire" className="ml-auto p-1 text-purple-400/50 hover:text-pink-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
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
                enterKeyHint="send"
                className="flex-1 min-w-0 bg-purple-950/40 border border-purple-800/30 rounded-full px-4 py-2 text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!newComment.trim() || sending}
                aria-label="Envoyer le commentaire"
                className="flex-shrink-0 p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 rounded-full transition-all"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Music reactions list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {musicReactions.map(r => (
                  <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => openProfile(r.user_id || r.user?.id)} className="flex items-center gap-2">
                        <img loading="lazy" src={thumb(r.user?.profile_album_cover_url) || defaultAvatar(r.user?.username)} className="w-6 h-6 rounded-full" alt="" />
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
                      <button onClick={e => { e.stopPropagation(); openInApp(r); }} aria-label="Ouvrir dans mon appli de musique" className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                        <MyAppLogo className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                      {canDelete(r) && (
                        <button onClick={() => handleDeleteMusic(r.id)} aria-label="Supprimer la réponse en musique" className="p-1.5 rounded-full text-purple-400/50 hover:text-pink-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
              ))}

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
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
