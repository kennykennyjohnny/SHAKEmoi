import { X, Music2, Check, LogOut, User, Bell, Info, Shield, Trash2, ChevronRight, Loader2, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

import { defaultAvatar, avatarThumb } from '../../lib/media';
import { PushToggle, NotifPrefsList } from './PushToggle';
import { openBugReport, openBlockedUsers, openAdmin } from '../../lib/appNav';
import { isAdmin } from '../../lib/moderation';
import { Bug, Ban, ShieldCheck } from 'lucide-react';
import { forgetPushOnLogout } from '../../lib/push';
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
  // Ligne « Admin » : seulement pour le compte de Kenny (la base vérifie aussi).
  const [admin, setAdmin] = useState(false);
  useEffect(() => { isAdmin().then(setAdmin).catch(() => {}); }, []);
  // L'email n'est plus copié dans users_profile (profil public) : on le lit
  // dans la session, seul endroit où il est visible par son propriétaire.
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    import('../../lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    );
  }, []);
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

  const hasChanges = musicService !== initialMusicService;

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
        // Ce téléphone ne reçoit plus les notifs de ce compte.
        await forgetPushOnLogout();
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


  const avatar = avatarThumb(currentUser?.avatar) || avatarThumb(currentUser?.profile_album_cover_url) || defaultAvatar(currentUser?.username);
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

            <PushToggle />
            <p className="text-xs text-purple-300/60 mt-3 mb-2 px-1">Ce que tu reçois (cloche et téléphone) :</p>
            <NotifPrefsList />
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
                <span className="text-sm text-white">{__APP_VERSION__}</span>
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

          {/* Aide et sécurité (P15 / P17) */}
          <div className="bg-purple-950/40 rounded-xl divide-y divide-purple-800/20">
            <button onClick={() => { onClose(); openBugReport(); }} className="w-full flex items-center justify-between px-3 py-3 text-sm text-white hover:bg-white/5 rounded-t-xl">
              <span className="flex items-center gap-2"><Bug className="w-4 h-4 text-fuchsia-400" /> Signaler un bug</span>
              <ChevronRight className="w-4 h-4 text-purple-300/60" />
            </button>
            <button onClick={() => { onClose(); openBlockedUsers(); }} className={`w-full flex items-center justify-between px-3 py-3 text-sm text-white hover:bg-white/5 ${admin ? '' : 'rounded-b-xl'}`}>
              <span className="flex items-center gap-2"><Ban className="w-4 h-4 text-fuchsia-400" /> Personnes bloquées</span>
              <ChevronRight className="w-4 h-4 text-purple-300/60" />
            </button>
            {admin && (
              <button onClick={() => { onClose(); openAdmin(); }} className="w-full flex items-center justify-between px-3 py-3 text-sm text-white hover:bg-white/5 rounded-b-xl">
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Admin : bugs et signalements</span>
                <ChevronRight className="w-4 h-4 text-purple-300/60" />
              </button>
            )}
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
