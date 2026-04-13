import { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, User, Music, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { spotify } from '../../lib/spotify';
import { searchUsers, getTopPosts, createPost } from '../../lib/database';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';

interface SearchViewProps {
  currentUser?: any;
  onPlayTrack: (track: any) => void;
  onRefreshFeed?: () => void;
}

export function SearchView({ currentUser, onPlayTrack, onRefreshFeed }: SearchViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tracks' | 'users'>('tracks');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [shakingTrackId, setShakingTrackId] = useState<string | null>(null);
  const [shakeCaption, setShakeCaption] = useState('');
  const [showCaptionFor, setShowCaptionFor] = useState<string | null>(null);
  const [shakedIds, setShakedIds] = useState<Set<string>>(new Set());
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);

  useEffect(() => {
    loadTopPosts();
  }, []);

  const loadTopPosts = async () => {
    setLoadingTop(true);
    try {
      const posts = await getTopPosts(20);
      setTopPosts(posts);
    } catch (error) {
      console.error('Error loading top posts:', error);
    } finally {
      setLoadingTop(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length < 2) {
      setTrackResults([]);
      setUserResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const performSearch = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tracks') {
        const tracks = await spotify.searchTracks(searchQuery);
        setTrackResults(tracks.map((t: any) => ({
          id: t.id,
          title: t.name,
          artist: t.artist,
          artists: t.artists,
          album: t.album,
          coverUrl: t.cover,
          previewUrl: t.preview_url,
          spotifyUrl: t.spotify_url,
        })));
      } else {
        const users = await searchUsers(searchQuery);
        setUserResults(users);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShake = async (track: any) => {
    setShakingTrackId(track.id);
    try {
      const result = await createPost(
        track.title,
        track.artist,
        track.coverUrl,
        shakeCaption,
        track.previewUrl,
        track.spotifyUrl,
        track.id
      );

      if (result.success) {
        setShakedIds(new Set([...shakedIds, track.id]));
        setShowCaptionFor(null);
        setShakeCaption('');
        if (onRefreshFeed) onRefreshFeed();
      }
    } catch (error) {
      console.error('Error shaking:', error);
    } finally {
      setShakingTrackId(null);
    }
  };

  const hasQuery = searchQuery.length >= 2;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Search Bar */}
      <div className="sticky top-0 z-30 bg-[#0a0012] pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un son, artiste ou @ami..."
            className="w-full pl-11 pr-4 py-3 bg-purple-950/30 border border-purple-800/30 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
            autoFocus
          />
        </div>

        {hasQuery && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('tracks')}
              className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'tracks'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-950/40 text-gray-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              Sons
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-950/40 text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Amis
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      )}

      {/* Track results */}
      {hasQuery && activeTab === 'tracks' && !loading && (
        <div className="space-y-2">
          {trackResults.length > 0 ? (
            trackResults.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-purple-950/20 hover:bg-purple-950/40 rounded-xl p-3 border border-purple-800/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => onPlayTrack(track)}>
                    <img src={track.coverUrl} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-semibold text-sm text-white truncate">{track.title}</h3>
                    <p className="text-xs text-gray-400 truncate">{track.artists || track.artist}</p>
                    <p className="text-xs text-gray-500 truncate">{track.album}</p>
                  </div>
                  {/* Shake button */}
                  {shakedIds.has(track.id) ? (
                    <span className="text-xs text-green-400 font-semibold px-3 py-1.5">Shaké !</span>
                  ) : showCaptionFor === track.id ? null : (
                    <button
                      onClick={() => setShowCaptionFor(track.id)}
                      className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Shake
                    </button>
                  )}
                </div>

                {/* Caption input */}
                <AnimatePresence>
                  {showCaptionFor === track.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={shakeCaption}
                          onChange={(e) => setShakeCaption(e.target.value)}
                          placeholder="Un commentaire ? (optionnel)"
                          className="flex-1 px-3 py-2 bg-purple-950/40 border border-purple-700/30 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleShake(track);
                            if (e.key === 'Escape') { setShowCaptionFor(null); setShakeCaption(''); }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleShake(track)}
                          disabled={shakingTrackId === track.id}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                        >
                          {shakingTrackId === track.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Shake !'}
                        </button>
                        <button
                          onClick={() => { setShowCaptionFor(null); setShakeCaption(''); }}
                          className="px-2 py-2 text-gray-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8">
              <Music className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Aucun résultat pour "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* User results */}
      {hasQuery && activeTab === 'users' && !loading && (
        <div className="space-y-2">
          {userResults.length > 0 ? (
            userResults.map((user: any, index) => (
              <motion.button
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setProfilePreview({ userId: user.id, username: user.username })}
                className="w-full bg-purple-950/20 hover:bg-purple-950/40 rounded-xl p-3 flex items-center gap-3 transition-colors border border-purple-800/20"
              >
                <img
                  src={user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-semibold text-sm text-white truncate">{user.display_name || user.username}</h3>
                  <p className="text-xs text-purple-400">@{user.username}</p>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-8">
              <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Aucun utilisateur trouvé pour "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Default view: Top posts */}
      {!hasQuery && (
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="text-orange-500">🔥</span> Top Shakemoi
          </h2>
          {loadingTop ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : topPosts.length > 0 ? (
            <div className="space-y-2">
              {topPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-purple-950/20 hover:bg-purple-950/40 rounded-xl p-3 flex items-center gap-3 transition-colors border border-purple-800/20 group"
                >
                  <span className="text-lg font-bold text-purple-500 w-7 text-center">{index + 1}</span>
                  <div className="relative flex-shrink-0 cursor-pointer" onClick={() => onPlayTrack({
                    id: post.track_id,
                    title: post.track_name,
                    artist: post.artist,
                    coverUrl: post.cover_url,
                    previewUrl: post.preview_url,
                    spotifyUrl: post.spotify_url,
                  })}>
                    <img src={post.cover_url} alt={post.track_name} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-semibold text-sm text-white truncate">{post.track_name}</h3>
                    <p className="text-xs text-gray-400 truncate">{post.artist}</p>
                    <p className="text-xs text-gray-500">❤️ {post.likes_count || 0} {post.user ? `· @${post.user.username}` : ''}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucun post pour le moment</p>
            </div>
          )}
        </div>
      )}

      {/* Profile Preview */}
      <AnimatePresence>
        {profilePreview && (
          <ProfilePreviewDialog
            userId={profilePreview.userId}
            username={profilePreview.username}
            onClose={() => setProfilePreview(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
