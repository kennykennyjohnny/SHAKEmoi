import { X, Music2, Check, LogOut, User, Bell, Shield, Info, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

type MusicPlatform = 'spotify' | 'apple_music' | 'deezer' | 'youtube_music' | 'tidal';

interface SettingsDialogProps {
  currentUser: any;
  onClose: () => void;
  onSave: (settings: { musicService: MusicPlatform }) => void;
  onLogout?: () => void;
}

export function SettingsDialog({ currentUser, onClose, onSave, onLogout }: SettingsDialogProps) {
  const [musicService, setMusicService] = useState<MusicPlatform>(
    currentUser?.musicService || currentUser?.preferred_platform || 'spotify'
  );
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    reshakes: true,
    follows: true,
  });

  const handleSave = async () => {
    // Save platform preference to Supabase
    try {
      const { supabase } = await import('../../lib/supabase');
      await supabase
        .from('users_profile')
        .update({ preferred_platform: musicService })
        .eq('id', currentUser.id);
    } catch (e) {
      console.error('Error saving platform:', e);
    }
    onSave({ musicService });
    onClose();
  };

  const handleLogout = async () => {
    if (confirm('Te déconnecter de Shakemoi ?')) {
      try {
        const { supabase } = await import('../../lib/supabase');
        await supabase.auth.signOut();
        localStorage.removeItem('shakemoi_auth_token');
        localStorage.removeItem('shakemoi_user');
        localStorage.removeItem('shakemoi_onboarding');
        if (onLogout) {
          onLogout();
        } else {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
      }
    }
  };

  const platforms = [
    { id: 'spotify', name: 'Spotify', icon: '🟢', color: 'from-green-600 to-green-500' },
    { id: 'apple_music', name: 'Apple Music', icon: '🔴', color: 'from-pink-600 to-red-500' },
    { id: 'deezer', name: 'Deezer', icon: '🟣', color: 'from-purple-500 to-purple-400' },
    { id: 'youtube_music', name: 'YouTube Music', icon: '🔴', color: 'from-red-600 to-red-500' },
    { id: 'tidal', name: 'Tidal', icon: '🔵', color: 'from-cyan-600 to-cyan-500' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-lg font-bold text-white">Paramètres</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Compte */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Compte</h3>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Utilisateur</span>
                <span className="text-sm text-white font-medium">@{currentUser?.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm text-white font-medium truncate max-w-[200px]">{currentUser?.email || '—'}</span>
              </div>
            </div>
          </div>

          {/* Plateforme musicale */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Music2 className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Plateforme musicale</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Le bouton "Écouter" ouvrira les morceaux dans cette app
            </p>
            <div className="space-y-2">
              {platforms.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setMusicService(service.id as MusicPlatform)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    musicService === service.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center text-lg`}>
                      {service.icon}
                    </div>
                    <span className="font-medium text-white">{service.name}</span>
                  </div>
                  {musicService === service.id && (
                    <Check className="w-5 h-5 text-purple-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Notifications</h3>
            </div>
            <div className="bg-zinc-800 rounded-xl divide-y divide-zinc-700">
              {[
                { key: 'likes', label: 'Likes sur mes shakes' },
                { key: 'comments', label: 'Commentaires' },
                { key: 'reshakes', label: 'Reshakes' },
                { key: 'follows', label: 'Nouveaux abonnés' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3">
                  <span className="text-sm text-white">{item.label}</span>
                  <button
                    onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      notifications[item.key as keyof typeof notifications] ? 'bg-purple-500' : 'bg-zinc-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                      notifications[item.key as keyof typeof notifications] ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* A propos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">À propos</h3>
            </div>
            <div className="bg-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Version</span>
                <span className="text-sm text-white">1.0.0 Beta</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Plateforme</span>
                <span className="text-sm text-white">SHAKEmoi</span>
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Enregistrer les paramètres
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl font-medium transition-colors border border-red-600/20"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
