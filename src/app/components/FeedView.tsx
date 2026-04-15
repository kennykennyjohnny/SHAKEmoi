import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2, Play, MoreHorizontal, Loader2, Send, Headphones, X, Music, Search, Camera, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';
import { ReshakeDialog } from './ReshakeDialog';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';
import { SendSongDialog } from './SendSongDialog';
import { CommentsDialog } from './CommentsDialog';
import { MusicReactionsDialog } from './MusicReactionsDialog';

interface Shake {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  track: {
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    duration: string;
    previewUrl: string;
    spotifyUri: string;
    spotifyEmbedUrl: string | null;
  };
  links: {
    spotify_url: string | null;
    apple_music_url: string | null;
    deezer_url: string | null;
    youtube_url: string | null;
    youtube_music_url: string | null;
    tidal_url: string | null;
    odesli_page_url: string | null;
  };
  caption?: string;
  likes: number;
  comments: number;
  reshakes: number;
  timestamp: string;
  isLiked?: boolean;
  isReshaked?: boolean;
  reshakeFrom?: {
    id: string;
    username: string;
    displayName: string;
  };
}

interface FeedViewProps {
  currentUser: any;
  refreshFeed?: number;
  circles?: any[];
  currentFeedId?: string | null;
  onSelectFeed?: (feedId: string | null) => void;
  onCreateCircle?: () => void;
}

