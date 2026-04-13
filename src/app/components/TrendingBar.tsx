import { useState, useEffect } from 'react';
import { Flame, Play, Loader2, Heart, MoreHorizontal, Send, ExternalLink, MessageCircle, Crown, Medal, Award, Music, Sparkles, Zap, Moon, Sun, Coffee, PartyPopper, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTopPosts } from '../../lib/database';
import { SendSongDialog } from './SendSongDialog';

interface TrendingBarProps {
  onPlayTrack: (track: any) => void;
}

// Spotify mood playlists - curated embeds
const MOOD_PLAYLISTS = [
  {
    id: 'energy',
    name: 'Énergie',
    icon: <Zap className="w-4 h-4" />,
    color: 'from-orange-500 to-red-500',
    // Spotify "Beast Mode" or equivalent popular workout playlist
    embedId: '37i9dQZF1DX76Wlfdnj7AP',
  },
  {
    id: 'chill',
    name: 'Chill',
    icon: <Moon className="w-4 h-4" />,
    color: 'from-blue-500 to-purple-500',
    // Spotify "Chill Hits"
    embedId: '37i9dQZF1DX4WYpdgoIcn6',
  },
  {
    id: 'happy',
    name: 'Good Vibes',
    icon: <Sun className="w-4 h-4" />,
    color: 'from-yellow-400 to-orange-500',
    // Spotify "Happy Hits"
    embedId: '37i9dQZF1DXdPec7aLTmlC',
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: <Coffee className="w-4 h-4" />,
    color: 'from-emerald-500 to-teal-500',
    // Spotify "Deep Focus"
    embedId: '37i9dQZF1DWZeKCadgRdKQ',
  },
  {
    id: 'party',
    name: 'Soirée',
    icon: <PartyPopper className="w-4 h-4" />,
    color: 'from-pink-500 to-purple-500',
    // Spotify "Party Hits"
    embedId: '37i9dQZF1DXaXB8fQg7xif',
  },
];

type TabType = 'top' | 'moods';

