import { Heart, MessageCircle, UserPlus, Music, Repeat2, Loader2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getUserNotifications } from '../../lib/database';
import { ProfilePreviewDialog } from './ProfilePreviewDialog';

interface NotificationsViewProps {
  currentUser: any;
}

export function NotificationsView({ currentUser }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const data = await getUserNotifications(currentUser.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
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
        return <Heart className="w-4 h-4 fill-current text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-400" />;
      case 'reshake':
        return <Repeat2 className="w-4 h-4 text-green-400" />;
      default:
        return <Music className="w-4 h-4 text-purple-400" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'like': return 'bg-red-500/10 border-red-500/20';
      case 'comment': return 'bg-blue-500/10 border-blue-500/20';
      case 'follow': return 'bg-purple-500/10 border-purple-500/20';
      case 'reshake': return 'bg-green-500/10 border-green-500/20';
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
        {notifications.map((notif, index) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="w-full bg-purple-950/25 hover:bg-purple-900/30 rounded-xl p-3 flex items-center gap-3 transition-colors border border-purple-800/20"
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${getIconBg(notif.type)}`}>
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
                className="w-10 h-10 rounded-full object-cover ring-1 ring-purple-700/30 hover:ring-2 hover:ring-purple-500 transition-all"
              />
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <button
                  onClick={() => setProfilePreview({ userId: notif.actor_id || notif.actor_username, username: notif.actor_username })}
                  className="font-semibold hover:underline"
                >
                  @{notif.actor_username}
                </button>
                {' '}
                <span className="text-purple-300/60">{notif.content}</span>
              </p>
              <p className="text-xs text-purple-500/40 mt-0.5">{formatTimestamp(notif.created_at)}</p>
            </div>

            {/* Track Cover if available */}
            {notif.post_cover_url && (
              <img
                src={notif.post_cover_url}
                alt="Track"
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            )}
          </motion.div>
        ))}
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
