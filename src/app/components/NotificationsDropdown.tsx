import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getUserNotifications } from '../../lib/database';
import { supabase } from '../../lib/supabase';

interface Props { userId: string; unreadCount: number; onRead: () => void; }

export function NotificationsDropdown({ userId, unreadCount, onRead }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const loadNotifs = async () => {
    setLoading(true);
    const data = await getUserNotifications(userId);
    setNotifs(data);
    setLoading(false);
    // Mark all as read
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    onRead();
  };

  const toggle = () => {
    if (!open) loadNotifs();
    setOpen(!open);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'maintenant';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}j`;
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors relative">
        <Bell className={`w-5 h-5 ${open ? 'text-purple-400' : 'text-purple-300/60'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-pink-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white min-w-[18px] px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-[#0f0020] border border-pink-500/30 rounded-2xl shadow-2xl shadow-purple-900/30 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-pink-500/25 flex items-center justify-between">
              <span className="font-bold text-sm">Notifications</span>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-purple-900/40 rounded-full">
                <X className="w-4 h-4 text-purple-300/70" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-80">
              {loading ? (
                <div className="p-4 text-center text-purple-300/70 text-sm">Chargement...</div>
              ) : notifs.length > 0 ? (
                notifs.slice(0, 20).map(n => (
                  <div key={n.id} className={`px-4 py-2.5 flex items-center gap-3 border-b border-purple-800/10 ${!n.is_read ? 'bg-purple-500/5' : ''}`}>
                    <img
                      src={n.actor_avatar || `https://ui-avatars.com/api/?name=${n.actor_username}&background=random`}
                      className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-semibold">@{n.actor_username}</span>{' '}
                        <span className="text-purple-300/70">{n.content}</span>
                      </p>
                      <span className="text-[10px] text-purple-300/50">{formatTime(n.created_at)}</span>
                    </div>
                    {n.post_cover_url && (
                      <img src={n.post_cover_url} className="w-8 h-8 rounded-md flex-shrink-0 object-cover" alt="" />
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-purple-300/50 text-sm">Aucune notification</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
