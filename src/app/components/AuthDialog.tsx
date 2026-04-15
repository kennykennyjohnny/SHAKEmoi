import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music2, Mail, Lock, User as UserIcon, Loader2, AlertCircle, Music } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthDialogProps {
  onComplete: (user: any) => void;
}

export function AuthDialog({ onComplete }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        console.log('[AUTH] Signup attempt:', { email: formData.email, username: formData.username });

        const { data: existingUser } = await supabase
          .from('users_profile')
          .select('username')
          .eq('username', formData.username)
          .single();

        if (existingUser) {
          throw new Error('Ce nom d\'utilisateur est déjà pris');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Erreur lors de la création du compte');

        const { error: profileError } = await supabase
          .from('users_profile')
          .insert([{
            id: authData.user.id,
            username: formData.username,
            display_name: formData.displayName || formData.username,
            email: formData.email,
            color: '#B4A7D6',
            feels_count: 0,
            feelings_count: 0
          }]);

        if (profileError) throw new Error('Erreur lors de la création du profil');

        const { data: profile } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        onComplete(profile);
      } else {
        console.log('[AUTH] Login attempt:', { email: formData.email });

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
          .single();

        onComplete(profile);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0012] z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f0020] rounded-2xl border border-purple-800/30 overflow-hidden shadow-2xl shadow-purple-900/20"
        >
          {/* Header - text based, no Logo */}
          <div className="p-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="mb-3 flex justify-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Music className="w-7 h-7 text-white" />
              </div>
            </motion.div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent" style={{ fontFamily: "'Maven Pro', sans-serif" }}>
              SHAKEmoi
            </h1>
            <p className="text-purple-300/50 text-sm mt-1">
              {mode === 'login' ? 'Content de te revoir' : 'Partage tes sons préférés'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-pink-400 flex-shrink-0" />
                  <p className="text-pink-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'signup' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Nom d'utilisateur"
                  />
                </div>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                    placeholder="Nom affiché (optionnel)"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                placeholder="Email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                placeholder="Mot de passe"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'login' ? 'Connexion...' : 'Création...'}</>
              ) : (
                mode === 'login' ? 'Se connecter' : "S'inscrire"
              )}
            </button>

            <div className="text-center pt-3 border-t border-purple-800/20">
              <p className="text-purple-300/50 text-sm">
                {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
                {' '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                  className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  {mode === 'login' ? "S'inscrire" : "Se connecter"}
                </button>
              </p>
            </div>
          </form>
        </motion.div>

        <p className="text-center text-purple-400/30 text-xs mt-4">
          En continuant, tu acceptes nos conditions d'utilisation
        </p>
      </div>
    </div>
  );
}
