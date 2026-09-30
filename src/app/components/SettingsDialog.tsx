import { X, Music2, Check, LogOut, User, Bell, Info, BellRing, Shield, Trash2, ChevronRight, Loader2, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

import { thumb, defaultAvatar } from '../../lib/media';
import { showLocalNotification } from '../../lib/notify';
import { normalizePlatform, PLATFORM_LABELS, STREAMING_APPS, type PlatformKey } from '../../lib/platforms';
import { PlatformLogo } from './PlatformLogo';
import { OnboardingDialog } from './OnboardingDialog';
import { useBackHandler } from '../../lib/navigation';
type MusicPlatform = PlatformKey;

interface SettingsDialogProps {
  currentUser: any;
  onClose: () => void;
  onSave: (settings: { musicService: MusicPlatform }) => void;
  onLogout?: () => void;
}

const savedPlatform = (u: any): MusicPlatform =>
  normalizePlatform(u?.musicService || u?.preferred_streaming_app || u?.preferred_platform) || 'spotify';

async function savePlatform(userId: string, service: MusicPlatform) {
  const { supabase } = await import('../../lib/supabase');
  const { error } = await supabase.from('users_profile').update({ preferred_streaming_app: service }).eq('id', userId);
  if (error) throw error;
}

export function SettingsDialog({ currentUser, onClose, onSave, onLogout }: SettingsDialogProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
  const [musicService, setMusicService] = useState<MusicPlatform>(() => savedPlatform(currentUser));
  const [initialMusicService, setInitialMusicService] = useState<MusicPlatform>(() => savedPlatform(currentUser));
  // « Revoir le tuto » : s'ouvre par-dessus, on revient ici à la fin (O1).
  const [replay, setReplay] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // L'email n'est plus copié dans users_profile (profil public) : on le lit
  // dans la session, seul endroit où il est visible par son propriétaire.
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    import('../../lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    );
  }, []);
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
      // iPhone : seulement dans l'appli installée sur l'écran d'accueil.
      setPushUnsupported(true);
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
    // Via le service worker : `new Notification()` plante sur Chrome Android (D4).
    showLocalNotification('C\'est activé ! Tu verras tes notifications ici.', 'welcome');
  };
  const [pushUnsupported, setPushUnsupported] = useState(false);

  const handleSave = async () => {
    if (musicService !== initialMusicService) {
      try {
        await savePlatform(currentUser.id, musicService);
      } catch (e) {
        console.error('Error saving platform:', e);
        setSaveError('Ton appli d\'écoute n\'a pas pu être enregistrée. Vérifie ta connexion et réessaie.');
        return;
      }
    }
    onSave({ musicService });
    onClose();
  };

  const handleReplayDone = async (service: MusicPlatform) => {
    setReplay(false);
    setMusicService(service);
    if (service === initialMusicService) return;
    try {
      await savePlatform(currentUser.id, service);
      setInitialMusicService(service);
      onSave({ musicService: service });
    } catch (e) {
      console.error('Error saving platform:', e);
      setSaveError('Ton appli d\'écoute n\'a pas pu être enregistrée. Vérifie ta connexion et réessaie.');
    }
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

  // Suppression du compte : double confirmation (on tape SUPPRIMER), puis
  // tout part côté serveur (fonction delete_my_account) et on se déconnecte.
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    const typed = prompt(
      'Supprimer ton compte efface définitivement ton profil, tes shakes, stories, messages et abonnements.\n\nTape SUPPRIMER pour confirmer.'
    );
    if (typed?.trim().toUpperCase() !== 'SUPPRIMER') return;
    setDeleting(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut().catch(() => {});
      Object.keys(localStorage).filter(k => k.startsWith('shakemoi')).forEach(k => localStorage.removeItem(k));
      alert('Ton compte a été supprimé.');
      window.location.href = '/';
    } catch (err) {
      console.error('Suppression du compte :', err);
      alert('La suppression a échoué. Réessaie, ou écris-nous à contact@shakemoi.fr.');
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Te déconnecter de Shakemoi ?')) {
      try {
        const { supabase } = await import('../../lib/supabase');
        await supabase.auth.signOut();
        localStorage.removeItem('shakemoi_auth_token');
        localStorage.removeItem('shakemoi_user');
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


  const avatar = thumb(currentUser?.avatar) || thumb(currentUser?.profile_album_cover_url) || defaultAvatar(currentUser?.username);
  const displayName = currentUser?.displayName || currentUser?.display_name || currentUser?.username;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]" onClick={handleClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-md border border-purple-800/30 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between sticky top-0 bg-[#1D0F3D] z-10">
          <h2 className="text-lg font-bold text-white">Paramètres</h2>
          <button aria-label="Fermer" onClick={handleClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
            <X className="w-6 h-6 text-purple-300/60" />
          </button>
        </div>

        <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-6">
          {/* Compte with avatar */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Compte</h3>
            </div>
            <div className="bg-purple-950/40 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <img loading="lazy"
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
                  <span className="text-sm text-white font-medium truncate max-w-[200px]">{email || '—'}</span>
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
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Appli d'écoute</h3>
            </div>
            <p className="text-xs text-purple-400/50 mb-3">
              Les sons s'ouvriront dans cette appli
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STREAMING_APPS.map((key) => (
                <button
                  key={key}
                  onClick={() => { setMusicService(key); setSaveError(null); }}
                  aria-pressed={musicService === key}
                  className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all text-left ${
                    musicService === key
                      ? 'border-fuchsia-400 bg-fuchsia-500/10'
                      : 'border-purple-800/30 bg-purple-950/40 hover:border-purple-700/40'
                  }`}
                >
                  <PlatformLogo platform={key} size="md" />
                  <span className="font-medium text-white text-sm leading-tight">{PLATFORM_LABELS[key]}</span>
                  {musicService === key && (
                    <Check className="w-4 h-4 text-fuchsia-400 absolute top-1.5 right-1.5" />
                  )}
                </button>
              ))}
            </div>
            {saveError && <p className="text-xs text-pink-400 mt-2">{saveError}</p>}
            <button
              onClick={() => setReplay(true)}
              className="mt-3 w-full flex items-center justify-between px-3 py-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 text-sm text-white transition-colors"
            >
              <span className="flex items-center gap-2"><PlayCircle className="w-4 h-4 text-fuchsia-400" /> Revoir le tuto</span>
              <ChevronRight className="w-4 h-4 text-purple-300/60" />
            </button>
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
                    <p className="text-sm text-white font-medium">Notifications sur ce téléphone</p>
                    <p className="text-xs text-purple-400/50">Quand SHAKEmoi est ouvert ou en arrière-plan</p>
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
              {pushUnsupported && (
                <p className="text-xs text-purple-300/70 mt-2">
                  Sur iPhone, installe d'abord SHAKEmoi sur l'écran d'accueil (Partager → « Sur l'écran d'accueil »), puis active-les depuis l'appli.
                </p>
              )}
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
                <span className="text-sm text-white text-right">{STREAMING_APPS.map(k => PLATFORM_LABELS[k]).join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Confidentialité */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-200/80 uppercase tracking-wide">Confidentialité</h3>
            </div>
            <div className="bg-purple-950/40 rounded-xl divide-y divide-purple-800/20">
              <a
                href="/confidentialite"
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between px-3 py-3 text-sm text-white hover:bg-white/5 rounded-t-xl"
              >
                Politique de confidentialité
                <ChevronRight className="w-4 h-4 text-purple-300/60" />
              </a>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full flex items-center justify-between px-3 py-3 text-sm text-red-300 hover:bg-red-500/10 rounded-b-xl disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer mon compte
                </span>
                <ChevronRight className="w-4 h-4 text-red-300/50" />
              </button>
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
      {replay && (
        <div onClick={(e) => e.stopPropagation()}>
          <OnboardingDialog
            replay
            initialService={musicService}
            onComplete={handleReplayDone}
            onClose={() => setReplay(false)}
          />
        </div>
      )}
    </div>
  );
}
