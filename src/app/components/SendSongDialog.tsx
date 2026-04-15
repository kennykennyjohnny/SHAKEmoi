import { X, Send, Loader2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { searchUsers, sendSongNotification } from '../../lib/database';

interface SendSongDialogProps {
  track: any;
  onClose: () => void;
}

export function SendSongDialog({ track, onClose }: SendSongDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchForUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchForUsers = async () => {
    try {
      setLoading(true);
      const results = await searchUsers(searchQuery);
      setUsers(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedUser) return;

    try {
      setSending(true);
      await sendSongNotification(selectedUser.id, track);
      alert(`✅ Son envoyé à @${selectedUser.username} !`);
      onClose();
    } catch (error) {
      console.error('Error sending song:', error);
      alert('❌ Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#0f0020] rounded-2xl w-full max-w-md border border-purple-800/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold">Envoyer ce son</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-purple-300/60" />
          </button>
        </div>

        {/* Track Preview */}
        <div className="p-4 border-b border-purple-800/20">
          <div className="flex gap-3 bg-purple-950/40 rounded-lg p-3">
            <img
              src={track.coverUrl || track.thumbnail}
              alt={track.title}
              className="w-14 h-14 rounded-md object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">{track.title}</h3>
              <p className="text-xs text-purple-300/60 truncate">{track.artist}</p>
            </div>
          </div>
        </div>

        {/* Search User */}
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un ami..."
              className="w-full bg-purple-950/40 border border-purple-800/30 rounded-lg pl-10 pr-3 py-2 text-white placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* User List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-purple-300/60 text-sm">
                {searchQuery.length >= 2 ? 'Aucun utilisateur trouvé' : 'Tape au moins 2 caractères'}
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                    selectedUser?.id === user.id
                      ? 'bg-purple-600 border-2 border-purple-500'
                      : 'bg-purple-950/40 hover:bg-purple-800/40 border-2 border-transparent'
                  }`}
                >
                  <img
                    src={user.profile_album_cover_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm">{user.username}</p>
                    <p className="text-xs text-purple-300/60">
                      {user.feels_count || 0} abonnés
                    </p>
                  </div>
                  {selectedUser?.id === user.id && (
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-purple-600 rounded-full" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Send Button */}
        <div className="p-4 border-t border-purple-800/20">
          <button
            onClick={handleSend}
            disabled={!selectedUser || sending}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer à {selectedUser ? `@${selectedUser.username}` : '...'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
