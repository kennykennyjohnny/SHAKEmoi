import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Heart, X, Loader2 } from 'lucide-react';
import { getPostLikers } from '../../lib/database';
import { useBackHandler } from '../../lib/navigation';

import { thumb, defaultAvatar } from '../../lib/media';
// SHAKEMOI - Qui a liké ce shake (visible par l'auteur du post).
// Même feuille partout : fil, profil, détail d'un post.

interface Props {
  postId: string;
  onClose: () => void;
  onOpenProfile?: (user: { id: string; username: string }) => void;
}

export function LikersSheet({ postId, onClose, onOpenProfile }: Props) {
  const [likers, setLikers] = useState<any[] | null>(null);
  useBackHandler(true, onClose);

  useEffect(() => {
    let cancelled = false;
    setLikers(null);
    getPostLikers(postId).then(list => { if (!cancelled) setLikers(list); });
    return () => { cancelled = true; };
  }, [postId]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[85] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#1D0F3D] rounded-t-2xl sm:rounded-2xl border border-purple-800/30 overflow-hidden max-h-[70dvh] flex flex-col pb-[env(safe-area-inset-bottom)]"
      >
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
            {likers ? `${likers.length} like${likers.length > 1 ? 's' : ''}` : 'Likes'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-purple-900/30 rounded-full" aria-label="Fermer">
            <X className="w-4 h-4 text-purple-300/70" />
          </button>
        </div>
        {likers === null ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : likers.length === 0 ? (
          <div className="p-8 text-center text-purple-300/60 text-sm">Aucun like pour l'instant</div>
        ) : (
          <div className="overflow-y-auto overscroll-contain flex-1 py-1">
            {likers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => onOpenProfile?.({ id: u.id, username: u.username })}
                disabled={!onOpenProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-purple-900/20 transition-colors text-left disabled:cursor-default"
              >
                <img loading="lazy"
                  src={thumb(u.profile_album_cover_url) || defaultAvatar(u.username)}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-700/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-purple-300/60">@{u.username}</p>
                </div>
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
