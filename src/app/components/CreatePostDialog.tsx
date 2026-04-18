import { useState } from 'react';
import { X, Search, Music2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreatePostDialogProps {
  currentUser: any;
  onClose: () => void;
}

export function CreatePostDialog({ currentUser, onClose }: CreatePostDialogProps) {
  const [caption, setCaption] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  const suggestedTracks = [
    {
      id: '1',
      title: 'Save Your Tears',
      artist: 'The Weeknd',
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop'
    },
    {
      id: '2',
      title: 'Peaches',
      artist: 'Justin Bieber',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop'
    },
    {
      id: '3',
      title: 'good 4 u',
      artist: 'Olivia Rodrigo',
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop'
    }
  ];

  const handlePost = () => {
    console.log('Posting:', { caption, selectedTrack });
    onClose();
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1D0F3D] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-purple-800/20"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-purple-800/20 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Partager un son</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-purple-300/60" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-6">
              <img
                src={currentUser?.avatar}
                alt={currentUser?.displayName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20"
              />
              <div>
                <h3 className="font-semibold text-white">{currentUser?.displayName}</h3>
                <p className="text-sm text-purple-300/60">@{currentUser?.username}</p>
              </div>
            </div>

            {/* Caption */}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Partagez votre découverte musicale..."
              className="w-full px-4 py-3 bg-purple-950/40 border border-purple-800/30 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors resize-none mb-6"
              rows={3}
            />

            {/* Selected Track */}
            {selectedTrack ? (
              <div className="mb-6 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-4 flex gap-4 items-center backdrop-blur-sm border border-purple-500/20">
                <img
                  src={selectedTrack.coverUrl}
                  alt={selectedTrack.title}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate">{selectedTrack.title}</h4>
                  <p className="text-purple-300 truncate">{selectedTrack.artist}</p>
                </div>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-purple-300/60" />
                </button>
              </div>
            ) : (
              <>
                {/* Search Track */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-purple-200/80 mb-2">
                    Rechercher un morceau
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/60" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Titre, artiste, album..."
                      className="w-full pl-12 pr-4 py-3 bg-purple-950/40 border border-purple-800/30 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Suggested Tracks */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-300/60 mb-3">Suggestions</p>
                  {suggestedTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => setSelectedTrack(track)}
                      className="w-full p-3 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center gap-3 transition-colors text-left"
                    >
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{track.title}</h4>
                        <p className="text-sm text-purple-300/60 truncate">{track.artist}</p>
                      </div>
                      <Music2 className="w-5 h-5 text-purple-400" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Media Options */}
            <div className="mt-6 flex gap-4">
              <button className="flex-1 py-3 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <ImageIcon className="w-5 h-5 text-purple-300/60" />
                <span className="text-sm font-medium text-purple-200/80">Image</span>
              </button>
              <button className="flex-1 py-3 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Music2 className="w-5 h-5 text-purple-300/60" />
                <span className="text-sm font-medium text-purple-200/80">Audio</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-purple-800/20 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-950/40 hover:bg-purple-800/40 rounded-full font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handlePost}
              disabled={!selectedTrack}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Publier
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
