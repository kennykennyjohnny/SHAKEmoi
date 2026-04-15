import { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getPostComments, addComment } from '../../lib/database';

interface CommentsDialogProps {
  postId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function CommentsDialog({ postId, onClose, onCommentAdded }: CommentsDialogProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

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
        className="bg-[#0f0020] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col border border-purple-500/30 mb-14 sm:mb-0"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <h3 className="font-bold text-white">Commentaires ({comments.length})</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-5 h-5 text-purple-300/60" />
          </button>
        </div>

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
                  src={comment.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${comment.user?.username || 'U'}&background=random`}
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

        {/* Input - safe area for mobile nav */}
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
      </motion.div>
    </motion.div>
  );
}
