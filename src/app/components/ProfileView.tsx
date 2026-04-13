import { Users, Music, Heart, Settings, ExternalLink, Play, Trash2, Repeat2, MessageCircle, Loader2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { CommentsDialog } from './CommentsDialog';
import { getUserPosts, getUserReshakes, deletePost, getUserFollowersCount, getUserFollowingCount, likePost, unlikePost, hasLikedPost } from '../../lib/database';

interface ProfileViewProps {
  user: any;
  onPlayTrack: (track: any) => void;
  onUpdateUser?: (updatedUser: any) => void;
}

type TabType = 'shakes' | 'reshakes';

export function ProfileView({ user, onPlayTrack, onUpdateUser }: ProfileViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('shakes');
  const [userShakes, setUserShakes] = useState<any[]>([]);
  const [userReshakes, setUserReshakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    shakes: 0,
    followers: 0,
    following: 0
  });

  useEffect(() => {
    loadUserData();
  }, [user, activeTab]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [posts, reshakes, followersCount, followingCount] = await Promise.all([
        getUserPosts(user.id),
        getUserReshakes(user.id),
        getUserFollowersCount(user.id),
        getUserFollowingCount(user.id)
      ]);

      const shakesData = await Promise.all(posts.map(async (post: any) => {
        const isLiked = await hasLikedPost(post.id);
        return {
          id: post.id,
          track: {
            id: post.track_id || post.id,
            title: post.track_name,
            artist: post.artist,
            coverUrl: post.cover_url,
            previewUrl: post.preview_url,
            spotifyUrl: post.spotify_url,
            spotifyEmbedUrl: post.spotify_embed_url || (post.track_id ? `https://open.spotify.com/embed/track/${post.track_id}?theme=0` : null),
          },
          caption: post.text,
          likes: post.likes_count || 0,
          reshakes: post.reshakes_count || 0,
          comments: post.comments_count || 0,
          isLiked,
          timestamp: new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        };
      }));

      const reshakesData = await Promise.all(reshakes.map(async (post: any) => {
        const isLiked = await hasLikedPost(post.id);
        return {
          id: post.id,
          track: {
            id: post.track_id || post.id,
            title: post.track_name,
            artist: post.artist,
            coverUrl: post.cover_url,
            previewUrl: post.preview_url,
            spotifyUrl: post.spotify_url,
            spotifyEmbedUrl: post.spotify_embed_url || (post.track_id ? `https://open.spotify.com/embed/track/${post.track_id}?theme=0` : null),
          },
          caption: post.text,
          likes: post.likes_count || 0,
          reshakes: post.reshakes_count || 0,
          comments: post.comments_count || 0,
          isLiked,
          originalUser: post.original_post?.user ? {
            username: post.original_post.user.username,
            avatar: post.original_post.user.profile_album_cover_url
          } : null,
          timestamp: new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        };
      }));

      setUserShakes(shakesData);
      setUserReshakes(reshakesData);

      setStats({
        shakes: posts.length,
        followers: followersCount,
        following: followingCount
      });
    } catch (error) {
      console.error('Failed to load user data:', error);
      setUserShakes([]);
      setUserReshakes([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  const handleSaveSettings = (settings: { musicService: 'spotify' | 'apple' }) => {
    const updatedUser = { ...user, ...settings };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    const onboarding = localStorage.getItem('shakemoi_onboarding');
    if (onboarding) {
      const data = JSON.parse(onboarding);
      localStorage.setItem('shakemoi_onboarding', JSON.stringify({ ...data, ...settings }));
    }
  };

  const handleDeleteShake = async (shakeId: string) => {
    try {
      await deletePost(shakeId);
      setUserShakes(userShakes.filter(shake => shake.id !== shakeId));
      setUserReshakes(userReshakes.filter(shake => shake.id !== shakeId));
      setStats({ ...stats, shakes: stats.shakes - 1 });
    } catch (error) {
      console.error('Failed to delete shake:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const toggleLike = async (shakeId: string) => {
    const currentList = activeTab === 'shakes' ? userShakes : userReshakes;
    const setCurrentList = activeTab === 'shakes' ? setUserShakes : setUserReshakes;

    const shake = currentList.find(s => s.id === shakeId);
    if (!shake) return;

    try {
      if (shake.isLiked) {
        await unlikePost(shakeId);
        setCurrentList(currentList.map(s =>
          s.id === shakeId
            ? { ...s, isLiked: false, likes: Math.max(0, s.likes - 1) }
            : s
        ));
      } else {
        await likePost(shakeId);
        setCurrentList(currentList.map(s =>
          s.id === shakeId
            ? { ...s, isLiked: true, likes: s.likes + 1 }
            : s
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const currentShakes = activeTab === 'shakes' ? userShakes : userReshakes;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header - No cover photo, compact layout */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={user.avatar || user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username || user.displayName}&background=random`}
            alt={user.displayName || user.username}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-500 shadow-lg shadow-purple-500/20 flex-shrink-0"
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.username || user.displayName}&background=random`;
            }}
          />

          {/* Stats + Actions on the right */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white truncate">{user.displayName}</h1>
            </div>
            <p className="text-sm text-purple-400/70 mb-3">@{user.username}</p>

            {/* Stats Row */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">{stats.shakes}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Shakes</p>
              </div>
              <div className="w-px h-8 bg-purple-800/30" />
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">{stats.followers}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Abonnés</p>
              </div>
              <div className="w-px h-8 bg-purple-800/30" />
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">{stats.following}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Suivis</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-purple-200/70 mt-3 leading-relaxed">{user.bio}</p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowEditProfile(true)}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modifier le profil
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-purple-950/50 border border-purple-800/30 hover:bg-purple-900/40 rounded-xl transition-colors"
          >
            <Settings className="w-4 h-4 text-purple-300" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-y border-purple-800/20 px-4 sticky top-0 bg-[#0a0012] z-30">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('shakes')}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'shakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-purple-500/40 hover:text-purple-300'
            }`}
          >
            Mes shakes
          </button>
          <button
            onClick={() => setActiveTab('reshakes')}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'reshakes'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-purple-500/40 hover:text-purple-300'
            }`}
          >
            Re-shakes
          </button>
        </div>
      </div>

      {/* Shakes List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
            <p className="text-purple-400/50">Chargement...</p>
          </div>
        ) : currentShakes.length > 0 ? (
          currentShakes.map((shake, index) => (
            <motion.div
              key={shake.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-purple-950/25 rounded-xl border border-purple-800/20 hover:border-purple-700/30 transition-all overflow-hidden"
            >
              {/* Reshake indicator */}
              {activeTab === 'reshakes' && shake.originalUser && (
                <div className="flex items-center gap-2 text-xs text-green-400/80 px-4 pt-2">
                  <Repeat2 className="w-3 h-3" />
                  <span>Reshake de @{shake.originalUser.username}</span>
                </div>
              )}

              <div className="p-4">
                {/* Caption */}
                {shake.caption && (
                  <p className="text-sm text-purple-200/80 mb-3">{shake.caption}</p>
                )}

                {/* Spotify Embed or Track Card */}
                {shake.track.spotifyEmbedUrl ? (
                  <div className="rounded-lg overflow-hidden mb-3">
                    <iframe
                      src={shake.track.spotifyEmbedUrl}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex gap-3 mb-3">
                    <div className="relative group flex-shrink-0">
                      <img
                        src={shake.track.coverUrl}
                        alt={shake.track.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => onPlayTrack(shake.track)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                      >
                        <Play className="w-6 h-6 text-white fill-white" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{shake.track.title}</h4>
                      <p className="text-xs text-purple-300/60 truncate">{shake.track.artist}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-2 border-t border-purple-800/20">
                  <button
                    onClick={() => toggleLike(shake.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <Heart
                      className={`w-5 h-5 transition-all ${
                        shake.isLiked
                          ? 'text-pink-500 fill-pink-500'
                          : 'text-purple-400/50 group-hover:text-pink-500'
                      }`}
                    />
                    <span className={`text-xs font-medium ${shake.isLiked ? 'text-pink-500' : 'text-purple-400/50'}`}>
                      {shake.likes}
                    </span>
                  </button>

                  <button
                    onClick={() => setCommentsPostId(shake.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <MessageCircle className="w-5 h-5 text-purple-400/50 group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs font-medium text-purple-400/50">{shake.comments}</span>
                  </button>

                  <button className="flex items-center gap-1.5 group">
                    <Repeat2 className="w-5 h-5 text-purple-400/50 group-hover:text-green-400 transition-colors" />
                    <span className="text-xs font-medium text-purple-400/50">{shake.reshakes}</span>
                  </button>

                  <span className="text-xs text-purple-500/40 ml-auto">{shake.timestamp}</span>

                  <button
                    onClick={() => {
                      if (confirm('Supprimer ce shake ?')) {
                        handleDeleteShake(shake.id);
                      }
                    }}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-950/40 rounded-full flex items-center justify-center border border-purple-800/20">
              {activeTab === 'shakes' ? (
                <Music className="w-8 h-8 text-purple-600" />
              ) : (
                <Repeat2 className="w-8 h-8 text-purple-600" />
              )}
            </div>
            <p className="text-purple-300/50">
              {activeTab === 'shakes' ? 'Aucun shake pour le moment' : 'Aucun reshake pour le moment'}
            </p>
          </div>
        )}
      </div>

      {/* Comments Dialog */}
      <AnimatePresence>
        {commentsPostId && (
          <CommentsDialog
            postId={commentsPostId}
            onClose={() => setCommentsPostId(null)}
            onCommentAdded={() => loadUserData()}
          />
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          currentUser={user}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Edit Profile Dialog */}
      {showEditProfile && (
        <EditProfileDialog
          currentUser={user}
          onClose={() => setShowEditProfile(false)}
          onUpdateUser={onUpdateUser}
        />
      )}
    </div>
  );
}