export function FeedView({ currentUser, refreshFeed, circles = [], currentFeedId = null, onSelectFeed, onCreateCircle }: FeedViewProps) {
  const [shakes, setShakes] = useState<Shake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reshakeDialogShake, setReshakeDialogShake] = useState<Shake | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [musicReactionsPostId, setMusicReactionsPostId] = useState<string | null>(null);

  // Circle chat input state
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showChatTrackSearch, setShowChatTrackSearch] = useState(false);
  const [chatTrackQuery, setChatTrackQuery] = useState('');
  const [chatTrackResults, setChatTrackResults] = useState<any[]>([]);
  const [chatSearching, setChatSearching] = useState(false);

  useEffect(() => {
    loadFeed();
  }, [refreshFeed, currentFeedId]);

  const activeCircle = circles.find(c => c.id === currentFeedId);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      const posts = currentFeedId ? await db.getCircleFeed(currentFeedId) : await db.getFeed();

      const shakes = await Promise.all(posts.map(async (post: any) => {
        const isLiked = await db.hasLikedPost(post.id);
        const reshakerUser = Array.isArray(post.user) ? post.user[0] : post.user;
        // Extract track_id from spotify_url for old posts missing track_id
        const trackId = post.track_id || (post.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
        // Build embed URL for ALL posts that have a track_id
        const spotifyEmbedUrl = post.spotify_embed_url || (trackId ? `https://open.spotify.com/embed/track/${trackId}` : null);
        // Normalize original_post: Supabase self-join may return array (both levels)
        const originalPost = Array.isArray(post.original_post) ? post.original_post[0] : post.original_post;
        const originalUser = Array.isArray(originalPost?.user) ? originalPost?.user[0] : originalPost?.user;
        const isReshake = !!post.is_reshake;
        const displayUser = isReshake && originalUser ? originalUser : reshakerUser;
        const displayTrack = isReshake && originalPost ? originalPost : post;

        return {
          id: post.id,
          user: {
            id: displayUser?.id || '',
            username: displayUser?.username || '',
            displayName: displayUser?.display_name || displayUser?.username || '',
            avatar: displayUser?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${displayUser?.username}&background=random`
          },
          track: {
            id: displayTrack?.track_id || trackId || post.id,
            title: displayTrack?.track_name || post.track_name,
            artist: displayTrack?.artist || post.artist,
            coverUrl: displayTrack?.cover_url || post.cover_url,
            duration: '3:00',
            previewUrl: displayTrack?.preview_url || post.preview_url || '',
            spotifyUri: displayTrack?.spotify_url || post.spotify_url || '',
            spotifyEmbedUrl: displayTrack?.spotify_embed_url || (displayTrack?.track_id ? `https://open.spotify.com/embed/track/${displayTrack.track_id}` : spotifyEmbedUrl),
          },
          links: {
            spotify_url: post.spotify_url || null,
            apple_music_url: post.apple_music_url || null,
            deezer_url: post.deezer_url || null,
            youtube_url: post.youtube_url || null,
            youtube_music_url: post.youtube_music_url || null,
            tidal_url: post.tidal_url || null,
            odesli_page_url: post.odesli_page_url || null,
          },
          caption: post.text,
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          reshakes: post.reshakes_count || 0,
          timestamp: post.created_at,
          isLiked,
          isReshaked: false,
          reshakeFrom: isReshake ? {
            id: reshakerUser.id || reshakerUser.username || '',
            username: reshakerUser.username || '',
            displayName: reshakerUser.display_name || reshakerUser.username || ''
          } : undefined
        };
      }));

      setShakes(shakes);
    } catch (err: any) {
      console.error('Error loading feed:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (shakeId: string) => {
    try {
      const shake = shakes.find(s => s.id === shakeId);
      if (!shake) return;

      if (shake.isLiked) {
        await db.unlikePost(shakeId);
        setShakes(shakes.map(s =>
          s.id === shakeId ? { ...s, isLiked: false, likes: Math.max(0, s.likes - 1) } : s
        ));
      } else {
        await db.likePost(shakeId);
        setShakes(shakes.map(s =>
          s.id === shakeId ? { ...s, isLiked: true, likes: s.likes + 1 } : s
        ));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const confirmReshake = async (comment?: string) => {
    if (!reshakeDialogShake) return;
    try {
      const result = await db.reshakePost(reshakeDialogShake.id, comment);
      if (result.success) {
        setShakes(shakes.map(shake =>
          shake.id === reshakeDialogShake.id ? { ...shake, isReshaked: true, reshakes: shake.reshakes + 1 } : shake
        ));
        await loadFeed();
      }
    } catch (err) {
      console.error('Error reshaking:', err);
    }
  };

  const openInMusicApp = (shake: Shake) => {
    const platform = currentUser?.musicService || currentUser?.preferred_platform || 'spotify';
    const trackName = shake.track.title;
    const artist = shake.track.artist;

    const links = {
      ...shake.links,
      spotify_url: shake.links.spotify_url || shake.track.spotifyUri || (shake.track.id ? `https://open.spotify.com/track/${shake.track.id}` : null),
    };

    const url = getPlatformUrl(links, platform);

    if (url) {
      window.open(url, '_blank');
    } else {
      const searchQuery = encodeURIComponent(`${trackName} ${artist}`);
      const fallbacks: Record<string, string> = {
        spotify: `https://open.spotify.com/search/${searchQuery}`,
        apple_music: `https://music.apple.com/search?term=${searchQuery}`,
        deezer: `https://www.deezer.com/search/${searchQuery}`,
        youtube_music: `https://music.youtube.com/search?q=${searchQuery}`,
        youtube: `https://www.youtube.com/results?search_query=${searchQuery}`,
        tidal: `https://listen.tidal.com/search?q=${searchQuery}`,
      };
      window.open(fallbacks[platform] || fallbacks.spotify, '_blank');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (timestamp === 'now') return "À l'instant";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handlePlayTrack = (shake: Shake) => {
    setActivePlayerId(activePlayerId === shake.id ? null : shake.id);
  };

  // Circle chat: track search debounce
  useEffect(() => {
    if (chatTrackQuery.length < 2) { setChatTrackResults([]); return; }
    const timer = setTimeout(async () => {
      setChatSearching(true);
      try {
        const tracks = await spotify.searchTracks(chatTrackQuery);
        setChatTrackResults(tracks);
      } catch {}
      setChatSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [chatTrackQuery]);

  const handleChatSendText = async () => {
    if (!chatText.trim() || chatSending) return;
    setChatSending(true);
    try {
      await db.createPost('', '', '', chatText.trim(), null, null, null);
      setChatText('');
      await loadFeed();
    } catch (err) {
      console.error('Error posting in circle:', err);
    }
    setChatSending(false);
  };

  const handleChatSendTrack = async (track: any) => {
    setChatSending(true);
    try {
      await db.createPost(
        track.name, track.artist, track.cover, '', track.preview_url, track.spotify_url, track.id
      );
      setShowChatTrackSearch(false);
      setChatTrackQuery('');
      setChatTrackResults([]);
      await loadFeed();
    } catch (err) {
      console.error('Error shaking track in circle:', err);
    }
    setChatSending(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
        <p className="text-rose-300/70">Chargement du feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={loadFeed} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (shakes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-purple-950/20 border border-purple-800/25 rounded-xl p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <Play className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">Aucun shake pour le moment</h3>
          <p className="text-purple-300/70 mb-6">Sois le premier à partager un son !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={currentFeedId ? { minHeight: '100%' } : undefined}>
      <div className={`p-4 space-y-3 ${currentFeedId ? 'flex-1' : ''}`}>
        {/* Horizontal feed selector */}
        <div className="mb-3 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-2 min-w-max px-1">
            <button
              onClick={() => onSelectFeed?.(null)}
              className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${!currentFeedId ? 'bg-purple-500 text-black' : 'bg-purple-950/30 text-purple-200 hover:bg-purple-900/60'}`}
            >
              All
            </button>
            {circles.map(circle => (
              <button
                key={circle.id}
                onClick={() => onSelectFeed?.(circle.id)}
                className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${currentFeedId === circle.id ? 'bg-purple-500 text-black' : 'bg-purple-950/30 text-purple-200 hover:bg-purple-900/60'}`}
              >
                {circle.name}
              </button>
            ))}
            {onCreateCircle && (
              <button
                onClick={onCreateCircle}
                className="px-3 py-2 rounded-full text-sm font-semibold bg-purple-950/30 text-purple-200 hover:bg-purple-900/60"
              >
                +
              </button>
            )}
          </div>
        </div>
        {activeCircle && (
          <div className="mb-3 px-4 py-3 rounded-2xl border border-purple-800/30 bg-purple-950/20 text-sm text-purple-200">
            <span className="font-semibold text-white">Cercle privé :</span> {activeCircle.name} · contenu visible uniquement aux membres
          </div>
        )}
        {shakes.map((shake, index) => {
          const isPlayerOpen = activePlayerId === shake.id;

          return (
            <motion.article
              key={shake.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border transition-all overflow-hidden ${
                isPlayerOpen
                  ? 'bg-rose-950/25 border-purple-600/40 shadow-lg shadow-purple-500/10'
                  : 'bg-rose-950/20 border-rose-800/25 hover:border-purple-700/40'
              }`}
            >
              {/* Reshake indicator — "reshaké par @friend" */}
              {shake.reshakeFrom && (
                <div className="px-4 pt-2 flex items-center gap-2 text-xs text-green-400/80">
                  <Repeat2 className="w-3 h-3" />
                  <span className="text-rose-300/70">Reshaké par</span>
                  <button
                    onClick={() => setProfilePreview({
                      userId: shake.reshakeFrom!.id || shake.reshakeFrom!.username,
                      username: shake.reshakeFrom!.username
                    })}
                    className="hover:underline font-medium text-green-400"
                  >
                    @{shake.reshakeFrom.username}
                  </button>
                </div>
              )}

              {/* User Header */}
              <div className="px-4 py-2 flex items-center gap-2">
                <button onClick={() => setProfilePreview({ userId: shake.user.id || shake.user.username, username: shake.user.username })}>
                  <img
                    src={shake.user.avatar}
                    alt={shake.user.displayName}
                    className="w-9 h-9 rounded-full object-cover hover:ring-2 hover:ring-purple-500 transition-all"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setProfilePreview({ userId: shake.user.id || shake.user.username, username: shake.user.username })}
                      className="font-semibold text-sm truncate hover:underline"
                    >
                      {shake.user.displayName}
                    </button>
                    <span className="text-purple-300/60 text-xs">@{shake.user.username}</span>
                    <span className="text-purple-400/40 text-xs">·</span>
                    <span className="text-purple-300/60 text-xs">{formatTimestamp(shake.timestamp)}</span>
                  </div>
                </div>

                {/* More Menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === shake.id ? null : shake.id)}
                    className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-rose-300/70" />
                  </button>

                  <AnimatePresence>
                    {menuOpenId === shake.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 mt-1 w-48 bg-purple-950 border border-purple-800/40 rounded-xl shadow-xl z-20 overflow-hidden"
                      >
                        <button
                          onClick={() => { setSendSongTrack(shake.track); setMenuOpenId(null); }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/50 transition-colors flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Envoyer à un ami
                        </button>
                        <button
                          onClick={() => { openInMusicApp(shake); setMenuOpenId(null); }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-900/50 transition-colors flex items-center gap-2"
                        >
                          <Headphones className="w-4 h-4" />
                          Écouter
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Caption */}
              {shake.caption && (
                <div className="px-4 pb-2">
                  <p className="text-sm leading-relaxed">{shake.caption}</p>
                </div>
              )}

              {/* Track Card - clickable cover to launch embed */}
              <div className="px-4 pb-2">
                <div
                  className={`rounded-xl p-3 flex gap-3 group cursor-pointer transition-all border ${
                    isPlayerOpen
                      ? 'bg-purple-800/20 border-purple-600/30'
                      : 'bg-purple-900/20 border-purple-800/10 hover:bg-purple-900/30'
                  }`}
                  onClick={() => handlePlayTrack(shake)}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={shake.track.coverUrl}
                      alt={shake.track.title}
                      className={`w-14 h-14 rounded-lg object-cover transition-all ${isPlayerOpen ? 'ring-2 ring-purple-500/50' : ''}`}
                    />
                    <div className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity ${
                      isPlayerOpen ? 'bg-black/40 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'
                    }`}>
                      {isPlayerOpen ? (
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <span className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                            <span className="w-0.5 h-4 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                            <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
                          </div>
                        </div>
                      ) : (
                        <Play className="w-6 h-6 text-white fill-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-bold text-sm truncate">{shake.track.title}</h3>
                    <p className="text-xs text-rose-200/70 truncate">{shake.track.artist}</p>
                  </div>
                  {!isPlayerOpen && (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Spotify Embed Player - slides open on click, with autoplay */}
              <AnimatePresence>
                {isPlayerOpen && shake.track.spotifyEmbedUrl && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-2">
                      <iframe
                        src={`${shake.track.spotifyEmbedUrl}?theme=0&utm_source=generator`}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="rounded-xl"
                        title={`${shake.track.title} - ${shake.track.artist}`}
                      />
                    </div>
                    {/* Open in app button */}
                    <div className="px-4 pb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openInMusicApp(shake); }}
                        className="w-full py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        Ouvrir dans {
                          currentUser?.musicService === 'apple_music' ? 'Apple Music' :
                          currentUser?.musicService === 'youtube_music' ? 'YouTube Music' :
                          currentUser?.musicService === 'deezer' ? 'Deezer' :
                          currentUser?.musicService === 'tidal' ? 'Tidal' :
                          'Spotify'
                        }
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="px-4 pb-2.5 flex items-center gap-6">
                <button onClick={() => toggleLike(shake.id)} className="flex items-center gap-1.5 group">
                  <Heart className={`w-5 h-5 transition-all ${shake.isLiked ? 'text-pink-500 fill-pink-500' : 'text-rose-300/70 group-hover:text-pink-500'}`} />
                  <span className={`text-xs font-medium ${shake.isLiked ? 'text-pink-500' : 'text-rose-300/70'}`}>{shake.likes}</span>
                </button>

                <button onClick={() => setCommentsPostId(shake.id)} className="flex items-center gap-1.5 group">
                  <MessageCircle className="w-5 h-5 text-rose-300/70 group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs font-medium text-rose-300/70">{shake.comments}</span>
                </button>

                <button onClick={() => setReshakeDialogShake(shake)} className="flex items-center gap-1.5 group">
                  <Repeat2 className={`w-5 h-5 transition-all ${shake.isReshaked ? 'text-green-500' : 'text-rose-300/70 group-hover:text-green-500'}`} />
                  <span className={`text-xs font-medium ${shake.isReshaked ? 'text-green-500' : 'text-rose-300/70'}`}>{shake.reshakes}</span>
                </button>

                <button onClick={() => setMusicReactionsPostId(shake.id)} className="flex items-center gap-1.5 group" title="Réagir avec un son">
                  <Music className="w-5 h-5 text-rose-300/70 group-hover:text-orange-400 transition-colors" />
                </button>

                <button
                  onClick={() => openInMusicApp(shake)}
                  className="flex items-center gap-1.5 group ml-auto px-3 py-1 rounded-full bg-purple-600/10 hover:bg-purple-600/20 transition-colors"
                >
                  <Headphones className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                  <span className="text-xs font-medium text-purple-400 group-hover:text-purple-300 hidden sm:inline">Écouter</span>
                </button>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* Circle input bar */}
      {currentFeedId && (
        <div className="fixed bottom-16 left-0 right-0 bg-rose-950/95 backdrop-blur-lg border-t border-rose-800/50 p-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <input
              type="text"
              placeholder="Écris quelque chose..."
              className="flex-1 px-4 py-2 bg-rose-900/50 border border-rose-700/50 rounded-full text-white placeholder-rose-300/70 focus:outline-none focus:border-purple-500"
            />
            <button className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-full transition-colors">
              <Music className="w-5 h-5 text-purple-400" />
            </button>
            <button className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-full transition-colors">
              <span className="text-purple-400 font-bold">GIF</span>
            </button>
            <button className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-full transition-colors">
              <span className="text-purple-400">📷</span>
            </button>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
              Envoyer
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {reshakeDialogShake && (
          <ReshakeDialog shake={reshakeDialogShake} onClose={() => setReshakeDialogShake(null)} onConfirm={confirmReshake} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profilePreview && (
          <ProfilePreviewDialog userId={profilePreview.userId} username={profilePreview.username} onClose={() => setProfilePreview(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sendSongTrack && (
          <SendSongDialog track={sendSongTrack} onClose={() => setSendSongTrack(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {musicReactionsPostId && (
          <MusicReactionsDialog
            postId={musicReactionsPostId}
            currentUser={currentUser}
            onClose={() => setMusicReactionsPostId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commentsPostId && (
          <CommentsDialog
            postId={commentsPostId}
            onClose={() => setCommentsPostId(null)}
            onCommentAdded={() => {
              setShakes(shakes.map(s =>
                s.id === commentsPostId ? { ...s, comments: s.comments + 1 } : s
              ));
            }}
          />
        )}
      </AnimatePresence>

      {/* Circle chat input bar — sticky at bottom when viewing a circle */}
      {circleId && (
        <div className="sticky bottom-16 lg:bottom-0 z-30 bg-[#0a0012]/95 backdrop-blur-lg border-t border-rose-800/25">
          {/* Track search overlay */}
          <AnimatePresence>
            {showChatTrackSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="max-h-60 overflow-y-auto border-b border-rose-800/25 bg-[#0a0012]"
              >
                <div className="p-3">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300/50" />
                    <input
                      type="text"
                      value={chatTrackQuery}
                      onChange={(e) => setChatTrackQuery(e.target.value)}
                      placeholder="Rechercher un son..."
                      className="w-full pl-9 pr-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                  </div>
                  {chatSearching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
                  {chatTrackResults.map((track: any) => (
                    <button
                      key={track.id}
                      onClick={() => handleChatSendTrack(track)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg transition-colors"
                    >
                      <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-rose-200/70 truncate">{track.artist}</p>
                      </div>
                      <Send className="w-4 h-4 text-purple-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-3 py-2 flex items-center gap-2">
            <button
              onClick={() => setShowChatTrackSearch(!showChatTrackSearch)}
              className={`p-2 rounded-full transition-colors ${showChatTrackSearch ? 'bg-purple-500 text-white' : 'hover:bg-rose-900/25 text-rose-300/60'}`}
            >
              <Music className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-rose-900/25 text-rose-300/60 transition-colors" title="GIF (bientot)">
              <Smile className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-rose-900/25 text-rose-300/60 transition-colors" title="Photo (bientot)">
              <Camera className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Message au cercle..."
              className="flex-1 px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-full text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSendText(); } }}
            />
            <button
              onClick={handleChatSendText}
              disabled={chatSending || !chatText.trim()}
              className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {chatSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
