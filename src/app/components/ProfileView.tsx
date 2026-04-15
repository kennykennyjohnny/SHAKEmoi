import { Users, Music, Heart, Settings, Play, Trash2, Repeat2, MessageCircle, Loader2, Edit3, X, ExternalLink, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { CommentsDialog } from './CommentsDialog';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';
import { getUserPosts, getUserReshakes, deletePost, getUserFollowersCount, getUserFollowingCount, getUserFollowers, getUserFollowing, unfollowUser, likePost, unlikePost, hasLikedPost } from '../../lib/database';
import { getPlatformUrl } from '../../lib/odesli';

interface ProfileViewProps {
  user: any;
  onUpdateUser?: (updatedUser: any) => void;
}

type TabType = 'shakes' | 'reshakes';

export function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('shakes');
  const [userShakes, setUserShakes] = useState<any[]>([]);
  const [userReshakes, setUserReshakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [expandedShakeId, setExpandedShakeId] = useState<string | null>(null);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
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
          links: {
            spotify_url: post.spotify_url || null,
            apple_music_url: post.apple_music_url || null,
            deezer_url: post.deezer_url || null,
            youtube_url: post.youtube_url || null,
            youtube_music_url: post.youtube_music_url || null,
            tidal_url: post.tidal_url || null,
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
        // Use original post data for display
        const orig = post.original_post || post;
        return {
          id: post.id,
          track: {
            id: orig.track_id || post.track_id || post.id,
            title: orig.track_name || post.track_name,
            artist: orig.artist || post.artist,
            coverUrl: orig.cover_url || post.cover_url,
            previewUrl: orig.preview_url || post.preview_url,
            spotifyUrl: orig.spotify_url || post.spotify_url,
            spotifyEmbedUrl: orig.spotify_embed_url || post.spotify_embed_url || ((orig.track_id || post.track_id) ? `https://open.spotify.com/embed/track/${orig.track_id || post.track_id}?theme=0` : null),
          },
          links: {
            spotify_url: post.spotify_url || null,
            apple_music_url: post.apple_music_url || null,
            deezer_url: post.deezer_url || null,
            youtube_url: post.youtube_url || null,
            youtube_music_url: post.youtube_music_url || null,
            tidal_url: post.tidal_url || null,
          },
          caption: post.text,
          likes: post.likes_count || 0,
          reshakes: post.reshakes_count || 0,
          comments: post.comments_count || 0,
          isLiked,
          originalUser: post.original_post?.user ? {
            id: post.original_post.user.id,
            username: post.original_post.user.username,
            displayName: post.original_post.user.display_name || post.original_post.user.username,
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
      if (expandedShakeId === shakeId) setExpandedShakeId(null);
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
          s.id === shakeId ? { ...s, isLiked: false, likes: Math.max(0, s.likes - 1) } : s
        ));
      } else {
        await likePost(shakeId);
        setCurrentList(currentList.map(s =>
          s.id === shakeId ? { ...s, isLiked: true, likes: s.likes + 1 } : s
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const openInMusicApp = (shake: any) => {
    const platform = user?.musicService || user?.preferred_platform || 'spotify';
    const links = {
      ...shake.links,
      spotify_url: shake.links?.spotify_url || shake.track.spotifyUrl || null,
    };
    const url = getPlatformUrl(links, platform);
    if (url) {
      window.open(url, '_blank');
    } else {
      const q = encodeURIComponent(`${shake.track.title} ${shake.track.artist}`);
      window.open(`https://open.spotify.com/search/${q}`, '_blank');
    }
  };

  const loadFollowersList = async (type: 'followers' | 'following') => {
    setShowFollowersList(type);
    setLoadingList(true);
    try {
      if (type === 'followers') {
        const data = await getUserFollowers(user.id);
        setFollowersList(data);
      } else {
        const data = await getUserFollowing(user.id);
        setFollowingList(data);
      }
    } catch (err) {
      console.error('Error loading list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    try {
      await unfollowUser(targetUserId);
      setFollowingList(followingList.filter(u => u.id !== targetUserId));
      setStats({ ...stats, following: Math.max(0, stats.following - 1) });
    } catch (err) {
      console.error('Error unfollowing:', err);
    }
  };

  const currentShakes = activeTab === 'shakes' ? userShakes : userReshakes;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
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

          {/* Info + Stats */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{user.displayName}</h1>
            <p className="text-sm text-purple-400/70 mb-3">@{user.username}</p>

            {/* Stats Row - clickable for own profile */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">{stats.shakes}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Shakes</p>
              </div>
              <div className="w-px h-8 bg-purple-800/30" />
              <button onClick={() => loadFollowersList('followers')} className="text-center hover:opacity-80 transition-opacity">
                <p className="font-bold text-white text-lg leading-tight">{stats.followers}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Abonnés</p>
              </button>
              <div className="w-px h-8 bg-purple-800/30" />
              <button onClick={() => loadFollowersList('following')} className="text-center hover:opacity-80 transition-opacity">
                <p className="font-bold text-white text-lg leading-tight">{stats.following}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Suivis</p>
              </button>
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
            onClick={() => { setActiveTab('shakes'); setExpandedShakeId(null); }}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'shakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-purple-500/40 hover:text-purple-300'
            }`}
          >
            Mes shakes
          </button>
          <button
            onClick={() => { setActiveTab('reshakes'); setExpandedShakeId(null); }}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'reshakes'
                ? 'border-fuchsia-500 text-fuchsia-400'
                : 'border-transparent text-purple-500/40 hover:text-purple-300'
            }`}
          >
            Re-shakes
          </button>
        </div>
      </div>

      {/* Cover Art Grid */}
      <div className="p-3">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
            <p className="text-purple-400/50">Chargement...</p>
          </div>
        ) : currentShakes.length > 0 ? (
          <>
            {/* Grid of covers */}
            <div className="grid grid-cols-3 gap-1.5">
              {currentShakes.map((shake, index) => (
                <motion.button
                  key={shake.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setExpandedShakeId(expandedShakeId === shake.id ? null : shake.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden group transition-all ${
                    expandedShakeId === shake.id ? 'ring-2 ring-purple-500 scale-[0.97]' : 'hover:opacity-90'
                  }`}
                >
                  <img
                    src={shake.track.coverUrl}
                    alt={shake.track.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                  {/* Reshake badge */}
                  {activeTab === 'reshakes' && shake.originalUser && (
                    <div className="absolute top-1 left-1 bg-fuchsia-500/80 rounded-full p-0.5">
                      <Repeat2 className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  {/* Like count */}
                  <div className="absolute bottom-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-pink-400" />
                    <span className="text-[9px] text-white font-medium">{shake.likes}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Expanded Detail View */}
            <AnimatePresence>
              {expandedShakeId && (() => {
                const shake = currentShakes.find(s => s.id === expandedShakeId);
                if (!shake) return null;

                return (
                  <motion.div
                    key={expandedShakeId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="bg-purple-950/40 rounded-xl border border-purple-800/30 overflow-hidden">
                      {/* Original user info for reshakes */}
                      {activeTab === 'reshakes' && shake.originalUser && (
                        <div className="flex items-center gap-2 px-4 pt-3">
                          <img
                            src={shake.originalUser.avatar || `https://ui-avatars.com/api/?name=${shake.originalUser.username}&background=random`}
                            alt={shake.originalUser.username}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-xs text-white font-medium">@{shake.originalUser.username}</span>
                          <Repeat2 className="w-3 h-3 text-fuchsia-400" />
                          <span className="text-xs text-fuchsia-400/60">Reshaké par toi</span>
                        </div>
                      )}

                      <div className="p-4">
                        {/* Caption */}
                        {shake.caption && (
                          <p className="text-sm text-purple-200/80 mb-3">{shake.caption}</p>
                        )}

                        {/* Spotify Embed */}
                        {shake.track.spotifyEmbedUrl ? (
                          <div className="rounded-lg overflow-hidden mb-3">
                            <iframe
                              src={`${shake.track.spotifyEmbedUrl}&utm_source=generator`}
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
                            <img src={shake.track.coverUrl} alt={shake.track.title} className="w-14 h-14 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="font-bold text-sm text-white truncate">{shake.track.title}</h4>
                              <p className="text-xs text-purple-300/60 truncate">{shake.track.artist}</p>
                            </div>
                          </div>
                        )}

                        {/* Open in app */}
                        <button
                          onClick={() => openInMusicApp(shake)}
                          className="w-full py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity mb-3"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ouvrir dans l'app
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-4 pt-2 border-t border-purple-800/20">
                          <button onClick={() => toggleLike(shake.id)} className="flex items-center gap-1.5 group">
                            <Heart className={`w-5 h-5 transition-all ${shake.isLiked ? 'text-pink-500 fill-pink-500' : 'text-purple-400/50 group-hover:text-pink-500'}`} />
                            <span className={`text-xs font-medium ${shake.isLiked ? 'text-pink-500' : 'text-purple-400/50'}`}>{shake.likes}</span>
                          </button>

                          <button onClick={() => setCommentsPostId(shake.id)} className="flex items-center gap-1.5 group">
                            <MessageCircle className="w-5 h-5 text-purple-400/50 group-hover:text-fuchsia-400 transition-colors" />
                            <span className="text-xs font-medium text-purple-400/50">{shake.comments}</span>
                          </button>

                          <button className="flex items-center gap-1.5 group">
                            <Repeat2 className="w-5 h-5 text-purple-400/50 group-hover:text-fuchsia-400 transition-colors" />
                            <span className="text-xs font-medium text-purple-400/50">{shake.reshakes}</span>
                          </button>

                          <span className="text-xs text-purple-500/40 ml-auto">{shake.timestamp}</span>

                          <button
                            onClick={() => {
                              if (confirm('Supprimer ce shake ?')) handleDeleteShake(shake.id);
                            }}
                            className="p-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-pink-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </>
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

      {/* Followers / Following List Dialog */}
      <AnimatePresence>
        {showFollowersList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFollowersList(null)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0f0020] rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col border border-purple-800/30"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
                <h3 className="font-bold text-white">
                  {showFollowersList === 'followers' ? `Abonnés (${stats.followers})` : `Abonnements (${stats.following})`}
                </h3>
                <button onClick={() => setShowFollowersList(null)} className="p-1.5 hover:bg-purple-900/40 rounded-full">
                  <X className="w-5 h-5 text-purple-300/60" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingList ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  </div>
                ) : (showFollowersList === 'followers' ? followersList : followingList).length === 0 ? (
                  <p className="text-center text-purple-400/50 py-8">
                    {showFollowersList === 'followers' ? 'Aucun abonné' : 'Aucun abonnement'}
                  </p>
                ) : (
                  (showFollowersList === 'followers' ? followersList : followingList).map((person: any) => (
                    <div key={person.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-purple-900/30 transition-colors">
                      <button
                        onClick={() => { setShowFollowersList(null); setProfilePreview({ userId: person.id, username: person.username }); }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <img
                          src={person.profile_album_cover_url || `https://ui-avatars.com/api/?name=${person.username}&background=random`}
                          alt={person.username}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-purple-700/30 hover:ring-2 hover:ring-purple-500 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-white truncate">{person.display_name || person.username}</p>
                          <p className="text-xs text-purple-400/50 truncate">@{person.username}</p>
                        </div>
                      </button>
                      {/* Only show unfollow for "following" list */}
                      {showFollowersList === 'following' && (
                        <button
                          onClick={() => {
                            if (confirm(`Ne plus suivre @${person.username} ?`)) handleUnfollow(person.id);
                          }}
                          className="p-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
                          title="Ne plus suivre"
                        >
                          <UserMinus className="w-4 h-4 text-pink-400" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
