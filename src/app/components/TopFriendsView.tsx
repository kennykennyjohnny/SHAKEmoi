import { useState, useEffect } from 'react';
import { TrendingUp, Play, Users, Loader2, Headphones, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getFriendsTrending } from '../../lib/database';
import { getPlatformUrl } from '../../lib/odesli';

interface TopFriendsViewProps {
  currentUser: any;
}

export function TopFriendsView({ currentUser }: TopFriendsViewProps) {
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const data = await getFriendsTrending(7, 20);
      setTrending(data);
    } catch (err) {
      console.error('Error loading trending:', err);
    } finally {
      setLoading(false);
    }
  };

  const openInMusicApp = (track: any) => {
    const platform = currentUser?.musicService || 'spotify';
    const url = getPlatformUrl({
      spotify_url: track.spotify_url,
      apple_music_url: track.latest_post?.apple_music_url,
      deezer_url: track.latest_post?.deezer_url,
      youtube_url: track.latest_post?.youtube_url,
      youtube_music_url: track.latest_post?.youtube_music_url,
      tidal_url: track.latest_post?.tidal_url,
      odesli_page_url: track.latest_post?.odesli_page_url,
    }, platform);
    if (url) window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
        <p className="text-purple-400/50">Chargement des tendances...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        Top de tes amis
      </h2>
      <p className="text-xs text-purple-400/50 mb-4">Les sons les plus partagés cette semaine dans ton cercle</p>

      {trending.length > 0 ? (
        <div className="space-y-2">
          {trending.map((track, index) => {
            const trackId = track.track_id || (track.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
            const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}` : null;
            const isEmbedOpen = activeEmbedId === `trend-${index}`;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isEmbedOpen
                    ? 'bg-purple-950/40 border-purple-600/40 shadow-lg shadow-purple-500/10'
                    : 'bg-purple-950/20 hover:bg-purple-950/40 border-purple-800/20'
                }`}
              >
                <div className="p-3 flex items-center gap-3">
                  <span className="text-lg font-bold text-purple-500 w-7 text-center flex-shrink-0">{index + 1}</span>
                  <div
                    className="relative flex-shrink-0 cursor-pointer group"
                    onClick={() => setActiveEmbedId(isEmbedOpen ? null : `trend-${index}`)}
                  >
                    <img src={track.cover_url} alt={track.track_name} className={`w-14 h-14 rounded-lg object-cover ${isEmbedOpen ? 'ring-2 ring-purple-500/50' : ''}`} />
                    <div className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity ${
                      isEmbedOpen ? 'bg-black/40 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'
                    }`}>
                      {isEmbedOpen ? (
                        <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <span className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                            <span className="w-0.5 h-4 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                            <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
                          </div>
                        </div>
                      ) : (
                        <Play className="w-5 h-5 text-white fill-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-white truncate">{track.track_name}</h3>
                    <p className="text-xs text-purple-300/60 truncate">{track.artist}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-purple-400/70 flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" />
                        {track.share_count} partage{track.share_count > 1 ? 's' : ''}
                      </span>
                      <span className="text-purple-600/30">·</span>
                      <span className="text-xs text-purple-400/50">
                        {track.sharers.slice(0, 3).map((s: any) => `@${s?.username}`).join(', ')}
                        {track.sharers.length > 3 && ` +${track.sharers.length - 3}`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openInMusicApp(track)}
                    className="p-2 rounded-full bg-purple-600/10 hover:bg-purple-600/20 transition-colors"
                  >
                    <Headphones className="w-4 h-4 text-purple-400" />
                  </button>
                </div>

                {/* Embed */}
                <AnimatePresence>
                  {isEmbedOpen && embedUrl && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3">
                        <iframe
                          src={`${embedUrl}?theme=0&utm_source=generator`}
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
        </div>
      ) : (
        <div className="text-center py-12">
          <Music className="w-12 h-12 text-purple-600 mx-auto mb-2 opacity-50" />
          <p className="text-purple-300/50">Aucune tendance pour le moment</p>
          <p className="text-xs text-purple-400/30 mt-1">Suis des amis et partage des sons !</p>
        </div>
      )}
    </div>
  );
}
