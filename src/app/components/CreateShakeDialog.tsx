import { useState, useEffect } from 'react';
import { X, Search, Music2, Sparkles, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPost } from '../../lib/database';
import { spotify } from '../../lib/spotify';

interface CreateShakeDialogProps {
  currentUser: any;
  onClose: () => void;
  circleId?: string | null;
}

export function CreateShakeDialog({ currentUser, onClose, circleId }: CreateShakeDialogProps) {
  const [caption, setCaption] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
  }, []);

  // Debounce search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRecommendations = async () => {
    try {
      setIsLoadingRecommendations(true);
      const tracks = await spotify.getTop100France();
      // Transform to expected format
      const formatted = tracks.slice(0, 10).map((t: any) => ({
        id: t.id,
        title: t.name,
        artist: t.artist,
        coverUrl: t.cover,
        duration: '3:00',
        previewUrl: t.preview_url,
        spotifyUri: t.spotify_url
      }));
      setRecommendedTracks(formatted);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const tracks = await spotify.searchTracks(query);
      // Transform to expected format
      const formatted = tracks.map((t: any) => ({
        id: t.id,
        title: t.name,
        artist: t.artist,
        coverUrl: t.cover,
        duration: '3:00',
        previewUrl: t.preview_url,
        spotifyUri: t.spotify_url
      }));
      setSearchResults(formatted);
    } catch (error) {
      console.error('Failed to search Spotify:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const displayTracks = searchQuery.trim() ? searchResults : recommendedTracks;

  const handleShake = async () => {
    if (!selectedTrack) return;
    setIsCreating(true);
    try {
      // Create post with Supabase
      const result = await createPost(
        selectedTrack.title,
        selectedTrack.artist,
        selectedTrack.coverUrl,
        caption,
        selectedTrack.previewUrl,
        selectedTrack.spotifyUri,
        selectedTrack.id,
        false,
        circleId
      );

      if (result.success) {
        setSuccess(true);
        // Close after 500ms to show success
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating shake:', error);
      setIsCreating(false);
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0f0020] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-purple-800/20"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-white">Shake un son</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-purple-300/60" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Selected Track */}
            {selectedTrack ? (
              <div className="mb-4">
                <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-3 flex gap-3 items-center border border-purple-500/20">
                  <img
                    src={selectedTrack.coverUrl}
                    alt={selectedTrack.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{selectedTrack.title}</h4>
                    <p className="text-sm text-purple-300 truncate">{selectedTrack.artist}</p>
                    <p className="text-xs text-purple-300/60 truncate">{selectedTrack.albumName || ''}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-purple-300/60" />
                  </button>
                </div>

                {/* Caption */}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ajoute un commentaire... (optionnel)"
                  className="w-full mt-3 px-3 py-2 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  rows={3}
                />
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un titre, artiste..."
                      className="w-full pl-10 pr-4 py-2.5 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Suggestions */}
                <div>
                  <h3 className="text-sm font-semibold text-purple-300/60 mb-3">Suggestions pour toi</h3>
                  <div className="space-y-2">
                    {isLoadingRecommendations ? (
                      <div className="flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-300/60" />
                      </div>
                    ) : (
                      displayTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => setSelectedTrack(track)}
                          className="w-full p-2 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center gap-3 transition-colors text-left"
                        >
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-white truncate">{track.title}</h4>
                            <p className="text-xs text-purple-300/60 truncate">{track.artist} · {track.albumName || ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-400/50">{track.duration}</span>
                            <Music2 className="w-4 h-4 text-purple-400" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-purple-800/20 flex justify-between items-center">
            <p className="text-xs text-purple-300/60">
              {selectedTrack ? 'Prêt à shaker ?' : 'Sélectionne un son'}
            </p>
            <button
              onClick={handleShake}
              disabled={!selectedTrack || isCreating}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Shake 🔥'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}