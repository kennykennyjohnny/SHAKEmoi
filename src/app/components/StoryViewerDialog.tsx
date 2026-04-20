import { X, Heart, MessageCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { likeStory, unlikeStory, hasLikedStory, commentOnStory, getCurrentUser } from '../../lib/database';

interface StoryViewerDialogProps {
  open: boolean;
  story: any | null;
  onClose: () => void;
  currentUser: any;
  stories?: any[];
  onNavigate?: (story: any) => void;
  onGroupEnd?: () => void;
}

export function StoryViewerDialog({ open, story, onClose, currentUser, stories, onNavigate, onGroupEnd }: StoryViewerDialogProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<{ id: string; x: number; y: number }[]>([]);

  // Navigation between stories
  const storyList = stories && stories.length > 0 ? stories : (story ? [story] : []);
  const currentIdx = storyList.findIndex((s: any) => s.id === story?.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < storyList.length - 1;
  const navigatePrev = () => { if (hasPrev && onNavigate) { setShowCommentInput(false); onNavigate(storyList[currentIdx - 1]); } };
  const navigateNext = () => {
    if (hasNext && onNavigate) { setShowCommentInput(false); onNavigate(storyList[currentIdx + 1]); }
    else if (!hasNext) { onGroupEnd?.(); }
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigatePrev();
      else if (e.key === 'ArrowRight') navigateNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIdx, storyList.length]);

  useEffect(() => {
    if (!story) return;
    loadLikeStatus();
  }, [story?.id]);

  const loadLikeStatus = async () => {
    if (!story) return;
    const liked = await hasLikedStory(story.id);
    setIsLiked(liked);
    const count = story.likes_count || 0;
    setLikeCount(count);
  };

  const toggleLike = async () => {
    if (!story) return;
    
    if (isLiked) {
      await unlikeStory(story.id);
      setLikeCount(Math.max(0, likeCount - 1));
    } else {
      // Send like as private message silently
      await likeStory(story.id);
      setLikeCount(likeCount + 1);
      
      // Trigger heart animation
      const id = Math.random().toString();
      setLikeAnimations(prev => [...prev, { id, x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 }]);
      setTimeout(() => {
        setLikeAnimations(prev => prev.filter(a => a.id !== id));
      }, 800);
    }
    
    setIsLiked(!isLiked);
  };

  const handleComment = async () => {
    if (!story || !commentText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const result = await commentOnStory(story.id, commentText.trim());
    setIsSubmitting(false);

    if (result.success) {
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  const handleDelete = async () => {
    if (!story || !currentUser || story.user_id !== currentUser.id) return;
    
    if (confirm('Supprimer cette story?')) {
      try {
        // Delete story from database
        const { createClient } = await import('../../lib/supabase');
        const supabase = createClient();
        await supabase.from('stories').delete().eq('id', story.id);
        onClose();
      } catch (err) {
        console.error('Error deleting story:', err);
      }
    }
  };

  if (!story) return null;

  const embedUrl = story.spotify_embed_url || (story.track_id ? `https://open.spotify.com/embed/track/${story.track_id}` : null);
  const user = story.user;
  const isOwner = currentUser?.id === story.user_id;

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
          {/* Prev story arrow */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next story arrow */}
          {(hasNext || !!onGroupEnd) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Story dot indicators */}
          {storyList.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {storyList.map((_: any, i: number) => (
                <div key={i} className={`h-1 rounded-full transition-all ${i === currentIdx ? 'w-5 bg-white' : 'w-2 bg-white/30'}`} />
              ))}
            </div>
          )}

          <motion.div
            key={story.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl overflow-hidden border border-purple-800/30 relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ background: story.theme_color || '#1D0F3D', maxHeight: '90dvh' }}
          >
            {/* Header — always visible */}
            <div className="p-3 flex items-center justify-between bg-black/30 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <img src={user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=2A1852&color=FFEFD5`} className="w-8 h-8 rounded-full object-cover" alt="" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.display_name || user?.username}</p>
                  <p className="text-xs text-purple-200/70 truncate">@{user?.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isOwner && (
                  <button onClick={handleDelete} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/20">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image — constrained height so actions always visible */}
            {story.image_url ? (
              <img
                src={story.image_url}
                alt="story"
                className="w-full object-cover flex-shrink-0"
                style={{ maxHeight: 'min(50vh, 22rem)' }}
              />
            ) : (
              <div
                className="flex items-center justify-center text-purple-100/90 text-center p-6 bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex-shrink-0"
                style={{ minHeight: '10rem', maxHeight: '50vh' }}
              >
                <div>
                  <p className="text-lg font-bold">{story.track_name || 'Shake éphémère'}</p>
                  <p className="text-sm text-purple-200/70 mt-1">{story.artist || 'Partage musical temporaire'}</p>
                </div>
              </div>
            )}

            {/* Text + embed — scrollable if content is tall */}
            {(story.text || embedUrl) && (
              <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: '20vh' }}>
                {story.text && <p className="px-4 py-2.5 text-sm bg-black/25">{story.text}</p>}
                {embedUrl && (
                  <div className="p-3 bg-black/20">
                    <iframe
                      src={`${embedUrl}?theme=0`}
                      width="100%"
                      height="80"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Actions — always visible at bottom */}
            <div className="px-3 py-2.5 bg-black/40 backdrop-blur-sm border-t border-purple-500/20 flex-shrink-0">
              {likeCount > 0 && (
                <div className="text-xs text-purple-200/70 px-1 mb-1.5">
                  <span className="font-medium text-purple-100">{likeCount}</span> {likeCount === 1 ? 'like' : 'likes'}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={toggleLike}
                    className={`p-2.5 rounded-full transition-all ${isLiked ? 'bg-red-500/20 text-red-400' : 'text-purple-300/60 hover:text-purple-200 hover:bg-purple-500/10'}`}
                    title="Liker"
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {likeAnimations.map(anim => (
                      <motion.div key={anim.id} initial={{ opacity: 1, scale: 1, y: 0, x: 0 }} animate={{ opacity: 0, scale: 1.5, y: -60, x: anim.x }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute pointer-events-none" style={{ left: '50%', top: '50%' }}>
                        <Heart className="w-8 h-8 fill-red-400 text-red-400" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setShowCommentInput(!showCommentInput)}
                  className="p-2.5 rounded-full text-purple-300/60 hover:text-purple-200 hover:bg-purple-500/10 transition-all"
                  title="Commenter"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Comment input */}
            <AnimatePresence>
              {showCommentInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 py-2.5 bg-black/30 border-t border-purple-500/20 flex gap-2 overflow-hidden flex-shrink-0"
                >
                  <input
                    autoFocus
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Commenter..."
                    className="flex-1 px-3 py-2 bg-purple-500/15 border border-purple-500/30 rounded-full text-sm text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                  />
                  <button onClick={handleComment} disabled={isSubmitting || !commentText.trim()} className="px-4 py-2 text-purple-300/60 hover:text-purple-200 disabled:opacity-30 transition-colors">
                    {isSubmitting ? '...' : 'OK'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
