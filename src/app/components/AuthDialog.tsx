import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Logo } from './Logo';
import { Slogan } from './Slogan';
import { friendlyError } from '../../lib/errors';
import { normalizeUsername, usernameError, resolveUserId } from '../../lib/username';

import { defaultAvatar, avatarThumb } from '../../lib/media';
interface AuthDialogProps {
  onComplete: (user: any) => void;
  referrer?: string | null;
  /** Pourquoi on demande un compte (ex. « pour suivre @x »), affiché en tête. */
  reason?: string | null;
}

export function AuthDialog({ onComplete, referrer, reason }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Profil du compte : créé par la base à l'inscription ; sinon (compte d'un
  // essai raté) on le crée ici avec le pseudo choisi.
  const ensureProfile = async (userId: string, username: string, displayName: string) => {
    const { data: existing } = await supabase.from('users_profile').select('*').eq('id', userId).maybeSingle();
    if (existing) return existing;
    const { data: created, error: insertError } = await supabase
      .from('users_profile')
      .insert([{ id: userId, username, display_name: displayName.trim() || username, color: '#B4A7D6', feels_count: 0, feelings_count: 0 }])
      .select('*')
      .single();
    if (insertError) {
      throw new Error(insertError.code === '23505' ? 'Ce pseudo est déjà pris' : 'Erreur lors de la création du profil');
    }
    return created;
  };
  const [referrerProfile, setReferrerProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });

  // Fetch referrer profile if available
  useEffect(() => {
    if (referrer) {
      setMode('signup');
      resolveUserId(referrer).then(async (id) => {
        if (!id) return;
        const { data } = await supabase
          .from('users_profile')
          .select('id, username, display_name, profile_album_cover_url, bio')
          .eq('id', id)
          .maybeSingle();
        if (data) setReferrerProfile(data);
      });
    }
  }, [referrer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'forgot') {
        // G1 : lien de réinitialisation envoyé par email ; au retour dans
        // l'appli, une fenêtre « Nouveau mot de passe » s'ouvre (App).
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email.trim(), {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetError) throw resetError;
        setInfo('C\'est parti : regarde tes emails (et les spams) pour choisir un nouveau mot de passe.');
        return;
      }

      if (mode === 'signup') {
        // G2 : même règle partout (appli + base) ; minuscules automatiques.
        const username = normalizeUsername(formData.username);
        const ruleError = usernameError(username);
        if (ruleError) throw new Error(ruleError);
        const { data: free } = await supabase.rpc('username_available', { p_username: username });
        if (free === false) throw new Error('Ce pseudo est déjà pris');

        // G4 : le profil est créé par la base EN MÊME TEMPS que le compte
        // (pseudo passé ici) : plus de compte coincé sans profil.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: { data: { username, display_name: formData.displayName.trim() || username } },
        });

        if (authError) {
          // Compte déjà créé lors d'un essai raté : on tente de s'y connecter.
          if (/already registered|already been registered/i.test(authError.message || '')) {
            const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
              email: formData.email.trim(), password: formData.password,
            });
            if (signInError || !signIn.user) throw authError;
            onComplete(await ensureProfile(signIn.user.id, username, formData.displayName));
            return;
          }
          throw authError;
        }
        if (!authData.user) throw new Error('Erreur lors de la création du compte');
        if (!authData.session) {
          // Confirmation par email activée : le compte attend la validation.
          setInfo('Compte créé ! Confirme ton email (regarde aussi les spams), puis connecte-toi.');
          setMode('login');
          return;
        }

        onComplete(await ensureProfile(authData.user.id, username, formData.displayName));
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (error) throw error;
        if (!data.user) throw new Error('Erreur de connexion');

        const { data: profile } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        // Profil manquant (ancienne inscription ratée) : l'appli propose de
        // choisir un pseudo au lieu de traiter la personne en visiteur (G4).
        onComplete(profile || { id: data.user.id, __needsProfile: true });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Messages de Supabase en anglais → français (G5).
      setError(friendlyError(err, 'Une erreur est survenue. Réessaie.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1E1440] z-50 overflow-y-auto overscroll-contain">
      <div className="min-h-full flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1D0F3D] rounded-2xl border border-purple-800/30 overflow-hidden shadow-2xl shadow-purple-900/20"
        >
          {reason && (
            <p className="px-5 py-3 text-center text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600">
              {reason}
            </p>
          )}
          {/* Header */}
          <div className="p-6 text-center">
            {referrerProfile ? (
              <>
                {/* Referrer invitation */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="mb-3 flex flex-col items-center"
                >
                  <img loading="lazy"
                    src={avatarThumb(referrerProfile.profile_album_cover_url) || defaultAvatar(referrerProfile.username)}
                    alt={referrerProfile.username}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-fuchsia-500 mb-2"
                  />
                  <div className="flex items-center gap-1.5 mb-1">
                    <UserPlus className="w-4 h-4 text-fuchsia-400" />
                    <span className="text-sm font-semibold text-fuchsia-400">Invitation</span>
                  </div>
                </motion.div>
                <h1 className="text-lg font-black text-white mb-1">
                  {referrerProfile.display_name || referrerProfile.username} veut te retrouver sur SHAKEmoi !
                </h1>
                <p className="text-purple-300/85 text-sm">
                  Inscris-toi pour partager tes sons et découvrir ce que tes amis écoutent 🎵
                </p>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="mb-3 flex justify-center"
                >
                  <Logo size="lg" animated={true} showText={true} />
                </motion.div>
                <p className="text-purple-300/85 text-sm mt-1">
                  {mode === 'login' ? 'Content de te revoir' : <Slogan />}
                </p>
              </>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-pink-400 flex-shrink-0" />
                  <p className="text-pink-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {info && (
              <p className="bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-lg p-3 text-sm text-fuchsia-100">{info}</p>
            )}
            {mode === 'forgot' && (
              <p className="text-sm text-purple-200/80">Entre l'email de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
            )}

            {mode === 'signup' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: normalizeUsername(e.target.value) })}
                    autoCapitalize="none"
                    autoCorrect="off"
                    maxLength={20}
                    className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Pseudo (ex. kenny.shake)"
                  />
                </div>
                <p className="-mt-1 px-1 text-[11px] text-purple-300/80">3 à 20 caractères : lettres, chiffres, point, tiret.</p>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Nom affiché (optionnel)"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                placeholder="Email"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                  placeholder="Mot de passe"
                  minLength={6}
                />
              </div>
            )}
            {mode === 'login' && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
                  className="text-xs text-purple-300/90 hover:text-white underline-offset-2 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'login' ? 'Connexion...' : mode === 'forgot' ? 'Envoi...' : 'Création...'}</>
              ) : (
                mode === 'login' ? 'Se connecter' : mode === 'forgot' ? 'Recevoir le lien' : "S'inscrire"
              )}
            </button>
            {mode === 'signup' && (
              <p className="text-[11px] text-center text-purple-300/80 leading-snug">
                En t'inscrivant, tu acceptes notre{' '}
                <a href="/confidentialite" target="_blank" rel="noopener" className="underline hover:text-purple-200">
                  politique de confidentialité
                </a>.
              </p>
            )}

            <div className="text-center pt-3 border-t border-purple-800/20">
              <p className="text-purple-300/85 text-sm">
                {mode === 'login' ? "Pas encore de compte ?" : mode === 'forgot' ? 'Tu t\'en souviens ?' : "Déjà un compte ?"}
                {' '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}
                  className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  {mode === 'login' ? "S'inscrire" : "Se connecter"}
                </button>
              </p>
            </div>
          </form>
        </motion.div>

      </div>
      </div>
    </div>
  );
}
