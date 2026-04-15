import { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, User, Music, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { spotify } from '../../lib/spotify';
import { searchUsers, createPost, searchCircles, joinCircle, joinCircleByCode } from '../../lib/database';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';

interface SearchViewProps {
  currentUser?: any;
  onRefreshFeed?: () => void;
}

export function SearchView({ currentUser, onRefreshFeed }: SearchViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tracks' | 'users' | 'circles'>('tracks');
  const [circleResults, setCircleResults] = useState<any[]>([]);
  const [joinedCircleIds, setJoinedCircleIds] = useState<Set<string>>(new Set());
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shakingTrackId, setShakingTrackId] = useState<string | null>(null);
  const [shakeCaption, setShakeCaption] = useState('');
  const [showCaptionFor, setShowCaptionFor] = useState<string | null>(null);
  const [shakedIds, setShakedIds] = useState<Set<string>>(new Set());
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

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
      } else if (activeTab === 'users') {
        const users = await searchUsers(searchQuery);
        setUserResults(users);
      } else {
        const circles = await searchCircles(searchQuery);
        setCircleResults(circles);
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

  const toggleEmbed = (id: string) => {
    setActiveEmbedId(activeEmbedId === id ? null : id);
  };

  const hasQuery = searchQuery.length >= 2;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Search Bar */}
      <div className="sticky top-0 z-30 bg-[#0a0012] pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un son, artiste ou @ami..."
            className="w-full pl-11 pr-4 py-3 bg-rose-950/20 border border-rose-800/30 rounded-full text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500 transition-colors"
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
                  : 'bg-rose-950/25 text-rose-200/70 hover:text-white'
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
                  : 'bg-rose-950/25 text-rose-200/70 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Amis
            </button>
            <button
              onClick={() => setActiveTab('circles')}
              className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'circles'
                  ? 'bg-purple-500 text-white'
                  : 'bg-rose-950/25 text-rose-200/70 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Cercles
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
            trackResults.map((track, index) => {
              const isEmbedOpen = activeEmbedId === `search-${track.id}`;
              const embedUrl = `https://open.spotify.com/embed/track/${track.id}`;

              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isEmbedOpen
                      ? 'bg-rose-950/25 border-purple-600/40 shadow-lg shadow-purple-500/10'
                      : 'bg-rose-950/20 hover:bg-rose-950/25 border-rose-800/25'
                  }`}
                >
                  <div className="p-3 flex items-center gap-3">
                    {/* Cover - click to play */}
                    <div
                      className="relative flex-shrink-0 group cursor-pointer"
                      onClick={() => toggleEmbed(`search-${track.id}`)}
                    >
                      <img src={track.coverUrl} alt={track.title} className={`w-14 h-14 rounded-lg object-cover transition-all ${isEmbedOpen ? 'ring-2 ring-purple-500/50' : ''}`} />
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

                    <div className="flex-1 text-left min-w-0">
                      <h3 className="font-semibold text-sm text-white truncate">{track.title}</h3>
                      <p className="text-xs text-rose-200/70 truncate">{track.artists || track.artist}</p>
                      <p className="text-xs text-rose-300/50 truncate">{track.album}</p>
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

                  {/* Spotify Embed */}
                  <AnimatePresence>
                    {isEmbedOpen && (
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
                            width="100%"
                            height="152"
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-xl"
                            title={`${track.title} - ${track.artist}`}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Caption input */}
                  <AnimatePresence>
                    {showCaptionFor === track.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 flex gap-2">
                          <input
                            type="text"
                            value={shakeCaption}
                            onChange={(e) => setShakeCaption(e.target.value)}
                            placeholder="Un commentaire ? (optionnel)"
                            className="flex-1 px-3 py-2 bg-rose-950/25 border border-purple-700/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
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
                            className="px-2 py-2 text-rose-300/70 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Music className="w-10 h-10 text-purple-600 mx-auto mb-2" />
              <p className="text-rose-200/70 text-sm">Aucun résultat pour "{searchQuery}"</p>
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
                className="w-full bg-rose-950/20 hover:bg-rose-950/25 rounded-xl p-3 flex items-center gap-3 transition-colors border border-rose-800/25"
              >
                <img
                  src={user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-purple-700/30"
                />
                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-semibold text-sm text-white truncate">{user.display_name || user.username}</h3>
                  <p className="text-xs text-purple-400">@{user.username}</p>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-8">
              <User className="w-10 h-10 text-purple-600 mx-auto mb-2" />
              <p className="text-rose-200/70 text-sm">Aucun utilisateur trouvé pour "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Circle results */}
      {hasQuery && activeTab === 'circles' && !loading && (
        <div className="space-y-2">
          {circleResults.length > 0 ? (
            circleResults.map((circle: any, index) => (
              <motion.div
                key={circle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-rose-950/20 hover:bg-rose-950/25 rounded-xl p-3 flex items-center gap-3 border border-rose-800/25"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-white truncate">{circle.name}</h3>
                  <p className="text-xs text-rose-300/70">Cercle</p>
                </div>
                {joinedCircleIds.has(circle.id) ? (
                  <span className="text-xs text-green-400 font-semibold px-3">Rejoint !</span>
                ) : (
                  <button
                    onClick={async () => {
                      const r = await joinCircle(circle.id);
                      if (r.success) setJoinedCircleIds(new Set([...joinedCircleIds, circle.id]));
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold hover:opacity-90"
                  >
                    Rejoindre
                  </button>
                )}
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-purple-600 mx-auto mb-2" />
              <p className="text-rose-200/70 text-sm">Aucun cercle trouvé pour "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Default empty state — discover */}
      {!hasQuery && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-20 h-20 mb-5 rounded-full bg-gradient-to-br from-purple-900/40 to-pink-900/40 flex items-center justify-center border border-purple-700/20">
            <SearchIcon className="w-8 h-8 text-purple-400/60" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Découvre de la musique</h3>
          <p className="text-sm text-rose-300/50 max-w-xs leading-relaxed">
            Recherche un son, un artiste, un ami ou un cercle musical
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Hip-hop', 'R&B', 'Drill', 'Afro', 'Pop', 'Jazz', 'Trap'].map(genre => (
              <button
                key={genre}
                onClick={() => setSearchQuery(genre)}
                className="px-3 py-1.5 bg-rose-950/25 border border-rose-800/25 rounded-full text-sm text-rose-200/60 hover:text-white hover:border-purple-600/40 transition-colors"
              >
                {genre}
              </button>
            ))}
          </div>
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
