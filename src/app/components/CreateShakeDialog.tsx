import { useState, useEffect } from 'react';
import { X, Search, Music2, Sparkles, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as api from '../utils/api';
import * as spotifyAPI from '../utils/spotify';

interface CreateShakeDialogProps {
  currentUser: any;
  onClose: () => void;
}

export function CreateShakeDialog({ currentUser, onClose }: CreateShakeDialogProps) {
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
      const tracks = await spotifyAPI.getSpotifyRecommendations();
      setRecommendedTracks(tracks);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const tracks = await spotifyAPI.searchSpotify(query);
      setSearchResults(tracks);
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
      // Créer le shake avec toutes les infos du track
      await api.createShake({
        track: {
          id: selectedTrack.id,
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          coverUrl: selectedTrack.coverUrl,
          duration: selectedTrack.duration,
          previewUrl: 'https://p.scdn.co/mp3-preview/mock',
          spotifyUri: `https://open.spotify.com/track/${selectedTrack.id}`,
          appleMusicUrl: `https://music.apple.com/track/${selectedTrack.id}`
        },
        caption
      });
      setSuccess(true);
      // Fermer après 500ms pour montrer le succès
      setTimeout(() => {
        onClose();
      }, 500);
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
          className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-zinc-800"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-white">Shake un son</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
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
                    <p className="text-xs text-gray-400 truncate">{selectedTrack.albumName || ''}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Caption */}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ajoute un commentaire... (optionnel)"
                  className="w-full mt-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  rows={3}
                />
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un titre, artiste..."
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Suggestions */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Suggestions pour toi</h3>
                  <div className="space-y-2">
                    {isLoadingRecommendations ? (
                      <div className="flex justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      displayTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => setSelectedTrack(track)}
                          className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-3 transition-colors text-left"
                        >
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-white truncate">{track.title}</h4>
                            <p className="text-xs text-gray-400 truncate">{track.artist} · {track.albumName || ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{track.duration}</span>
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
          <div className="px-4 py-3 border-t border-zinc-800 flex justify-between items-center">
            <p className="text-xs text-gray-400">
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