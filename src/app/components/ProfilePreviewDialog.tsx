import { X, Heart, Music, Users, UserPlus, UserCheck, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { getUserProfile, getUserPosts, getUserFollowersCount, getUserFollowingCount, followUser, unfollowUser, isFollowing } from '../../lib/database';
import { supabase } from '../../lib/supabase';

interface ProfilePreviewDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
}

export function ProfilePreviewDialog({ userId, username, onClose }: ProfilePreviewDialogProps) {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // Try direct UUID lookup first
      let profileData = await getUserProfile(userId);

      // If not found, try by username
      if (!profileData && username) {
        const { data } = await supabase
          .from('users_profile')
          .select('*')
          .eq('username', username)
          .maybeSingle();
        profileData = data;
      }

      if (!profileData) {
        setLoading(false);
        return;
      }

      const actualId = profileData.id;

      const [postsData, followersCount, followingCount, followingStatus] = await Promise.all([
        getUserPosts(actualId, 6),
        getUserFollowersCount(actualId),
        getUserFollowingCount(actualId),
        isFollowing(actualId)
      ]);

      setProfile(profileData);
      setPosts(postsData);
      setStats({
        followers: followersCount,
        following: followingCount,
        posts: postsData.length
      });
      setIsFollowingUser(followingStatus);
    } catch (error) {
      console.error('Error loading profile preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      if (isFollowingUser) {
        await unfollowUser(profile.id);
        setIsFollowingUser(false);
        setStats({ ...stats, followers: stats.followers - 1 });
      } else {
        await followUser(profile.id);
        setIsFollowingUser(true);
        setStats({ ...stats, followers: stats.followers + 1 });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="bg-[#0f0020] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="bg-[#0f0020] rounded-2xl p-8 text-center">
          <p className="text-purple-300/60">Profil introuvable</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-sm">Fermer</button>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const avatar = profile.profile_album_cover_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#0f0020] rounded-2xl w-full max-w-md border border-purple-800/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Header with gradient */}
        <div className="relative h-24 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900" />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-12 mb-3">
            <img
              src={avatar}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-4 border-[#0f0020] ring-2 ring-purple-500"
            />
          </div>

          <h2 className="text-xl font-bold text-white mb-0.5">{displayName}</h2>
          <p className="text-sm text-purple-400 mb-1">@{profile.username}</p>

          {profile.bio && (
            <p className="text-sm text-purple-200/80 mb-3">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-4 mb-4 text-sm">
            <div>
              <span className="font-bold text-white">{stats.posts}</span>
              <span className="text-purple-300/60 ml-1">shakes</span>
            </div>
            <div>
              <span className="font-bold text-white">{stats.followers}</span>
              <span className="text-purple-300/60 ml-1">abonnés</span>
            </div>
            <div>
              <span className="font-bold text-white">{stats.following}</span>
              <span className="text-purple-300/60 ml-1">abonnements</span>
            </div>
          </div>

          {/* Follow Button */}
          <button
            onClick={handleFollowToggle}
            className={`w-full py-2.5 rounded-full font-semibold transition-all flex items-center justify-center gap-2 ${
              isFollowingUser
                ? 'bg-purple-950/40 hover:bg-purple-800/40 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white'
            }`}
          >
            {isFollowingUser ? (
              <>
                <UserCheck className="w-4 h-4" />
                Abonné
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                S'abonner
              </>
            )}
          </button>

          {/* Recent Posts Grid */}
          {posts.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-purple-300/60 mb-2">Derniers shakes</h3>
              <div className="grid grid-cols-3 gap-2">
                {posts.slice(0, 6).map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square rounded-lg overflow-hidden group cursor-pointer relative"
                  >
                    <img
                      src={post.cover_url}
                      alt={post.track_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1">
                      <p className="text-[10px] text-white font-semibold text-center truncate w-full">{post.track_name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Heart className="w-3 h-3 text-pink-500" />
                        <span className="text-[10px] text-white">{post.likes_count || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
