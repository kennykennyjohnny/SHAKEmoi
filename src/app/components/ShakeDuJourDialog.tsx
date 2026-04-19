import { useState, useEffect } from 'react';
import { Search, Play, Sparkles, Loader2, X, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { spotify } from '../../lib/spotify';
import { createPost, createShakeDuJour, hasShakeToday } from '../../lib/database';
import { getOdesliLinks } from '../../lib/odesli';

interface ShakeDuJourDialogProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function ShakeDuJourDialog({ onComplete, onSkip }: ShakeDuJourDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [publishToProfile, setPublishToProfile] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const tracks = await spotify.searchTracks(query);
        setResults(tracks.map((t: any) => ({
          id: t.id,
          title: t.name,
          artist: t.artist,
          artists: t.artists,
          album: t.album,
          coverUrl: t.cover,
          previewUrl: t.preview_url,
          spotifyUrl: t.spotify_url,
        })));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handlePost = async () => {
    if (!selectedTrack) return;
    setPosting(true);
    try {
      const result = await createPost(
        selectedTrack.title,
        selectedTrack.artist,
        selectedTrack.coverUrl,
        caption || `Mon shake de la semaine`,
        selectedTrack.previewUrl,
        selectedTrack.spotifyUrl,
        selectedTrack.id,
        !publishToProfile // isPrivate = true when NOT publishing to profile
      );
      if (result.success && result.data) {
        await createShakeDuJour(result.data.id);
        onComplete();
      }
    } catch (err) {
      console.error('Error posting shake du jour:', err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onSkip}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-md border border-purple-800/20 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold">Shake de la semaine</h2>
          </div>
          <button onClick={onSkip} className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-5 h-5 text-purple-300/60" />
          </button>
        </div>

        {/* Prompt */}
        <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b border-purple-800/20">
          <p className="text-sm text-yellow-200/90 font-medium">Quel son définit ta semaine ?</p>
          <p className="text-xs text-purple-300/60 mt-1">Poste ton Shake pour débloquer le feed et participer au mini-jeu cercle. Mardi 9h pour tout le monde !</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Search */}
          {!selectedTrack && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un son..."
                  className="w-full pl-10 pr-4 py-2.5 bg-purple-950/30 border border-purple-800/30 rounded-full text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                </div>
              )}

              {results.map((track) => {
                const isEmbedOpen = activeEmbedId === track.id;
                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-purple-800/20 bg-purple-950/20 overflow-hidden"
                  >
                    <div className="p-2.5 flex items-center gap-3">
                      <div
                        className="relative flex-shrink-0 cursor-pointer group"
                        onClick={() => setActiveEmbedId(isEmbedOpen ? null : track.id)}
                      >
                        <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{track.title}</p>
                        <p className="text-xs text-purple-300/60 truncate">{track.artists || track.artist}</p>
                      </div>
                      <button
                        onClick={() => setSelectedTrack(track)}
                        className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full text-xs font-bold hover:opacity-90 text-black"
                      >
                        Choisir
                      </button>
                    </div>
                    <AnimatePresence>
                      {isEmbedOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5">
                            <iframe
                              src={`https://open.spotify.com/embed/track/${track.id}?theme=0`}
                              width="100%" height="152" frameBorder="0"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy" className="rounded-xl"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </>
          )}

          {/* Selected track */}
          {selectedTrack && (
            <div className="space-y-3">
              <div className="bg-purple-950/40 rounded-xl border border-yellow-500/30 p-3">
                <div className="flex gap-3">
                  <img src={selectedTrack.coverUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{selectedTrack.title}</p>
                    <p className="text-xs text-purple-300/60 truncate">{selectedTrack.artist}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="text-purple-400/50 hover:text-white self-start"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <iframe
                src={`https://open.spotify.com/embed/track/${selectedTrack.id}?theme=0`}
                width="100%" height="152" frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy" className="rounded-xl"
              />

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Pourquoi ce son aujourd'hui ? (optionnel)"
                className="w-full px-3 py-2.5 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-yellow-500"
                maxLength={280}
              />

              <label className="flex flex-col gap-2 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={publishToProfile}
                    onChange={(e) => setPublishToProfile(e.target.checked)}
                    className="w-4 h-4 rounded border-purple-600 bg-purple-950/30 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-purple-200/80">Afficher sur mon profil</span>
                </div>
                <p className="text-[11px] text-purple-300/60">Par défaut, le Shake reste privé (feed + mini-jeu cercle). Coche pour le publier sur ton profil.</p>
              </label>

              <button
                onClick={handlePost}
                disabled={posting}
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold text-black hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {posting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Partage en cours...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Partager mon Shake de la semaine</>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
