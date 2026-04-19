import { Heart, MessageCircle, UserPlus, UserCheck, UserMinus, Music, Repeat2, Loader2, Bell, Users, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getUserNotifications, followUser, unfollowUser, isFollowing } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';

interface NotificationsViewProps {
  currentUser: any;
  onNavigateToPost?: (postId: string) => void;
  onNavigateToProfile?: (userId: string) => void;
}

export function NotificationsView({ currentUser, onNavigateToPost, onNavigateToProfile }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const data = await getUserNotifications(currentUser.id);
      setNotifications(data);

      // Mark all as read
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
      
      // Check follow state for follow notifications (trigger creates 'feel' type)
      const followNotifs = data.filter((n: any) => (n.type === 'follow' || n.type === 'feel') && n.actor_id);
      const states: Record<string, boolean> = {};
      await Promise.all(followNotifs.map(async (n: any) => {
        try { states[n.actor_id] = await isFollowing(n.actor_id); } catch { states[n.actor_id] = false; }
      }));
      setFollowingState(states);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowBack = async (userId: string) => {
    try {
      if (followingState[userId] || followedBack.has(userId)) {
        // Unfollow
        await unfollowUser(userId);
        const newFollowed = new Set(followedBack);
        newFollowed.delete(userId);
        setFollowedBack(newFollowed);
        setFollowingState({ ...followingState, [userId]: false });
      } else {
        // Follow
        await followUser(userId);
        setFollowedBack(new Set([...followedBack, userId]));
        setFollowingState({ ...followingState, [userId]: true });
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
        <p className="text-sm text-purple-400/50">Chargement des notifications...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-20 h-20 bg-purple-950/40 rounded-full flex items-center justify-center mb-4 border border-purple-800/20">
          <Bell className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Aucune notification</h3>
        <p className="text-sm text-purple-400/50 text-center">
          Les interactions avec tes shakes apparaîtront ici
        </p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 fill-current text-pink-500" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-fuchsia-400" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-purple-400" />;
      case 'reshake':
        return <Repeat2 className="w-3.5 h-3.5 text-fuchsia-400" />;
      default:
        return <Music className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'like': return 'bg-pink-500/15 border-pink-500/25';
      case 'comment': return 'bg-fuchsia-500/15 border-fuchsia-500/25';
      case 'follow': return 'bg-purple-500/15 border-purple-500/25';
      case 'reshake': return 'bg-fuchsia-500/15 border-fuchsia-500/25';
      default: return 'bg-purple-500/15 border-purple-500/25';
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'maintenant';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-3 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 rounded-xl flex items-center justify-center border border-fuchsia-500/20">
            <Bell className="w-5 h-5 text-fuchsia-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Notifications</h1>
        </div>
        <button onClick={loadNotifications} className="p-2 hover:bg-purple-900/30 rounded-full transition-colors">
          <RefreshCw className="w-4 h-4 text-purple-400/60" />
        </button>
      </div>

      <div className="space-y-1.5">
        {notifications.map((notif, index) => {
          const isFollowNotif = notif.type === 'follow' || notif.type === 'feel';
          const alreadyFollowing = followingState[notif.actor_id] || followedBack.has(notif.actor_id);
          const hasPost = !!notif.post_cover_url;
          const canNavigate = (notif.type === 'like' || notif.type === 'comment' || notif.type === 'reshake') && notif.post_id;

          const handleNotifClick = () => {
            if (notif.type === 'follow' && onNavigateToProfile) {
              onNavigateToProfile(notif.actor_id);
            } else if (canNavigate && onNavigateToPost) {
              onNavigateToPost(notif.post_id);
            }
          };

          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={handleNotifClick}
              className={`w-full bg-purple-950/25 hover:bg-purple-900/30 rounded-xl p-2.5 flex items-center gap-2.5 transition-colors border border-purple-800/15 ${!notif.is_read ? 'border-l-2 border-l-fuchsia-500' : ''} ${canNavigate || notif.type === 'follow' ? 'cursor-pointer' : ''}`}
            >
              {/* Icon */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${getIconBg(notif.type)}`}>
                {getIcon(notif.type)}
              </div>

              {/* Avatar */}
              <button
                onClick={(e) => { e.stopPropagation(); setProfilePreview({ userId: notif.actor_id || notif.actor_username, username: notif.actor_username }); }}
                className="flex-shrink-0"
              >
                <img
                  src={notif.actor_avatar || `https://ui-avatars.com/api/?name=${notif.actor_username}&background=random`}
                  alt={notif.actor_username}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-700/30 hover:ring-2 hover:ring-fuchsia-500 transition-all"
                />
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfilePreview({ userId: notif.actor_id || notif.actor_username, username: notif.actor_username }); }}
                    className="font-bold hover:underline text-fuchsia-400"
                  >
                    @{notif.actor_username}
                  </button>
                  {' '}
                  <span className="text-purple-200/70 text-xs">{notif.content}</span>
                  {notif.post_track_name && <span className="text-purple-300/50 text-xs"> · {notif.post_track_name}</span>}
                </p>
                <p className="text-[10px] text-purple-500/40 mt-0.5">{formatTimestamp(notif.created_at)}</p>
              </div>

              {/* Follow-back button (prominent) */}
              {isFollowNotif && !alreadyFollowing && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleFollowBack(notif.actor_id); }}
                  className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-lg shadow-purple-500/20 active:scale-95"
                >
                  <UserPlus className="w-3 h-3" /> Suivre
                </button>
              )}
              {isFollowNotif && alreadyFollowing && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleFollowBack(notif.actor_id); }}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm text-fuchsia-400 bg-fuchsia-500/15 px-3.5 py-1.5 rounded-full border border-fuchsia-500/25 font-medium hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/25 transition-colors active:scale-95"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Abonné
                </button>
              )}

              {/* Track Cover if available */}
              {hasPost && (
                <div className="flex-shrink-0">
                  <img
                    src={notif.post_cover_url}
                    alt="Track"
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-purple-700/20"
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

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
