import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2, ExternalLink, Play, MoreHorizontal, Loader2, UserPlus, UserCheck, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../../lib/database';
import { ReshakeDialog } from './ReshakeDialog';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';
import { SendSongDialog } from './SendSongDialog';

interface Shake {
  id: string;
  user: {
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
    appleMusicUrl: string;
  };
  caption?: string;
  likes: number;
  comments: number;
  reshakes: number;
  timestamp: string;
  isLiked?: boolean;
  isReshaked?: boolean;
  reshakeFrom?: {
    username: string;
    displayName: string;
  };
}

interface FeedViewProps {
  currentUser: any;
  onPlayTrack: (track: any) => void;
  refreshFeed?: number;
}

export function FeedView({ currentUser, onPlayTrack, refreshFeed }: FeedViewProps) {
  const [shakes, setShakes] = useState<Shake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reshakeDialogShake, setReshakeDialogShake] = useState<Shake | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);

  useEffect(() => {
    loadFeed();
  }, [refreshFeed]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      const posts = await db.getFeed();

      // Transform posts to shakes format
      const shakes = await Promise.all(posts.map(async (post: any) => {
        const isLiked = await db.hasLikedPost(post.id);
        return {
          id: post.id,
          user: {
            username: post.user?.username || '',
            displayName: post.user?.username || '',
            avatar: post.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${post.user?.username}&background=random`
          },
          track: {
            id: post.track_id || post.id,
            title: post.track_name,
            artist: post.artist,
            coverUrl: post.cover_url,
            duration: '3:00', // Placeholder
            previewUrl: post.preview_url || '',
            spotifyUri: post.spotify_url || '',
            appleMusicUrl: ''
          },
          caption: post.text,
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          reshakes: post.reshakes_count || 0,
          timestamp: post.created_at,
          isLiked,
          isReshaked: false, // TODO: implement check
          reshakeFrom: post.is_reshake && post.original_post?.user ? {
            username: post.original_post.user.username,
            displayName: post.original_post.user.username
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
          s.id === shakeId
            ? { ...s, isLiked: false, likes: Math.max(0, s.likes - 1) }
            : s
        ));
      } else {
        await db.likePost(shakeId);
        setShakes(shakes.map(s =>
          s.id === shakeId
            ? { ...s, isLiked: true, likes: s.likes + 1 }
            : s
        ));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleReshakeClick = (shake: Shake) => {
    setReshakeDialogShake(shake);
  };

  const confirmReshake = async (comment?: string) => {
    if (!reshakeDialogShake) return;
    
    try {
      const result = await db.reshakePost(reshakeDialogShake.id, comment);

      if (result.success) {
        // Mark as reshaked and increment count
        setShakes(shakes.map(shake =>
          shake.id === reshakeDialogShake.id
            ? { ...shake, isReshaked: true, reshakes: shake.reshakes + 1 }
            : shake
        ));

        // Reload feed to show the new reshake
        await loadFeed();
      }
    } catch (err) {
      console.error('Error reshaking:', err);
    }
  };

  const openInMusicApp = (track: any) => {
    if (track.spotifyUri || track.spotifyUrl) {
      // Try to open in Spotify app first (deep link)
      const spotifyUrl = track.spotifyUri?.startsWith('http') 
        ? track.spotifyUri 
        : track.spotifyUrl || `https://open.spotify.com/track/${track.id}`;
      
      // For mobile, use spotify:// protocol
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const deepLink = `spotify:track:${track.id}`;
        window.location.href = deepLink;
        // Fallback to web if app not installed
        setTimeout(() => {
          window.open(spotifyUrl, '_blank');
        }, 1000);
      } else {
        window.open(spotifyUrl, '_blank');
      }
    } else if (track.appleMusicUrl) {
      window.open(track.appleMusicUrl, '_blank');
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
        <p className="text-gray-400">Chargement du feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">❌ {error}</p>
          <button
            onClick={loadFeed}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (shakes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <Play className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">Aucun shake pour le moment</h3>
          <p className="text-gray-400 mb-6">Sois le premier à partager un son !</p>
          <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity">
            Créer mon premier Shake 🎵
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4 space-y-3">
        {shakes.map((shake, index) => (
          <motion.article
            key={shake.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden"
          >
            {/* Reshake indicator */}
            {shake.reshakeFrom && (
              <div className="px-4 pt-2 flex items-center gap-2 text-xs text-purple-400">
                <Repeat2 className="w-3 h-3" />
                <button 
                  onClick={() => setProfilePreview({ 
                    userId: shake.reshakeFrom!.username, 
                    username: shake.reshakeFrom!.username 
                  })}
                  className="hover:underline font-medium"
                >
                  @{shake.reshakeFrom.username}
                </button>
                <span className="text-gray-500">a reshake</span>
              </div>
            )}

            {/* User Header */}
            <div className="px-4 py-2 flex items-center gap-2">
              <button 
                onClick={() => setProfilePreview({ 
                  userId: shake.user.username, 
                  username: shake.user.username 
                })}
              >
                <img
                  src={shake.user.avatar}
                  alt={shake.user.displayName}
                  className="w-9 h-9 rounded-full object-cover hover:ring-2 hover:ring-purple-500 transition-all"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setProfilePreview({ 
                      userId: shake.user.username, 
                      username: shake.user.username 
                    })}
                    className="font-semibold text-sm truncate hover:underline"
                  >
                    {shake.user.displayName}
                  </button>
                  <span className="text-gray-400 text-xs">@{shake.user.username}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-400 text-xs">{formatTimestamp(shake.timestamp || shake.createdAt)}</span>
                </div>
              </div>
              
              {/* More Menu */}
              <div className="relative">
                <button 
                  onClick={() => setMenuOpenId(menuOpenId === shake.id ? null : shake.id)}
                  className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
                
                {/* Dropdown Menu */}
                <AnimatePresence>
                  {menuOpenId === shake.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden"
                    >
                      <button
                        onClick={() => {
                          setSendSongTrack(shake.track);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Envoyer à un ami
                      </button>
                      {shake.reshakeFrom && (
                        <button
                          onClick={() => {
                            setProfilePreview({ 
                              userId: shake.user.username, 
                              username: shake.user.username 
                            });
                            setMenuOpenId(null);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Voir le profil
                        </button>
                      )}
                      <button
                        onClick={() => {
                          openInMusicApp(shake.track);
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
                    src={shake.track.coverUrl}
                    alt={shake.track.title}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                  <button
                    onClick={() => onPlayTrack(shake.track)}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                  >
                    <Play className="w-6 h-6 text-white fill-white" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{shake.track.title}</h3>
                  <p className="text-xs text-gray-400 truncate">{shake.track.artist}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{shake.track.duration}</span>
                  </div>
                </div>
              </div>

              {/* Caption */}
              {shake.caption && (
                <p className="mt-2 text-sm leading-relaxed">{shake.caption}</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-2 flex items-center gap-6">
              <button
                onClick={() => toggleLike(shake.id)}
                className="flex items-center gap-1.5 group"
              >
                <Heart
                  className={`w-5 h-5 transition-all ${
                    shake.isLiked
                      ? 'text-pink-500 fill-pink-500'
                      : 'text-gray-400 group-hover:text-pink-500'
                  }`}
                />
                <span className={`text-xs font-medium ${shake.isLiked ? 'text-pink-500' : 'text-gray-400'}`}>
                  {shake.likes}
                </span>
              </button>

              <button className="flex items-center gap-1.5 group">
                <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-xs font-medium text-gray-400">{shake.comments}</span>
              </button>

              <button
                onClick={() => handleReshakeClick(shake)}
                className="flex items-center gap-1.5 group"
              >
                <Repeat2
                  className={`w-5 h-5 transition-all ${
                    shake.isReshaked
                      ? 'text-green-500'
                      : 'text-gray-400 group-hover:text-green-500'
                  }`}
                />
                <span className={`text-xs font-medium ${shake.isReshaked ? 'text-green-500' : 'text-gray-400'}`}>
                  {shake.reshakes}
                </span>
              </button>

              <button 
                onClick={() => openInMusicApp(shake.track)}
                className="flex items-center gap-1.5 group ml-auto"
                title="Ouvrir dans l'application"
              >
                <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </button>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Reshake Dialog */}
      <AnimatePresence>
        {reshakeDialogShake && (
          <ReshakeDialog
            shake={reshakeDialogShake}
            onClose={() => setReshakeDialogShake(null)}
            onConfirm={confirmReshake}
          />
        )}
      </AnimatePresence>

      {/* Profile Preview Dialog */}
      <AnimatePresence>
        {profilePreview && (
          <ProfilePreviewDialog
            userId={profilePreview.userId}
            username={profilePreview.username}
            onClose={() => setProfilePreview(null)}
          />
        )}
      </AnimatePresence>

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