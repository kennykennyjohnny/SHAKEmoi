import { X, Repeat2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface ReshakeDialogProps {
  shake: any;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void>;
}

export function ReshakeDialog({ shake, onClose, onConfirm }: ReshakeDialogProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onConfirm(comment.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Error reshaking:', error);
      alert('Erreur lors du reshake');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#0f0020] rounded-2xl w-full max-w-md border border-purple-800/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat2 className="w-5 h-5 text-fuchsia-500" />
            <h2 className="text-lg font-bold">Reshake ce son</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-purple-300/60" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          {/* Original Shake Preview */}
          <div className="mb-4 p-3 bg-purple-950/40 rounded-lg border border-purple-800/30">
            <div className="flex gap-3">
              <img
                src={shake.track.coverUrl}
                alt={shake.track.title}
                className="w-14 h-14 rounded-md object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-300/60 mb-1">@{shake.user.username}</p>
                <h3 className="font-bold text-sm truncate">{shake.track.title}</h3>
                <p className="text-xs text-purple-300/60 truncate">{shake.track.artist}</p>
              </div>
            </div>
            {shake.caption && (
              <p className="text-sm text-purple-200/80 mt-2">{shake.caption}</p>
            )}
          </div>

          {/* Comment Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-purple-200/80 mb-2">
              Ajoute un commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Pourquoi tu reshakes ce son ? 🎵"
              className="w-full bg-purple-950/40 border border-purple-800/30 rounded-lg px-3 py-2 text-white placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-purple-400/50 mt-1 text-right">
              {comment.length}/280
            </p>
          </div>

          {/* Info */}
          <div className="mb-4 p-3 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg">
            <p className="text-xs text-fuchsia-400">
              ✨ Ce reshake apparaîtra dans le feed de tes abonnés avec ton nom et ton commentaire
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reshake...
                </>
              ) : (
                <>
                  <Repeat2 className="w-4 h-4" />
                  Reshake
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
