import { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Sparkles, Heart, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAppStats } from '../../lib/database';

interface ShareDialogProps {
  currentUser: any;
  onClose: () => void;
}

export function ShareDialog({ currentUser, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ users: 0, shakes: 0, likes: 0 });
  const shareUrl = currentUser ? `https://shakemoi.fr?ref=${currentUser.username}` : 'https://shakemoi.fr';

  useEffect(() => {
    getAppStats().then(setStats);
  }, []);

  const formatNumber = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-[#1D0F3D] via-[#1D0F3D] to-purple-900/20 rounded-2xl w-full max-w-md border border-purple-800/20 overflow-hidden relative"
        >
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"
            />
          </div>

          {/* Content */}
          <div className="relative">
            {/* Header */}
            <div className="px-6 py-4 border-b border-purple-800/20/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Partage Shakemoi</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-purple-300/60" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-center">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 mx-auto mb-4 relative flex items-center justify-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full blur-xl"
                />
                <img
                  src={currentUser?.avatar || currentUser?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${currentUser?.username || 'S'}&background=2A1852&color=FFEFD5`}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover ring-3 ring-fuchsia-500/50 relative z-10"
                />
              </motion.div>

              {/* Message */}
              <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                Invite tes amis sur Shakemoi <Sparkles className="w-5 h-5 text-yellow-400" />
              </h3>
              
              <p className="text-purple-300/60 text-sm mb-6">
                Partage ton lien personnel avec tes amis et découvre ensemble les meilleures vibes musicales ! 🎵
              </p>

              {/* URL Box */}
              <div className="bg-purple-950/40/50 border border-purple-800/30 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-purple-400/50 mb-1">Lien de partage</p>
                    <p className="text-white font-mono text-sm truncate">{shareUrl}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                      copied
                        ? 'bg-fuchsia-500 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg p-3 mb-4"
                  >
                    <p className="text-fuchsia-400 text-sm font-medium flex items-center justify-center gap-2">
                      <Heart className="w-4 h-4 fill-current" />
                      Lien copié ! Partage-le avec tes amis 🔥
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-purple-950/40/30 rounded-lg p-3">
                  <p className="text-2xl font-bold text-purple-400">{formatNumber(stats.users)}</p>
                  <p className="text-xs text-purple-400/50">Shakers</p>
                </div>
                <div className="bg-purple-950/40/30 rounded-lg p-3">
                  <p className="text-2xl font-bold text-pink-400">{formatNumber(stats.shakes)}</p>
                  <p className="text-xs text-purple-400/50">Shakes</p>
                </div>
                <div className="bg-purple-950/40/30 rounded-lg p-3">
                  <p className="text-2xl font-bold text-fuchsia-400">{formatNumber(stats.likes)}</p>
                  <p className="text-xs text-purple-400/50">Likes</p>
                </div>
              </div>

              {/* Encouragement */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-200/80">
                  <span className="font-semibold text-white">Pourquoi Shakemoi ?</span>
                  <br />
                  Découvre ce que tes amis écoutent AVANT d'ouvrir Spotify. 
                  Plus de découvertes authentiques, moins d'algorithmes ! ✨
                </p>
              </div>

              {/* Share Button */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: 'SHAKEmoi',
                        text: `Rejoins-moi sur SHAKEmoi, l'appli où on partage nos sons préférés ! 🎵`,
                        url: shareUrl,
                      });
                    } catch {}
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" /> Partager avec tes amis
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}