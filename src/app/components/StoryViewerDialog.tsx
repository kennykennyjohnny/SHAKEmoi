import { X, Heart, MessageCircle, Trash2, ChevronLeft, ChevronRight, Send, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { likeStory, unlikeStory, hasLikedStory, commentOnStory, getStoryViewers, markStoryAsViewed } from '../../lib/database';
import { supabase } from '../../lib/supabase';

interface StoryViewerDialogProps {
  open: boolean;
  story: any | null;
  onClose: () => void;
  currentUser: any;
  stories?: any[];
  onNavigate?: (story: any) => void;
  onGroupEnd?: () => void;
}

const STORY_DURATION = 5000;

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expiré';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / 86400000);
  return `${days}j`;
}

export function StoryViewerDialog({ open, story, onClose, currentUser, stories, onNavigate, onGroupEnd }: StoryViewerDialogProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<{ id: string; x: number; y: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const storyList = stories && stories.length > 0 ? stories : (story ? [story] : []);
  const currentIdx = storyList.findIndex((s: any) => s.id === story?.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < storyList.length - 1;
  const isOwner = currentUser?.id === story?.user_id;

  const navigatePrev = () => {
    if (hasPrev && onNavigate) { setShowCommentInput(false); setShowViewers(false); onNavigate(storyList[currentIdx - 1]); }
  };
  const navigateNext = () => {
    if (hasNext && onNavigate) { setShowCommentInput(false); setShowViewers(false); onNavigate(storyList[currentIdx + 1]); }
    else if (!hasNext) { onGroupEnd?.(); }
  };

  const startProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startTimeRef.current = Date.now() - elapsedRef.current;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        navigateNext();
      }
    }, 50);
  };

  const pauseProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    elapsedRef.current = Date.now() - startTimeRef.current;
  };

  const resetAndStart = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        navigateNext();
      }
    }, 50);
  };

  useEffect(() => {
    if (!open || !story || showCommentInput) return;
    resetAndStart();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [story?.id, open]);

  useEffect(() => {
    if (!open || !story) return;
    if (isPaused || showCommentInput || showViewers) {
      pauseProgress();
    } else {
      startProgress();
    }
  }, [isPaused, showCommentInput, showViewers]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigatePrev();
      else if (e.key === 'ArrowRight') navigateNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIdx, storyList.length]);

  useEffect(() => {
    if (!story) return;
    setIsLiked(false);
    setLikeCount(story.likes_count || 0);
    setShowViewers(false);
    setViewers([]);
    hasLikedStory(story.id).then(setIsLiked);
    markStoryAsViewed(story.id);
  }, [story?.id]);

  const loadViewers = async () => {
    if (!story || loadingViewers) return;
    setLoadingViewers(true);
    const data = await getStoryViewers(story.id);
    setViewers(data);
    setLoadingViewers(false);
  };

  const toggleViewers = () => {
    const next = !showViewers;
    setShowViewers(next);
    if (next && viewers.length === 0) loadViewers();
  };

  const toggleLike = async () => {
    if (!story) return;
    if (isLiked) {
      await unlikeStory(story.id);
      setLikeCount(Math.max(0, likeCount - 1));
    } else {
      await likeStory(story.id);
      setLikeCount(likeCount + 1);
      const id = Math.random().toString();
      setLikeAnimations(prev => [...prev, { id, x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 }]);
      setTimeout(() => setLikeAnimations(prev => prev.filter(a => a.id !== id)), 800);
    }
    setIsLiked(!isLiked);
  };

  const handleComment = async () => {
    if (!story || !commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const result = await commentOnStory(story.id, commentText.trim());
    setIsSubmitting(false);
    if (result.success) { setCommentText(''); setShowCommentInput(false); }
  };

  const handleDelete = async () => {
    if (!story || !currentUser || story.user_id !== currentUser.id) return;
    if (confirm('Supprimer cette story?')) {
      try {
        const { error } = await supabase.from('stories').delete().eq('id', story.id);
        if (!error) onClose();
        else console.error('Error deleting story:', error);
      } catch (err) { console.error('Error deleting story:', err); }
    }
  };

  if (!story) return null;

  const embedUrl = story.spotify_embed_url || (story.track_id ? `https://open.spotify.com/embed/track/${story.track_id}` : null);
  const user = story.user;
  const avatarSrc = user?.profile_album_cover_url || user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'U'}&background=2A1852&color=FFEFD5`;
  const timeRemaining = story.expires_at ? getTimeRemaining(story.expires_at) : null;

  const bgStyle: React.CSSProperties = story.theme_color
    ? { background: story.theme_color }
    : { background: 'linear-gradient(135deg, #1D0F3D 0%, #2d1057 50%, #14092A 100%)' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={onClose}
        >
          {/* Navigation arrows desktop */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all hidden md:flex"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {(hasNext || !!onGroupEnd) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all hidden md:flex"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Story card — 9:16 ratio */}
          <motion.div
            key={story.id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative w-full max-w-[390px] flex flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{ ...bgStyle, height: 'min(88dvh, 692px)' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={() => { setIsPaused(true); }}
            onPointerUp={() => { setIsPaused(false); }}
            onPointerLeave={() => { setIsPaused(false); }}
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-30">
              {storyList.map((_: any, i: number) => (
                <div key={i} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-none"
                    style={{
                      width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-0 right-0 px-3 py-2 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={avatarSrc}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white/40 flex-shrink-0"
                  alt=""
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white drop-shadow leading-tight truncate">
                    {user?.display_name || user?.username}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-white/60 truncate">@{user?.username}</p>
                    {timeRemaining && (
                      <span className="text-[10px] text-white/40">· {timeRemaining}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isOwner && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleViewers(); }}
                      className={`p-2 rounded-full transition-colors ${showViewers ? 'bg-white/20 text-white' : 'bg-black/30 text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-2 rounded-full bg-black/30 text-white/70 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-black/30 text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tap zones mobile */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
            />

            {/* Central content */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 pt-20 pb-24 gap-4">
              {story.image_url ? (
                <img
                  src={story.image_url}
                  alt="story"
                  className="w-full rounded-2xl object-cover shadow-xl"
                  style={{ maxHeight: '52%' }}
                />
              ) : (
                <div className="text-center">
                  {story.cover_url && (
                    <img
                      src={story.cover_url}
                      alt={story.track_name || ''}
                      className="w-36 h-36 rounded-2xl object-cover mx-auto mb-4 shadow-2xl ring-4 ring-white/10"
                    />
                  )}
                  <p className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
                    {story.track_name || 'Shake éphémère'}
                  </p>
                  {story.artist && (
                    <p className="text-sm text-white/70 mt-1.5">{story.artist}</p>
                  )}
                </div>
              )}

              {story.text && (
                <p className="text-sm text-white/90 text-center leading-relaxed bg-black/35 rounded-2xl px-4 py-3 backdrop-blur-sm w-full">
                  {story.text}
                </p>
              )}

              {embedUrl && (
                <div className="w-full">
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

            {/* Viewers panel (owner only) */}
            <AnimatePresence>
              {showViewers && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl rounded-t-2xl max-h-[55%] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-white/60" />
                      <span className="text-sm font-bold text-white">
                        Vues {viewers.length > 0 ? `(${viewers.length})` : ''}
                      </span>
                    </div>
                    <button onClick={() => setShowViewers(false)} className="p-1 text-white/50 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 py-2">
                    {loadingViewers ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : viewers.length === 0 ? (
                      <p className="text-center text-sm text-white/40 py-6">Personne n'a encore vu cette story</p>
                    ) : (
                      viewers.map((viewer: any) => (
                        <div key={viewer.id} className="flex items-center gap-3 px-4 py-2.5">
                          <img
                            src={viewer.profile_album_cover_url || `https://ui-avatars.com/api/?name=${viewer.username || 'U'}&background=2A1852&color=FFEFD5`}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{viewer.display_name || viewer.username}</p>
                            <p className="text-xs text-white/40 truncate">@{viewer.username}</p>
                          </div>
                          {viewer.viewed_at && (
                            <span className="text-[10px] text-white/30 flex-shrink-0">
                              {new Date(viewer.viewed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom actions */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5">
              <AnimatePresence>
                {showCommentInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-3 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Commenter..."
                      className="flex-1 px-4 py-2.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); }
                        if (e.key === 'Escape') setShowCommentInput(false);
                      }}
                    />
                    <button
                      onClick={handleComment}
                      disabled={isSubmitting || !commentText.trim()}
                      className="p-2.5 bg-white/20 backdrop-blur-sm rounded-full text-white disabled:opacity-30 hover:bg-white/30 transition-colors flex-shrink-0"
                    >
                      {isSubmitting ? '…' : <Send className="w-4 h-4" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <button
                    onClick={toggleLike}
                    className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                      isLiked ? 'bg-red-500/30 text-red-400' : 'bg-black/30 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {likeAnimations.map(anim => (
                      <motion.div
                        key={anim.id}
                        initial={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        animate={{ opacity: 0, scale: 1.8, y: -60, x: anim.x }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="absolute pointer-events-none"
                        style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
                      >
                        <Heart className="w-7 h-7 fill-red-400 text-red-400" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                {likeCount > 0 && (
                  <span className="text-xs text-white/70 font-semibold -ml-1">{likeCount}</span>
                )}
                <button
                  onClick={() => setShowCommentInput(!showCommentInput)}
                  className="p-2.5 rounded-full bg-black/30 text-white/80 hover:bg-white/10 backdrop-blur-sm transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
