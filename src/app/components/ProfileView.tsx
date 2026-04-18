import { Users, Music, Heart, Settings, Play, Pause, Trash2, Repeat2, MessageCircle, Loader2, Edit3, X, ExternalLink, UserMinus, Share2, Copy, Check, Instagram, Send, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { CommentsDialog } from './CommentsDialog';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';
import { getUserPosts, getUserReshakes, deletePost, getUserFollowersCount, getUserFollowingCount, getUserFollowers, getUserFollowing, unfollowUser, removeFollower, likePost, unlikePost, hasLikedPosts } from '../../lib/database';
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
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [showDetailEmbed, setShowDetailEmbed] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [showShareProfile, setShowShareProfile] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
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

      const allPostIds = [...posts.map((p: any) => p.id), ...reshakes.map((p: any) => p.id)];
      const likedMap = await hasLikedPosts(allPostIds);

      const shakesData = posts.map((post: any) => {
        const isLiked = likedMap[post.id] || false;
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
      });

      const reshakesData = reshakes.map((post: any) => {
        const isLiked = likedMap[post.id] || false;
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
      });

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
      if (detailPostId === shakeId) setDetailPostId(null);
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

  const handleRemoveFollower = async (followerId: string) => {
    try {
      await removeFollower(followerId);
      setFollowersList(followersList.filter(u => u.id !== followerId));
      setStats({ ...stats, followers: Math.max(0, stats.followers - 1) });
    } catch (err) {
      console.error('Error removing follower:', err);
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
            onClick={() => setShowShareProfile(true)}
            className="px-4 py-2 bg-purple-950/50 border border-purple-800/30 hover:bg-purple-900/40 rounded-xl transition-colors"
            title="Partager mon profil"
          >
            <Share2 className="w-4 h-4 text-purple-300" />
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
      <div className="border-y border-purple-800/20 px-4 sticky top-0 bg-[#14092A] z-30">
        <div className="flex gap-6">
          <button
            onClick={() => { setActiveTab('shakes'); }}
            className={`py-3 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'shakes'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-purple-500/40 hover:text-purple-300'
            }`}
          >
            Mes shakes
          </button>
          <button
            onClick={() => { setActiveTab('reshakes'); }}
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
              {currentShakes.map((shake, index) => {
                return (
                  <div key={shake.id}>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        if (detailPostId === shake.id) { setDetailPostId(null); setShowDetailEmbed(false); }
                        else { setDetailPostId(shake.id); setShowDetailEmbed(false); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); }
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden group transition-all w-full hover:opacity-90 ${detailPostId === shake.id ? 'ring-2 ring-fuchsia-500 opacity-100' : ''}`}
                    >
                      <img
                        src={shake.track.coverUrl}
                        alt={shake.track.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                      {activeTab === 'reshakes' && shake.originalUser && (
                        <div className="absolute top-1 left-1 bg-fuchsia-500/80 rounded-full p-0.5">
                          <Repeat2 className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5 text-pink-400" />
                        <span className="text-[9px] text-white font-medium">{shake.likes}</span>
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>

            {/* Inline Post Detail (replaces modal) */}
            <AnimatePresence>
              {detailPostId && (() => {
                const shake = currentShakes.find(s => s.id === detailPostId);
                if (!shake) return null;
                const trackId = shake.track.id || (shake.track.spotifyUrl?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
                const embedUrl = shake.track.spotifyEmbedUrl || (trackId ? `https://open.spotify.com/embed/track/${trackId}?theme=0` : null);
                return (
                  <motion.div
                    ref={detailRef}
                    key={detailPostId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 bg-purple-950/40 rounded-2xl border border-purple-800/20 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-purple-800/20">
                        <button onClick={() => { setDetailPostId(null); setShowDetailEmbed(false); }} className="p-1 hover:bg-purple-900/40 rounded-full transition-colors">
                          <ArrowLeft className="w-5 h-5 text-purple-300/60" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white truncate">{shake.track.title}</p>
                          <p className="text-xs text-purple-300/60 truncate">{shake.track.artist}</p>
                        </div>
                        <button onClick={() => { setDetailPostId(null); setShowDetailEmbed(false); }} className="p-1 hover:bg-purple-900/40 rounded-full">
                          <X className="w-5 h-5 text-purple-300/60" />
                        </button>
                      </div>

                      {/* Cover */}
                      <div className="relative cursor-pointer" onClick={() => setShowDetailEmbed(!showDetailEmbed)}>
                        <img src={shake.track.coverUrl} alt="" className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                          {showDetailEmbed ? (
                            <Pause className="w-12 h-12 text-white fill-white drop-shadow-lg" />
                          ) : (
                            <Play className="w-12 h-12 text-white fill-white drop-shadow-lg" />
                          )}
                        </div>
                      </div>

                      {/* Caption */}
                      {shake.caption && (
                        <div className="px-4 pt-3">
                          <p className="text-sm text-purple-200/80">{shake.caption}</p>
                        </div>
                      )}

                      {/* Embed */}
                      <AnimatePresence>
                        {showDetailEmbed && embedUrl && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pt-2">
                            <iframe src={embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action bar */}
                      <div className="px-4 py-3 flex items-center gap-5">
                        <button onClick={() => toggleLike(shake.id)} className="flex items-center gap-1.5 group">
                          <Heart className={`w-6 h-6 transition-all ${shake.isLiked ? 'text-pink-500 fill-pink-500' : 'text-purple-300/70 group-hover:text-pink-500'}`} />
                          <span className={`text-sm font-medium ${shake.isLiked ? 'text-pink-500' : 'text-purple-300/70'}`}>{shake.likes}</span>
                        </button>

                        <button onClick={() => setCommentsPostId(shake.id)} className="flex items-center gap-1.5 group">
                          <MessageCircle className="w-6 h-6 text-purple-300/70 group-hover:text-fuchsia-400 transition-colors" />
                          <span className="text-sm font-medium text-purple-300/70">{shake.comments}</span>
                        </button>

                        <button onClick={() => openInMusicApp(shake)} className="flex items-center gap-1.5 group ml-auto px-3 py-1.5 rounded-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 transition-colors">
                          <ExternalLink className="w-4 h-4 text-fuchsia-400" />
                          <span className="text-xs font-medium text-fuchsia-400">Écouter</span>
                        </button>

                        <button
                          onClick={() => { if (confirm('Supprimer ce shake ?')) { handleDeleteShake(shake.id); } }}
                          className="p-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-pink-400" />
                        </button>
                      </div>

                      {/* Timestamp */}
                      <div className="px-4 pb-3">
                        <p className="text-[10px] text-purple-500/40">{shake.timestamp}</p>
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
              className="bg-[#1D0F3D] rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col border border-purple-800/30"
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
                      {/* Only show unfollow for "following" list, remove for "followers" */}
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
                      {showFollowersList === 'followers' && (
                        <button
                          onClick={() => {
                            if (confirm(`Retirer @${person.username} de tes abonnés ?`)) handleRemoveFollower(person.id);
                          }}
                          className="p-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
                          title="Retirer cet abonné"
                        >
                          <X className="w-4 h-4 text-pink-400" />
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
            currentUser={user}
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

      {/* Share Profile Dialog */}
      <AnimatePresence>
        {showShareProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1D0F3D] rounded-2xl w-full max-w-sm border border-purple-800/20 overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-purple-800/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-fuchsia-400" />
                  Partager mon profil
                </h2>
                <button onClick={() => setShowShareProfile(false)} className="p-1.5 hover:bg-purple-900/40 rounded-full">
                  <X className="w-5 h-5 text-purple-300/60" />
                </button>
              </div>

              {/* Profile card preview */}
              <div className="p-5">
                <div className="bg-gradient-to-br from-fuchsia-600/20 via-purple-900/30 to-pink-600/20 rounded-2xl p-5 text-center border border-fuchsia-500/20 mb-5">
                  <img
                    src={user.avatar || user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                    className="w-20 h-20 rounded-full object-cover mx-auto ring-3 ring-fuchsia-500/40 mb-3"
                    alt=""
                  />
                  <h3 className="text-lg font-bold text-white">{user.displayName}</h3>
                  <p className="text-sm text-fuchsia-400">@{user.username}</p>
                  <div className="flex justify-center gap-6 mt-3">
                    <div className="text-center">
                      <p className="font-bold text-white">{stats.shakes}</p>
                      <p className="text-[10px] text-purple-400/50">Shakes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-white">{stats.followers}</p>
                      <p className="text-[10px] text-purple-400/50">Abonnés</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-300/40 mt-3">shakemoi.fr</p>
                </div>

                {/* Share link */}
                <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-purple-400/50 mb-1">Mon lien de profil</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-mono flex-1 truncate">shakemoi.fr?ref={user.username}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(`https://shakemoi.fr?ref=${user.username}`);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${shareCopied ? 'bg-fuchsia-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                    >
                      {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Instagram Story */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Hey ! 👋 Rejoins-moi sur SHAKEmoi 🎵🔥 https://shakemoi.fr?ref=${user.username}`);
                      window.open('instagram://camera', '_blank');
                      setTimeout(() => { window.open('https://instagram.com', '_blank'); }, 500);
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Instagram
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const text = encodeURIComponent(`Hey ! 👋 Rejoins-moi sur SHAKEmoi, l'appli où on partage nos sons préférés avec nos amis 🎵🔥\n\nInscris-toi ici : https://shakemoi.fr?ref=${user.username}`);
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>

                  {/* Twitter/X */}
                  <button
                    onClick={() => {
                      const text = encodeURIComponent(`Découvrez ce que vos amis écoutent vraiment 🎵 Rejoignez-moi sur @SHAKEmoi !\nhttps://shakemoi.fr?ref=${user.username}`);
                      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X / Twitter
                  </button>

                  {/* Snapchat */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Rejoins-moi sur SHAKEmoi 🎵🔥 https://shakemoi.fr?ref=${user.username}`);
                      window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(`https://shakemoi.fr?ref=${user.username}`)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400 text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.959-.289.096-.057.186-.079.277-.079.194 0 .381.104.489.264.035.053.079.116.079.194 0 .06-.029.169-.18.285-.238.168-.479.27-.72.374-.096.039-.193.08-.287.123-.155.074-.307.167-.434.27-.058.052-.108.123-.139.204l-.003.013c-.159.463.105 1.075.267 1.322.158.237.345.465.552.668.283.291.632.508 1.019.709.195.099.395.171.595.214.102.024.178.07.222.134.052.073.083.164.083.272 0 .061-.01.124-.034.186-.12.31-.378.439-.59.534-.119.051-.241.1-.351.142-1.2.456-1.6 1.024-1.685 1.152-.053.07-.076.132-.076.217 0 .069.025.141.076.209.066.096.141.179.216.261.224.244.47.476.692.692.297.303.504.553.625.796.059.118.094.237.094.363 0 .068-.011.134-.034.198-.159.496-.755.685-1.304.8-.262.052-.531.079-.747.101-.105.01-.21.025-.299.038-.056.007-.112.032-.165.078-.069.058-.116.14-.134.243-.025.14-.107.236-.223.263-.162.03-.318.043-.468.043-.207 0-.417-.024-.643-.074-.236-.052-.466-.12-.689-.18-.33-.09-.648-.152-.96-.152-.083 0-.166.005-.25.016-.438.058-.855.308-1.234.541-.506.311-1.045.642-1.648.642-.063 0-.125-.005-.188-.014-.061.009-.122.014-.186.014-.602 0-1.14-.332-1.648-.642-.381-.234-.8-.485-1.237-.543-.084-.01-.168-.015-.251-.015-.314 0-.633.063-.962.153-.226.061-.459.13-.698.181-.228.051-.442.076-.653.076-.152 0-.313-.013-.481-.045-.117-.027-.199-.122-.224-.262-.017-.1-.064-.183-.133-.24-.053-.045-.108-.07-.164-.078-.091-.013-.197-.028-.301-.038-.215-.022-.489-.05-.752-.102-.543-.114-1.139-.303-1.301-.802-.023-.065-.034-.132-.034-.199 0-.127.035-.246.095-.364.12-.244.332-.495.63-.798.218-.215.46-.443.683-.684.076-.082.152-.167.22-.264.053-.07.078-.143.078-.213 0-.082-.023-.146-.077-.218-.085-.127-.484-.695-1.684-1.15-.11-.042-.234-.092-.354-.142-.213-.096-.474-.226-.595-.538-.023-.062-.034-.125-.034-.187 0-.11.031-.201.084-.275.045-.067.123-.112.224-.136.201-.043.401-.115.595-.214.388-.201.737-.418 1.02-.71.207-.202.394-.43.552-.667.16-.245.422-.858.267-1.316l-.004-.013c-.031-.082-.081-.153-.14-.205-.127-.103-.279-.197-.432-.271-.094-.042-.19-.084-.287-.123-.243-.103-.482-.206-.72-.374-.152-.117-.18-.228-.18-.287 0-.077.043-.14.078-.193.109-.162.297-.264.492-.264.091 0 .181.022.278.079.3.17.659.289.96.29.196 0 .325-.045.401-.091-.009-.164-.019-.331-.031-.51l-.003-.058c-.104-1.628-.23-3.654.3-4.847C7.85 1.068 11.216.793 12.206.793"/></svg>
                    Snapchat
                  </button>
                </div>

                {/* Native share (mobile) */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: `${user.displayName} sur SHAKEmoi`,
                          text: `Découvre mon profil sur SHAKEmoi ! 🎵`,
                          url: `https://shakemoi.fr?ref=${user.username}`,
                        });
                      } catch {}
                    }}
                    className="w-full mt-3 py-3 bg-purple-950/50 border border-purple-800/30 rounded-xl text-sm font-semibold text-purple-300 hover:bg-purple-900/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Plus d'options de partage...
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
