import { useState, useEffect } from 'react';
import { TrendingUp, Flame, Clock, Play, Loader2, Heart, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';
import { getTopPosts } from '../../lib/database';

interface TrendingBarProps {
  onPlayTrack: (track: any) => void;
}

type TabType = 'community' | 'spotify';

export function TrendingBar({ onPlayTrack }: TrendingBarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('community');
  const [communityTop, setCommunityTop] = useState<any[]>([]);
  const [spotifyTop, setSpotifyTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      setLoading(true);
      
      // Load community top from database
      const posts = await getTopPosts(10);
      const communityData = posts.map((post: any) => ({
        track: {
          id: post.track_id || post.id,
          title: post.track_name,
          artist: post.artist,
          coverUrl: post.cover_url,
          previewUrl: post.preview_url,
          spotifyUrl: post.spotify_url
        },
        count: post.likes_count || 0,
        totalLikes: post.likes_count || 0
      }));
      setCommunityTop(communityData);

      // Simulate Spotify Top 100 France (in production, use Spotify API)
      // For now, we'll use trending French tracks as placeholder
      const spotifyTopData = [
        {
          track: {
            id: '1',
            title: 'Imagine',
            artist: 'Carbonne',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273c8b444df094279e70d0ed856',
            previewUrl: '',
            spotifyUrl: 'https://open.spotify.com/track/5WQ8hCRguTXa43RX6z6HUB'
          },
          position: 1,
          streams: '15.2M'
        },
        {
          track: {
            id: '2',
            title: 'Ratatata',
            artist: 'Naps',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273f45ed2f4bb6c370d975c55f4',
            previewUrl: '',
            spotifyUrl: 'https://open.spotify.com/track/4lK4hHEgKWWhjLdBhE6xXs'
          },
          position: 2,
          streams: '13.8M'
        },
        {
          track: {
            id: '3',
            title: 'Désert',
            artist: 'Tiakola',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273a5e726a6f5cf3dde1d5c891f',
            previewUrl: '',
            spotifyUrl: 'https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe'
          },
          position: 3,
          streams: '12.4M'
        },
        {
          track: {
            id: '4',
            title: 'Doudou',
            artist: 'Aya Nakamura',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b2739e13f8e1dabd8b7e53c7f5d1',
            previewUrl: '',
            spotifyUrl: 'https://open.spotify.com/track/0SH6bXNgfFoVP7jCVhLaRD'
          },
          position: 4,
          streams: '11.9M'
        },
        {
          track: {
            id: '5',
            title: 'Coco',
            artist: 'Niska',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273c2a1648be6f07e62e2b69f4c',
            previewUrl: '',
            spotifyUrl: 'https://open.spotify.com/track/4khWQ2QFpUGF9kKzgPqGUd'
          },
          position: 5,
          streams: '10.7M'
        }
      ];
      setSpotifyTop(spotifyTopData);
      
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
          onClick={() => setActiveTab('community')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'community'
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
          onClick={() => setActiveTab('spotify')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'spotify'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
              : 'bg-zinc-800 text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Top France</span>
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
          {/* Community Top */}
          {activeTab === 'community' && (
            <div className="space-y-2">
              {communityTop.length === 0 ? (
                <div className="bg-zinc-900 rounded-xl p-6 text-center">
                  <p className="text-gray-400 text-sm">Aucune tendance pour le moment</p>
                  <p className="text-gray-500 text-xs mt-1">Commence à shaker des sons !</p>
                </div>
              ) : (
                communityTop.map((item, index) => (
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
                            {item.totalLikes}
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

          {/* Spotify Top France */}
          {activeTab === 'spotify' && (
            <div className="space-y-2">
              {spotifyTop.map((item, index) => (
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
                        'bg-gradient-to-br from-green-600 to-emerald-600'
                      }`}>
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
                        <span className="text-xs text-green-400 font-medium">
                          {item.streams} écoutes
                        </span>
                      </div>
                    </div>

                    <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Quick stats */}
      {activeTab === 'community' && communityTop.length > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold">Activité récente</h3>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Total likes</span>
              <span className="text-white font-semibold">{communityTop.reduce((sum, t) => sum + t.totalLikes, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracks en tendance</span>
              <span className="text-white font-semibold">{communityTop.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
