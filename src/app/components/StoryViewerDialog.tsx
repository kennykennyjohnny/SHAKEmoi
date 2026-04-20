import { X, Heart, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { likeStory, unlikeStory, hasLikedStory, getStoryLikes, commentOnStory } from '../../lib/database';

interface StoryViewerDialogProps {
  open: boolean;
  story: any | null;
  onClose: () => void;
}

export function StoryViewerDialog({ open, story, onClose }: StoryViewerDialogProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likers, setLikers] = useState<any[]>([]);

  useEffect(() => {
    if (!story) return;
    loadLikeData();
  }, [story?.id]);

  const loadLikeData = async () => {
    if (!story) return;
    const liked = await hasLikedStory(story.id);
    setIsLiked(liked);
    setLikesCount(story.likes_count || 0);
    const likes = await getStoryLikes(story.id);
    setLikers(likes);
  };

  const toggleLike = async () => {
    if (!story) return;
    setIsLiked(!isLiked);
    
    if (isLiked) {
      await unlikeStory(story.id);
      setLikesCount(Math.max(0, likesCount - 1));
    } else {
      await likeStory(story.id);
      setLikesCount(likesCount + 1);
      const likes = await getStoryLikes(story.id);
      setLikers(likes);
    }
  };

  const handleComment = async () => {
    if (!story || !commentText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const result = await commentOnStory(story.id, commentText.trim());
    setIsSubmitting(false);

    if (result.success) {
      setCommentText('');
      setShowCommentInput(false);
      // Show success message
      const confirmEl = document.createElement('div');
      confirmEl.className = 'fixed top-4 right-4 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm border border-green-500/30';
      confirmEl.textContent = '✓ Comment envoyé par DM';
      document.body.appendChild(confirmEl);
      setTimeout(() => confirmEl.remove(), 3000);
    }
  };

  if (!story) return null;

  const embedUrl = story.spotify_embed_url || (story.track_id ? `https://open.spotify.com/embed/track/${story.track_id}` : null);
  const user = story.user;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="w-full max-w-md rounded-3xl overflow-hidden border border-purple-800/30"
            onClick={(e) => e.stopPropagation()}
            style={{ background: story.theme_color || '#1D0F3D' }}
          >
            <div className="p-3 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2 min-w-0">
                <img src={user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=2A1852&color=FFEFD5`} className="w-8 h-8 rounded-full object-cover" alt="" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.display_name || user?.username}</p>
                  <p className="text-xs text-purple-200/70 truncate">@{user?.username}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/20"><X className="w-4 h-4" /></button>
            </div>

            {story.image_url ? (
              <img src={story.image_url} alt="story" className="w-full h-[28rem] object-cover" />
            ) : (
              <div className="h-[20rem] flex items-center justify-center text-purple-100/90 text-center p-6">
                <div>
                  <p className="text-lg font-bold">{story.text || story.track_name || 'Shake ephemere'}</p>
                  <p className="text-sm text-purple-200/70">{story.artist || 'Partage musical temporaire'}</p>
                </div>
              </div>
            )}

            {story.text && <p className="px-4 py-3 text-sm bg-black/25">{story.text}</p>}

            {embedUrl && (
              <div className="p-3 bg-black/20">
                <iframe
                  src={`${embedUrl}?theme=0`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="px-4 py-3 space-y-2 bg-black/25 border-t border-purple-500/20">
              {/* Like button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLike}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                    isLiked
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-purple-500/20 text-purple-300 hover:text-purple-200'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </button>
                
                {likers.length > 0 && (
                  <button
                    className="text-xs text-purple-400/70 hover:text-purple-300 px-2"
                    onClick={() => setShowCommentInput(!showCommentInput)}
                  >
                    {likers.map(l => l.user?.username).slice(0, 2).join(', ')}
                    {likers.length > 2 && ` +${likers.length - 2}`}
                  </button>
                )}
              </div>

              {/* Comment button & input */}
              <AnimatePresence>
                {showCommentInput ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Votre commentaire..."
                      className="flex-1 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleComment();
                        }
                      }}
                    />
                    <button
                      onClick={handleComment}
                      disabled={isSubmitting || !commentText.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowCommentInput(true)}
                    className="w-full px-3 py-2 bg-purple-500/20 text-purple-300 hover:text-purple-200 rounded-lg text-sm transition-colors text-left"
                  >
                    💬 Commenter...
                  </button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
