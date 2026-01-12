import { useState, useEffect } from 'react';
import { TrendingUp, Flame, Clock, Play, Loader2, Heart, BarChart3, Youtube } from 'lucide-react';
import { motion } from 'motion/react';
import { getTopPosts } from '../../lib/database';
import { getYouTubeTopFrance } from '../../lib/youtube';

interface TrendingBarProps {
  onPlayTrack: (track: any) => void;
}

type TabType = 'likes' | 'youtube';

export function TrendingBar({ onPlayTrack }: TrendingBarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('likes');
  const [likesTop, setLikesTop] = useState<any[]>([]);
  const [youtubeTop, setYoutubeTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      setLoading(true);
      
      // Load Top Likes from database
      const posts = await getTopPosts(10);
      const likesData = posts.map((post: any) => ({
        track: {
          id: post.track_id || post.id,
          title: post.track_name,
          artist: post.artist,
          coverUrl: post.cover_url,
          previewUrl: post.preview_url,
          spotifyUrl: post.spotify_url,
          youtubeVideoId: post.youtube_video_id
        },
        likes: post.likes_count || 0,
        shakes: posts.filter((p: any) => p.track_id === post.track_id).length
      }));
      setLikesTop(likesData);

      // Load YouTube Top France
      const ytTop = await getYouTubeTopFrance();
      setYoutubeTop(ytTop.map((video: any, index: number) => ({
        track: {
          id: video.videoId,
          title: video.title,
          artist: video.artist,
          coverUrl: video.thumbnail,
          youtubeVideoId: video.videoId
        },
        position: index + 1
      })));
      
    } catch (err) {
      console.error('Error loading trending:', err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold">Tendances</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('likes')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'likes'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-zinc-800 text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-4 h-4" />
            <span>Top Likes</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'youtube'
              ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white'
              : 'bg-zinc-800 text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Youtube className="w-4 h-4" />
            <span>Top YouTube</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-2" />
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      ) : (
        <>
          {/* Top Likes */}
          {activeTab === 'likes' && (
            <div className="space-y-2">
              {likesTop.length === 0 ? (
                <div className="bg-zinc-900 rounded-xl p-6 text-center">
                  <p className="text-gray-400 text-sm">Aucune tendance pour le moment</p>
                  <p className="text-gray-500 text-xs mt-1">Commence à shaker des sons !</p>
                </div>
              ) : (
                likesTop.map((item, index) => (
                  <motion.div
                    key={item.track.id + index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-900 hover:bg-zinc-800 rounded-lg p-3 transition-colors group cursor-pointer"
                    onClick={() => onPlayTrack(item.track)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <span className="absolute -left-1 -top-1 w-5 h-5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-xs font-bold z-10">
                          {index + 1}
                        </span>
                        <img
                          src={item.track.coverUrl}
                          alt={item.track.title}
                          className="w-12 h-12 rounded-md object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{item.track.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{item.track.artist}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-pink-400 font-medium flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {item.likes}
                          </span>
                        </div>
                      </div>

                      <TrendingUp className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Top YouTube */}
          {activeTab === 'youtube' && (
            <div className="space-y-2">
              {youtubeTop.length === 0 ? (
                <div className="bg-zinc-900 rounded-xl p-6 text-center">
                  <Youtube className="w-12 h-12 mx-auto mb-2 text-red-500" />
                  <p className="text-gray-400 text-sm">Chargement du Top YouTube...</p>
                </div>
              ) : (
                youtubeTop.map((item, index) => (
                  <motion.div
                    key={item.track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-900 hover:bg-zinc-800 rounded-lg p-3 transition-colors group cursor-pointer"
                    onClick={() => onPlayTrack(item.track)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <span className={`absolute -left-1 -top-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                          'bg-gradient-to-br from-red-600 to-pink-600'
                        }`}>
                          {index + 1}
                        </span>
                        <img
                          src={item.track.coverUrl}
                          alt={item.track.title}
                          className="w-12 h-12 rounded-md object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                          <Youtube className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{item.track.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{item.track.artist}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                            <Youtube className="w-3 h-3" />
                            Populaire
                          </span>
                        </div>
                      </div>

                      <TrendingUp className="w-4 h-4 text-red-500 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Quick stats */}
      {activeTab === 'likes' && likesTop.length > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold">Statistiques</h3>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Total likes</span>
              <span className="text-white font-semibold">{likesTop.reduce((sum, t) => sum + t.likes, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracks en tendance</span>
              <span className="text-white font-semibold">{likesTop.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
