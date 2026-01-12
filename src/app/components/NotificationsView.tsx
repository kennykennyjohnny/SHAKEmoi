import { Heart, MessageCircle, UserPlus, Music, Repeat2 } from 'lucide-react';
import { motion } from 'motion/react';

export function NotificationsView() {
  const notifications = [
    {
      id: '1',
      type: 'like',
      user: {
        username: 'sophiemusic',
        displayName: 'Sophie M.',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop'
      },
      message: 'a aimé votre shake',
      timestamp: '5min',
      trackCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop'
    },
    {
      id: '2',
      type: 'comment',
      user: {
        username: 'djmaxime',
        displayName: 'DJ Maxime',
        avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'
      },
      message: 'a commenté : "Super son ! 🔥"',
      timestamp: '15min',
      trackCover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&h=100&fit=crop'
    },
    {
      id: '3',
      type: 'follow',
      user: {
        username: 'marcbeats',
        displayName: 'Marc Beats',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
      },
      message: 's\'est abonné à vous',
      timestamp: '1h'
    },
    {
      id: '4',
      type: 'reshake',
      user: {
        username: 'emmavibes',
        displayName: 'Emma Vibes',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
      },
      message: 'a reshaké votre post',
      timestamp: '3h',
      trackCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop'
    },
    {
      id: '5',
      type: 'like',
      user: {
        username: 'thomas_dj',
        displayName: 'Thomas',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop'
      },
      message: 'a aimé votre shake',
      timestamp: '5h',
      trackCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop'
    },
    {
      id: '6',
      type: 'follow',
      user: {
        username: 'julie_music',
        displayName: 'Julie',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop'
      },
      message: 's\'est abonné à vous',
      timestamp: '1j'
    },
    {
      id: '7',
      type: 'comment',
      user: {
        username: 'alex_beats',
        displayName: 'Alex',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
      },
      message: 'a commenté : "Excellent goût musical 👌"',
      timestamp: '2j',
      trackCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop'
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 fill-current text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      case 'reshake':
        return <Repeat2 className="w-4 h-4 text-green-500" />;
      default:
        return <Music className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold text-white mb-4">Notifications</h1>
      
      <div className="space-y-2">
        {notifications.map((notif, index) => (
          <motion.button
            key={notif.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-lg p-3 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-800 text-left"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              {getIcon(notif.type)}
            </div>

            {/* Avatar */}
            <img
              src={notif.user.avatar}
              alt={notif.user.displayName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-semibold">{notif.user.displayName}</span>
                {' '}
                <span className="text-gray-400">{notif.message}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{notif.timestamp}</p>
            </div>

            {/* Track Cover */}
            {notif.trackCover && (
              <img
                src={notif.trackCover}
                alt="Track"
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
