import { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Sparkles, Heart, Music2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';
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
          className="bg-gradient-to-br from-[#0f0020] via-[#0f0020] to-purple-900/20 rounded-2xl w-full max-w-md border border-purple-800/20 overflow-hidden relative"
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
                className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-purple-300/60" />
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
                <Logo size="lg" animated={true} showText={false} />
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

              {/* Social Share Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const text = encodeURIComponent(`Hey ! 👋 Rejoins-moi sur SHAKEmoi, l'appli où on partage nos sons préférés avec nos amis 🎵🔥\n\nInscris-toi ici : ${shareUrl}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>

                {/* Instagram */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Hey ! 👋 Rejoins-moi sur SHAKEmoi 🎵🔥 ${shareUrl}`);
                    window.open('instagram://camera', '_blank');
                    setTimeout(() => { window.open('https://instagram.com', '_blank'); }, 500);
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  Instagram
                </button>

                {/* X / Twitter */}
                <button
                  onClick={() => {
                    const text = encodeURIComponent(`Découvrez ce que vos amis écoutent vraiment 🎵 Rejoignez-moi sur @SHAKEmoi !\n${shareUrl}`);
                    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X / Twitter
                </button>

                {/* Snapchat */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Rejoins-moi sur SHAKEmoi 🎵🔥 ${shareUrl}`);
                    window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400 text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.959-.289.096-.057.186-.079.277-.079.194 0 .381.104.489.264.035.053.079.116.079.194 0 .06-.029.169-.18.285-.238.168-.479.27-.72.374-.096.039-.193.08-.287.123-.155.074-.307.167-.434.27-.058.052-.108.123-.139.204l-.003.013c-.159.463.105 1.075.267 1.322.158.237.345.465.552.668.283.291.632.508 1.019.709.195.099.395.171.595.214.102.024.178.07.222.134.052.073.083.164.083.272 0 .061-.01.124-.034.186-.12.31-.378.439-.59.534-.119.051-.241.1-.351.142-1.2.456-1.6 1.024-1.685 1.152-.053.07-.076.132-.076.217 0 .069.025.141.076.209.066.096.141.179.216.261.224.244.47.476.692.692.297.303.504.553.625.796.059.118.094.237.094.363 0 .068-.011.134-.034.198-.159.496-.755.685-1.304.8-.262.052-.531.079-.747.101-.105.01-.21.025-.299.038-.056.007-.112.032-.165.078-.069.058-.116.14-.134.243-.025.14-.107.236-.223.263-.162.03-.318.043-.468.043-.207 0-.417-.024-.643-.074-.236-.052-.466-.12-.689-.18-.33-.09-.648-.152-.96-.152-.083 0-.166.005-.25.016-.438.058-.855.308-1.234.541-.506.311-1.045.642-1.648.642-.063 0-.125-.005-.188-.014-.061.009-.122.014-.186.014-.602 0-1.14-.332-1.648-.642-.381-.234-.8-.485-1.237-.543-.084-.01-.168-.015-.251-.015-.314 0-.633.063-.962.153-.226.061-.459.13-.698.181-.228.051-.442.076-.653.076-.152 0-.313-.013-.481-.045-.117-.027-.199-.122-.224-.262-.017-.1-.064-.183-.133-.24-.053-.045-.108-.07-.164-.078-.091-.013-.197-.028-.301-.038-.215-.022-.489-.05-.752-.102-.543-.114-1.139-.303-1.301-.802-.023-.065-.034-.132-.034-.199 0-.127.035-.246.095-.364.12-.244.332-.495.63-.798.218-.215.46-.443.683-.684.076-.082.152-.167.22-.264.053-.07.078-.143.078-.213 0-.082-.023-.146-.077-.218-.085-.127-.484-.695-1.684-1.15-.11-.042-.234-.092-.354-.142-.213-.096-.474-.226-.595-.538-.023-.062-.034-.125-.034-.187 0-.11.031-.201.084-.275.045-.067.123-.112.224-.136.201-.043.401-.115.595-.214.388-.201.737-.418 1.02-.71.207-.202.394-.43.552-.667.16-.245.422-.858.267-1.316l-.004-.013c-.031-.082-.081-.153-.14-.205-.127-.103-.279-.197-.432-.271-.094-.042-.19-.084-.287-.123-.243-.103-.482-.206-.72-.374-.152-.117-.18-.228-.18-.287 0-.077.043-.14.078-.193.109-.162.297-.264.492-.264.091 0 .181.022.278.079.3.17.659.289.96.29.196 0 .325-.045.401-.091-.009-.164-.019-.331-.031-.51l-.003-.058c-.104-1.628-.23-3.654.3-4.847C7.85 1.068 11.216.793 12.206.793"/></svg>
                  Snapchat
                </button>
              </div>

              {/* Native Share */}
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
                  className="w-full mt-3 py-2.5 rounded-xl bg-purple-950/40 border border-purple-800/30 text-purple-300 text-sm font-medium hover:bg-purple-900/40 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Autres apps...
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}