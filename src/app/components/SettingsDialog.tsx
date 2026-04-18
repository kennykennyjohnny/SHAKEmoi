import { X, Music2, Check, LogOut, User, Bell, Info, BellRing } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

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
  const [initialMusicService] = useState<MusicPlatform>(
    currentUser?.musicService || currentUser?.preferred_platform || 'spotify'
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('shakemoi_notif_prefs');
    return saved ? JSON.parse(saved) : {
      likes: true,
      comments: true,
      reshakes: true,
      follows: true,
    };
  });
  const [initialNotifications] = useState(() => {
    const saved = localStorage.getItem('shakemoi_notif_prefs');
    return saved ? JSON.parse(saved) : {
      likes: true,
      comments: true,
      reshakes: true,
      follows: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('shakemoi_notif_prefs', JSON.stringify(notifications));
  }, [notifications]);

  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem('shakemoi_push_enabled') === 'true';
  });

  const togglePushNotifications = async () => {
    if (typeof Notification === 'undefined') {
      alert('Les notifications ne sont pas supportées sur ce navigateur');
      return;
    }

    if (pushEnabled) {
      // Disable
      setPushEnabled(false);
      localStorage.setItem('shakemoi_push_enabled', 'false');
      return;
    }

    // Enable - request permission if needed
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== 'granted') return;
    } else if (Notification.permission === 'denied') {
      return; // Can't enable, blocked by browser
    }

    setPushEnabled(true);
    localStorage.setItem('shakemoi_push_enabled', 'true');
    new Notification('SHAKEmoi', {
      body: 'Bienvenue sur SHAKEmoi ! Tu recevras tes notifications ici.',
      icon: '/favicon.ico',
    });
  };

  const handleSave = async () => {
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

  const hasChanges = musicService !== initialMusicService ||
    JSON.stringify(notifications) !== JSON.stringify(initialNotifications);

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('Tu as des modifications non enregistrées. Enregistrer avant de quitter ?')) {
        handleSave();
      } else {
        onClose();
      }
    } else {
      onClose();
    }
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
    { id: 'apple_music', name: 'Apple Music', icon: '🍎', color: 'from-pink-600 to-pink-500' },
    { id: 'deezer', name: 'Deezer', icon: '🎵', color: 'from-purple-500 to-purple-400' },
    { id: 'youtube_music', name: 'YouTube Music', icon: '▶️', color: 'from-pink-600 to-orange-500' },
    { id: 'tidal', name: 'Tidal', icon: '🌊', color: 'from-cyan-600 to-cyan-500' },
  ];

  const avatar = currentUser?.avatar || currentUser?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${currentUser?.username}&background=random`;
  const displayName = currentUser?.displayName || currentUser?.display_name || currentUser?.username;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-md border border-purple-800/30 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between sticky top-0 bg-[#1D0F3D] z-10">
          <h2 className="text-lg font-bold text-white">Paramètres</h2>
          <button onClick={handleClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-6 h-6 text-purple-300/60" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Compte with avatar */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Compte</h3>
            </div>
            <div className="bg-purple-950/40 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500"
                />
                <div>
                  <p className="font-bold text-white">{displayName}</p>
                  <p className="text-sm text-purple-400">@{currentUser?.username}</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-purple-800/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-purple-300/60">Email</span>
                  <span className="text-sm text-white font-medium truncate max-w-[200px]">{currentUser?.email || '—'}</span>
                </div>
                {currentUser?.bio && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-purple-300/60">Bio</span>
                    <span className="text-sm text-white max-w-[200px] text-right">{currentUser.bio}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Plateforme musicale */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Music2 className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Plateforme musicale</h3>
            </div>
            <p className="text-xs text-purple-400/50 mb-3">
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
                      : 'border-purple-800/30 bg-purple-950/40 hover:border-purple-700/40'
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
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Notifications</h3>
            </div>

            {/* Push notification permission */}
            <div className="bg-purple-950/40 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-sm text-white font-medium">Notifications push</p>
                    <p className="text-xs text-purple-400/50">Recevoir les notifs même l'app fermée</p>
                  </div>
                </div>
                <button
                  onClick={togglePushNotifications}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    notifPermission === 'denied'
                      ? 'bg-pink-900/50 cursor-not-allowed'
                      : pushEnabled && notifPermission === 'granted'
                        ? 'bg-purple-500'
                        : 'bg-purple-900/50'
                  }`}
                  disabled={notifPermission === 'denied'}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                    pushEnabled && notifPermission === 'granted' ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {notifPermission === 'denied' && (
                <p className="text-xs text-pink-400 mt-2">
                  Les notifications sont bloquées. Va dans les paramètres de ton navigateur pour les réactiver.
                </p>
              )}
            </div>

            <div className="bg-purple-950/40 rounded-xl divide-y divide-purple-800/20">
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
                      notifications[item.key as keyof typeof notifications] ? 'bg-purple-500' : 'bg-purple-900/50'
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

          {/* À propos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">À propos</h3>
            </div>
            <div className="bg-purple-950/40 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300/60">Version</span>
                <span className="text-sm text-white">1.1.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300/60">Plateforme</span>
                <span className="text-sm text-white font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">SHAKEmoi</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-300/60">Intégrations</span>
                <span className="text-sm text-white">Spotify, Odesli, YouTube</span>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-600/10 hover:bg-pink-600/20 text-pink-500 rounded-xl font-medium transition-colors border border-pink-600/20"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}
