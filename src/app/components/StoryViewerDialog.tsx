import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoryViewerDialogProps {
  open: boolean;
  story: any | null;
  onClose: () => void;
}

export function StoryViewerDialog({ open, story, onClose }: StoryViewerDialogProps) {
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
                  <p className="text-lg font-bold">{story.track_name || 'Story SHAKEmoi'}</p>
                  <p className="text-sm text-purple-200/70">{story.artist || ''}</p>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