export function TrendingBar({ onPlayTrack }: TrendingBarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('top');
  const [likesTop, setLikesTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      setLoading(true);
      const posts = await getTopPosts(10);
      const likesData = posts.map((post: any) => ({
        id: post.id,
        track: {
          id: post.track_id || post.id,
          title: post.track_name,
          artist: post.artist,
          coverUrl: post.cover_url,
          previewUrl: post.preview_url,
          spotifyUrl: post.spotify_url,
          spotifyEmbedUrl: post.spotify_embed_url || (post.track_id ? `https://open.spotify.com/embed/track/${post.track_id}` : null),
        },
        likes: post.likes_count || 0,
        comments: post.comments_count || 0,
        reshakes: post.reshakes_count || 0
      }));
      setLikesTop(likesData);
    } catch (err) {
      console.error('Error loading trending:', err);
    } finally {
      setLoading(false);
    }
  };

  const openInApp = (track: any) => {
    if (track.spotifyUrl) {
      window.open(track.spotifyUrl, '_blank');
    } else if (track.id) {
      window.open(`https://open.spotify.com/track/${track.id}`, '_blank');
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300 drop-shadow-[0_0_4px_rgba(209,213,219,0.4)]" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600 drop-shadow-[0_0_4px_rgba(217,119,6,0.4)]" />;
    return (
      <span className="w-6 h-6 rounded-full bg-purple-900/60 border border-purple-700/40 flex items-center justify-center text-xs font-bold text-purple-300">
        {index + 1}
      </span>
    );
  };

  const getRankGlow = (index: number) => {
    if (index === 0) return 'border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-transparent hover:border-yellow-500/50';
    if (index === 1) return 'border-gray-400/20 bg-gradient-to-r from-gray-400/5 to-transparent hover:border-gray-400/40';
    if (index === 2) return 'border-amber-600/20 bg-gradient-to-r from-amber-600/5 to-transparent hover:border-amber-600/40';
    return 'border-purple-800/20 hover:border-purple-700/40';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <Flame className="w-6 h-6 text-orange-500" />
            <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Tendances
            </h2>
            <p className="text-[10px] text-purple-400/60 uppercase tracking-widest">Les sons du moment</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('top')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'top'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-purple-950/40 border border-purple-800/30 text-purple-300 hover:text-white hover:bg-purple-900/40'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" />
              <span>Top Shakes</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('moods')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'moods'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-purple-950/40 border border-purple-800/30 text-purple-300 hover:text-white hover:bg-purple-900/40'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Headphones className="w-4 h-4" />
              <span>Moods</span>
            </div>
          </button>
        </div>

        {/* Mood Playlists Tab */}
        {activeTab === 'moods' && (
          <div className="space-y-3">
            {/* Mood selector pills */}
            <div className="flex flex-wrap gap-2">
              {MOOD_PLAYLISTS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => setActiveMood(activeMood === mood.id ? null : mood.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                    activeMood === mood.id
                      ? `bg-gradient-to-r ${mood.color} text-white shadow-lg`
                      : 'bg-purple-950/40 border border-purple-800/30 text-purple-300 hover:bg-purple-900/40'
                  }`}
                >
                  {mood.icon}
                  {mood.name}
                </button>
              ))}
            </div>

            {/* Active mood playlist embed */}
            <AnimatePresence mode="wait">
              {activeMood ? (
                <motion.div
                  key={activeMood}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {(() => {
                    const mood = MOOD_PLAYLISTS.find(m => m.id === activeMood);
                    if (!mood) return null;
                    return (
                      <div className="rounded-xl overflow-hidden border border-purple-800/30">
                        <iframe
                          src={`https://open.spotify.com/embed/playlist/${mood.embedId}?theme=0&utm_source=generator`}
                          width="100%"
                          height="352"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-xl"
                          title={`Playlist ${mood.name}`}
                        />
                      </div>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-purple-950/30 rounded-2xl p-6 text-center border border-purple-800/20"
                >
                  <Headphones className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-purple-300 text-sm font-medium">Choisis ton mood</p>
                  <p className="text-purple-500/50 text-xs mt-1">et découvre la playlist parfaite</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Top Shakes Tab */}
        {activeTab === 'top' && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <Music className="w-5 h-5 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-purple-400/60 mt-4">Chargement des tendances...</p>
              </div>
            ) : likesTop.length === 0 ? (
              <div className="bg-purple-950/30 rounded-2xl p-8 text-center border border-purple-800/20">
                <Music className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                <p className="text-purple-300 text-sm font-medium">Aucune tendance pour le moment</p>
                <p className="text-purple-500/50 text-xs mt-1">Shake un son pour lancer le mouvement !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {likesTop.map((item, index) => {
                  const isExpanded = expandedTrackId === item.id;

                  return (
                    <motion.article
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 30 }}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isExpanded ? 'border-purple-600/40 bg-purple-950/40' : getRankGlow(index)
                      }`}
                    >
                      <div
                        className="p-3 flex gap-3 items-center group cursor-pointer"
                        onClick={() => setExpandedTrackId(isExpanded ? null : item.id)}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0">
                          {getRankBadge(index)}
                        </div>

                        {/* Cover */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={item.track.coverUrl}
                            alt={item.track.title}
                            className={`w-12 h-12 rounded-lg object-cover ${index === 0 ? 'ring-2 ring-yellow-500/40' : ''}`}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-white truncate">{item.track.title}</h3>
                          <p className="text-xs text-purple-300/60 truncate">{item.track.artist}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-pink-400/80 flex items-center gap-1">
                              <Heart className="w-2.5 h-2.5" />
                              {item.likes}
                            </span>
                            <span className="text-[10px] text-purple-400/60 flex items-center gap-1">
                              <MessageCircle className="w-2.5 h-2.5" />
                              {item.comments}
                            </span>
                          </div>
                        </div>

                        {/* Menu */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === item.id ? null : item.id);
                            }}
                            className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4 text-purple-400/60" />
                          </button>

                          <AnimatePresence>
                            {menuOpenId === item.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                className="absolute right-0 mt-1 w-48 bg-purple-950 border border-purple-800/40 rounded-xl shadow-xl shadow-black/40 z-20 overflow-hidden"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSendSongTrack(item.track);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/60 transition-colors flex items-center gap-2 text-purple-200"
                                >
                                  <Send className="w-4 h-4 text-purple-400" />
                                  Envoyer à un ami
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInApp(item.track);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/60 transition-colors flex items-center gap-2 text-purple-200"
                                >
                                  <ExternalLink className="w-4 h-4 text-purple-400" />
                                  Ouvrir dans l'app
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Expanded Spotify Embed */}
                      <AnimatePresence>
                        {isExpanded && item.track.spotifyEmbedUrl && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3">
                              <iframe
                                src={`${item.track.spotifyEmbedUrl}?theme=0&utm_source=generator`}
                                width="100%"
                                height="152"
                                frameBorder="0"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                className="rounded-xl"
                                title={`${item.track.title} - ${item.track.artist}`}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Send Song Dialog */}
      <AnimatePresence>
        {sendSongTrack && (
          <SendSongDialog
            track={sendSongTrack}
            onClose={() => setSendSongTrack(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
