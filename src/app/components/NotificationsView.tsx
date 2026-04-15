import { Heart, MessageCircle, UserPlus, UserCheck, Music, Repeat2, Loader2, Bell, Users, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getUserNotifications, followUser, isFollowing } from '../../lib/database';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';

interface NotificationsViewProps {
  currentUser: any;
  onNavigateToPost?: (postId: string) => void;
}

export function NotificationsView({ currentUser, onNavigateToPost }: NotificationsViewProps) {
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
      
      // Check follow state for follow notifications
      const followNotifs = data.filter((n: any) => n.type === 'follow' && n.actor_id);
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
      await followUser(userId);
      setFollowedBack(new Set([...followedBack, userId]));
      setFollowingState({ ...followingState, [userId]: true });
    } catch (err) {
      console.error('Error following back:', err);
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
        <div className="w-16 h-16 bg-purple-950/40 rounded-full flex items-center justify-center mb-4 border border-purple-800/20">
          <Bell className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Aucune notification</h3>
        <p className="text-sm text-purple-400/50 text-center">
          Les interactions avec tes shakes apparaîtront ici
        </p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 fill-current text-pink-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-fuchsia-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-400" />;
      case 'reshake':
        return <Repeat2 className="w-4 h-4 text-fuchsia-400" />;
      default:
        return <Music className="w-4 h-4 text-purple-400" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'like': return 'bg-pink-500/10 border-pink-500/20';
      case 'comment': return 'bg-fuchsia-500/10 border-fuchsia-500/20';
      case 'follow': return 'bg-purple-500/10 border-purple-500/20';
      case 'reshake': return 'bg-fuchsia-500/10 border-fuchsia-500/20';
      default: return 'bg-purple-500/10 border-purple-500/20';
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
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold text-white mb-4">Notifications</h1>

      <div className="space-y-2">
        {notifications.map((notif, index) => {
          const isFollowNotif = notif.type === 'follow';
          const alreadyFollowing = followingState[notif.actor_id] || followedBack.has(notif.actor_id);
          const hasPost = !!notif.post_cover_url;

          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`w-full bg-purple-950/25 hover:bg-purple-900/30 rounded-xl p-4 flex items-start gap-3 transition-colors border border-purple-800/20 ${!notif.is_read ? 'border-l-2 border-l-fuchsia-500' : ''}`}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${getIconBg(notif.type)}`}>
                {getIcon(notif.type)}
              </div>

              {/* Avatar - clickable for profile preview */}
              <button
                onClick={() => setProfilePreview({ userId: notif.actor_id || notif.actor_username, username: notif.actor_username })}
                className="flex-shrink-0"
              >
                <img
                  src={notif.actor_avatar || `https://ui-avatars.com/api/?name=${notif.actor_username}&background=random`}
                  alt={notif.actor_username}
                  className="w-11 h-11 rounded-full object-cover ring-1 ring-purple-700/30 hover:ring-2 hover:ring-purple-500 transition-all"
                />
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-relaxed">
                  <button
                    onClick={() => setProfilePreview({ userId: notif.actor_id || notif.actor_username, username: notif.actor_username })}
                    className="font-bold hover:underline text-fuchsia-400"
                  >
                    @{notif.actor_username}
                  </button>
                  {' '}
                  <span className="text-purple-200/70">{notif.content}</span>
                </p>
                <p className="text-xs text-purple-500/40 mt-1">{formatTimestamp(notif.created_at)}</p>

                {/* Follow-back button for follow notifications */}
                {isFollowNotif && !alreadyFollowing && (
                  <button
                    onClick={() => handleFollowBack(notif.actor_id)}
                    className="mt-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3 h-3" /> Suivre en retour
                  </button>
                )}
                {isFollowNotif && alreadyFollowing && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-fuchsia-400/60">
                    <UserCheck className="w-3 h-3" /> Suivi(e)
                  </span>
                )}
              </div>

              {/* Track Cover if available - clickable to navigate to post */}
              {hasPost && (
                <button
                  onClick={() => {/* Navigate to post in feed would require post_id from notification - future */}}
                  className="flex-shrink-0 group"
                  title="Voir le shake"
                >
                  <img
                    src={notif.post_cover_url}
                    alt="Track"
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-purple-700/20 group-hover:ring-2 group-hover:ring-fuchsia-500/50 transition-all"
                  />
                </button>
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
