import { useState, useEffect } from 'react';
import { TrendingUp, Flame, Play, Loader2, Heart, Youtube, MoreHorizontal, Send, ExternalLink, Repeat2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTopPosts } from '../../lib/database';
import { getYouTubeTopFrance } from '../../lib/youtube';
import { SendSongDialog } from './SendSongDialog';

interface TrendingBarProps {
  onPlayTrack: (track: any) => void;
}

type TabType = 'likes' | 'youtube';

export function TrendingBar({ onPlayTrack }: TrendingBarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('likes');
  const [likesTop, setLikesTop] = useState<any[]>([]);
  const [youtubeTop, setYoutubeTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);

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
          youtubeVideoId: post.youtube_video_id
        },
        likes: post.likes_count || 0,
        comments: post.comments_count || 0,
        reshakes: post.reshakes_count || 0
      }));
      setLikesTop(likesData);

      const ytTop = getYouTubeTopFrance();
      setYoutubeTop(ytTop.map((video: any, index: number) => ({
        id: video.videoId,
        track: {
          id: video.videoId,
          title: video.title,
          artist: video.artist,
          coverUrl: video.thumbnail,
          youtubeVideoId: video.videoId
        },
        position: index + 1,
        likes: 0,
        comments: 0,
        reshakes: 0
      })));
      
    } catch (err) {
      console.error('Error loading trending:', err);
    } finally {
      setLoading(false);
    }
  };

  const openInApp = (track: any) => {
    if (track.youtubeVideoId) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `vnd.youtube://${track.youtubeVideoId}`;
        setTimeout(() => window.open(`https://www.youtube.com/watch?v=${track.youtubeVideoId}`, '_blank'), 1500);
      } else {
        window.open(`https://www.youtube.com/watch?v=${track.youtubeVideoId}`, '_blank');
      }
    } else if (track.spotifyUrl) {
      window.open(track.spotifyUrl, '_blank');
    }
  };

  const currentList = activeTab === 'likes' ? likesTop : youtubeTop;

  return (
    <div className="h-full overflow-y-auto">
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
        ) : currentList.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">Aucune tendance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-2 flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                      'bg-gradient-to-br from-purple-600 to-pink-600'
                    }`}>
                      {index + 1}
                    </span>
                    <TrendingUp className={`w-4 h-4 ${activeTab === 'youtube' ? 'text-red-500' : 'text-pink-500'}`} />
                  </div>

                  {/* Menu 3 points */}
                  <div className="relative">
                    <button 
                      onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                      className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    <AnimatePresence>
                      {menuOpenId === item.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setSendSongTrack(item.track);
                              setMenuOpenId(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            Envoyer à un ami
                          </button>
                          <button
                            onClick={() => {
                              openInApp(item.track);
                              setMenuOpenId(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Ouvrir dans l'app
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Track Card */}
                <div className="px-4 pb-3">
                  <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg p-3 flex gap-3 group cursor-pointer hover:from-zinc-700 hover:to-zinc-800 transition-all">
                    <div className="relative flex-shrink-0">
                      <img
                        src={item.track.coverUrl}
                        alt={item.track.title}
                        className="w-16 h-16 rounded-md object-cover"
                      />
                      <button
                        onClick={() => onPlayTrack(item.track)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                      >
                        <Play className="w-6 h-6 text-white fill-white" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{item.track.title}</h3>
                      <p className="text-xs text-gray-400 truncate">{item.track.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {activeTab === 'youtube' ? (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <Youtube className="w-3 h-3" />
                            Top France
                          </span>
                        ) : (
                          <span className="text-xs text-pink-400 flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {item.likes} likes
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-2 flex items-center gap-6">
                  <button className="flex items-center gap-1.5 group">
                    <Heart className="w-5 h-5 text-gray-400 group-hover:text-pink-500 transition-colors" />
                    <span className="text-xs font-medium text-gray-400">{item.likes}</span>
                  </button>

                  <button className="flex items-center gap-1.5 group">
                    <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-xs font-medium text-gray-400">{item.comments}</span>
                  </button>

                  <button className="flex items-center gap-1.5 group">
                    <Repeat2 className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                    <span className="text-xs font-medium text-gray-400">{item.reshakes}</span>
                  </button>

                  <button 
                    onClick={() => openInApp(item.track)}
                    className="flex items-center gap-1.5 group ml-auto"
                  >
                    <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
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
