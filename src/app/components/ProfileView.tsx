import { Users, Music, Heart, Settings, ExternalLink, Play, Trash2, Repeat2, MessageCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
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
  const [stats, setStats] = useState({
    shakes: 0,
    followers: 0,
    following: 0
  });

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load posts and reshakes
      const [posts, reshakes, followersCount, followingCount] = await Promise.all([
        getUserPosts(user.id),
        getUserReshakes(user.id),
        getUserFollowersCount(user.id),
        getUserFollowingCount(user.id)
      ]);
      
      // Transform posts
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
            duration: '0:30'
          },
          caption: post.text,
          likes: post.likes_count || 0,
          reshakes: post.reshakes_count || 0,
          comments: post.comments_count || 0,
          isLiked,
          timestamp: new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        };
      }));
      
      // Transform reshakes
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
            duration: '0:30'
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

  if (!user) return null;

  const handleSaveSettings = (settings: { musicService: 'spotify' | 'apple' }) => {
    const updatedUser = { ...user, ...settings };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    // Also update localStorage
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

  const openInMusicApp = (track: any) => {
    const spotifyUrl = track.spotifyUrl || track.spotify_url;
    if (spotifyUrl) {
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const deepLink = `spotify:track:${track.id}`;
        window.location.href = deepLink;
        setTimeout(() => {
          window.open(spotifyUrl, '_blank');
        }, 1000);
      } else {
        window.open(spotifyUrl, '_blank');
      }
    }
  };

  const currentShakes = activeTab === 'shakes' ? userShakes : userReshakes;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900" />
        
        <div className="px-4 pb-4">
          {/* Avatar & Actions */}
          <div className="flex items-end justify-between -mt-16 mb-4">
            <motion.img
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              src={user.avatar}
              alt={user.displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-black ring-4 ring-purple-500"
            />
            
            <div className="flex gap-2 pb-2">
              <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400 mb-2">@{user.username}</p>
            
            {user.bio && (
              <p className="text-sm text-gray-300 mb-3">
                {user.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <button className="hover:underline">
                <span className="font-bold text-white">{stats.shakes}</span>
                <span className="text-gray-400 ml-1">shakes</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold text-white">{stats.followers}</span>
                <span className="text-gray-400 ml-1">abonnés</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold text-white">{stats.following}</span>
                <span className="text-gray-400 ml-1">abonnements</span>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => setShowEditProfile(true)}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity text-sm"
          >
            Modifier le profil
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-y border-zinc-800 px-4 sticky top-0 bg-black z-30">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('shakes')}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'shakes'
                ? 'border-purple-500 text-purple-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Mes shakes
          </button>
          <button 
            onClick={() => setActiveTab('reshakes')}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'reshakes'
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Re-shakes
          </button>
        </div>
      </div>

      {/* Shakes Grid */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Chargement...</p>
          </div>
        ) : currentShakes.length > 0 ? (
          currentShakes.map((shake, index) => (
            <motion.div
              key={shake.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              {/* Reshake indicator */}
              {activeTab === 'reshakes' && shake.originalUser && (
                <div className="flex items-center gap-2 text-xs text-green-400 mb-2">
                  <Repeat2 className="w-3 h-3" />
                  <span>Reshake de @{shake.originalUser.username}</span>
                </div>
              )}

              {/* Track */}
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
                  <p className="text-xs text-gray-400 truncate mb-1">{shake.track.artist}</p>
                  {shake.caption && (
                    <p className="text-xs text-gray-300 line-clamp-2">{shake.caption}</p>
                  )}
                </div>

                <span className="text-xs text-gray-500">{shake.track.duration}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
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

                <button className="flex items-center gap-1.5 group">
                  <Repeat2 className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                  <span className="text-xs font-medium text-gray-400">{shake.reshakes}</span>
                </button>

                <button 
                  onClick={() => openInMusicApp(shake.track)}
                  className="flex items-center gap-1.5 group ml-auto"
                  title="Ouvrir dans l'app"
                >
                  <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
                </button>

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
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
              {activeTab === 'shakes' ? (
                <Music className="w-8 h-8 text-gray-600" />
              ) : (
                <Repeat2 className="w-8 h-8 text-gray-600" />
              )}
            </div>
            <p className="text-gray-400">
              {activeTab === 'shakes' ? 'Aucun shake pour le moment' : 'Aucun reshake pour le moment'}
            </p>
          </div>
        )}
      </div>

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