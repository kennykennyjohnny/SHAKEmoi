import { useState, useEffect } from 'react';
import { TrendingUp, Play, Users, Loader2, Headphones, Music, Crown } from 'lucide-react';
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
  const [period, setPeriod] = useState<7 | 30>(7);

  useEffect(() => { loadTrending(); }, [period]);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const data = await getFriendsTrending(period, 20);
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

  const top3 = trending.slice(0, 3);
  const rest = trending.slice(3);

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header + period selector */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-400" />
            Top de tes amis
          </h2>
          <p className="text-xs text-rose-300/50 mt-0.5">Sons les plus partagés dans ton réseau</p>
        </div>
        <div className="flex bg-rose-950/25 rounded-full p-0.5 border border-rose-800/20">
          {([7, 30] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${period === p ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm' : 'text-rose-300/50 hover:text-white'}`}
            >
              {p === 7 ? '7 jours' : '30 jours'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
          <p className="text-rose-300/50 text-sm">Calcul des tendances...</p>
        </div>
      ) : trending.length > 0 ? (
        <div className="space-y-4">
          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-rose-300/40 uppercase tracking-wider mb-3">Podium</p>
              <div className="flex items-end justify-center gap-3">
                {/* 2nd */}
                {top3[1] && (
                  <PodiumCard track={top3[1]} rank={2} onPlay={() => setActiveEmbedId(activeEmbedId === 'pod-1' ? null : 'pod-1')} onOpen={() => openInMusicApp(top3[1])} isOpen={activeEmbedId === 'pod-1'} height="h-28" />
                )}
                {/* 1st */}
                {top3[0] && (
                  <PodiumCard track={top3[0]} rank={1} onPlay={() => setActiveEmbedId(activeEmbedId === 'pod-0' ? null : 'pod-0')} onOpen={() => openInMusicApp(top3[0])} isOpen={activeEmbedId === 'pod-0'} height="h-36" crown />
                )}
                {/* 3rd */}
                {top3[2] && (
                  <PodiumCard track={top3[2]} rank={3} onPlay={() => setActiveEmbedId(activeEmbedId === 'pod-2' ? null : 'pod-2')} onOpen={() => openInMusicApp(top3[2])} isOpen={activeEmbedId === 'pod-2'} height="h-20" />
                )}
              </div>

              {/* Embed for podium */}
              <AnimatePresence>
                {(activeEmbedId === 'pod-0' || activeEmbedId === 'pod-1' || activeEmbedId === 'pod-2') && (() => {
                  const idx = activeEmbedId === 'pod-0' ? 0 : activeEmbedId === 'pod-1' ? 1 : 2;
                  const t = top3[idx];
                  const trackId = t?.track_id || t?.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1];
                  const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}` : null;
                  if (!embedUrl) return null;
                  return (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                      <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          )}

          {/* Rest of the list */}
          {rest.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-rose-300/40 uppercase tracking-wider mb-3">Suite du classement</p>
              <div className="space-y-2">
                {rest.map((track, index) => {
                  const realIndex = index + 3;
                  const trackId = track.track_id || (track.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
                  const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}` : null;
                  const isOpen = activeEmbedId === `list-${realIndex}`;

                  return (
                    <motion.div
                      key={realIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`rounded-xl border transition-all overflow-hidden ${isOpen ? 'bg-rose-950/30 border-purple-600/40' : 'bg-rose-950/15 hover:bg-rose-950/25 border-rose-800/20'}`}
                    >
                      <div className="p-3 flex items-center gap-3">
                        <span className="text-sm font-bold text-rose-300/50 w-6 text-center flex-shrink-0">{realIndex + 1}</span>
                        <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : `list-${realIndex}`)}>
                          <img src={track.cover_url} alt={track.track_name} className={`w-12 h-12 rounded-lg object-cover ${isOpen ? 'ring-2 ring-purple-500/50' : ''}`} />
                          <div className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity ${isOpen ? 'bg-black/40 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'}`}>
                            {isOpen ? (
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <div className="flex items-center gap-0.5">
                                  <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                                  <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
                                </div>
                              </div>
                            ) : <Play className="w-4 h-4 text-white fill-white" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-white truncate">{track.track_name}</h3>
                          <p className="text-xs text-rose-200/60 truncate">{track.artist}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-rose-300/50 flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              {track.share_count} fois
                            </span>
                            <span className="text-rose-700/30">·</span>
                            <span className="text-xs text-rose-300/40 truncate">
                              {track.sharers.slice(0, 2).map((s: any) => `@${s?.username}`).join(', ')}
                              {track.sharers.length > 2 && ` +${track.sharers.length - 2}`}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => openInMusicApp(track)} className="p-1.5 rounded-full bg-rose-900/20 hover:bg-purple-600/20 transition-colors flex-shrink-0">
                          <Headphones className="w-4 h-4 text-rose-300/60 hover:text-purple-400" />
                        </button>
                      </div>
                      <AnimatePresence>
                        {isOpen && embedUrl && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-3 pb-3">
                              <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-20 h-20 mb-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-full flex items-center justify-center border border-purple-700/20">
            <Music className="w-8 h-8 text-purple-400/50" />
          </div>
          <p className="font-semibold text-rose-200/70">Aucune tendance sur {period === 7 ? '7 jours' : '30 jours'}</p>
          <p className="text-xs text-rose-300/40 mt-1.5 max-w-xs">Suis des amis et partage des sons pour voir les tendances de ton réseau</p>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ track, rank, onPlay, onOpen, isOpen, height, crown }: {
  track: any; rank: number; onPlay: () => void; onOpen: () => void; isOpen: boolean; height: string; crown?: boolean;
}) {
  const rankColors: Record<number, string> = {
    1: 'from-yellow-500 to-amber-600',
    2: 'from-slate-400 to-slate-500',
    3: 'from-amber-700 to-amber-800',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="flex-1 flex flex-col items-center gap-2 max-w-[110px]"
    >
      {crown && (
        <Crown className="w-5 h-5 text-yellow-400 animate-bounce" />
      )}
      <div className="relative cursor-pointer group" onClick={onPlay}>
        <img src={track.cover_url} alt={track.track_name} className={`w-16 h-16 rounded-xl object-cover transition-all ${isOpen ? 'ring-2 ring-purple-500/70 scale-105' : 'hover:scale-105'}`} />
        <div className={`absolute inset-0 flex items-center justify-center rounded-xl transition-opacity ${isOpen ? 'bg-black/40 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'}`}>
          {isOpen ? (
            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <div className="flex items-center gap-0.5">
                <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
              </div>
            </div>
          ) : <Play className="w-4 h-4 text-white fill-white" />}
        </div>
        <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br ${rankColors[rank]} flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
          {rank}
        </div>
      </div>

      <div className={`w-full ${height} bg-gradient-to-t ${rank === 1 ? 'from-yellow-500/20 to-transparent border-yellow-500/30' : rank === 2 ? 'from-slate-500/15 to-transparent border-slate-500/20' : 'from-amber-700/15 to-transparent border-amber-700/20'} border-t-2 rounded-b-xl flex flex-col items-center justify-start pt-2 px-1`}>
        <p className="text-xs font-bold text-center text-white leading-tight line-clamp-2">{track.track_name}</p>
        <p className="text-[10px] text-rose-300/50 truncate w-full text-center mt-0.5">{track.artist}</p>
        <div className="flex items-center gap-1 mt-1">
          <Users className="w-2.5 h-2.5 text-rose-300/40" />
          <span className="text-[10px] text-rose-300/50">{track.share_count}</span>
        </div>
      </div>
    </motion.div>
  );
}
