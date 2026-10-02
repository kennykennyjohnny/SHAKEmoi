// Fenêtres de compte : terminer une inscription restée sans profil (G4) et
// choisir un nouveau mot de passe après le lien « mot de passe oublié » (G1).
import { useState } from 'react';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { normalizeUsername, usernameError } from '../../lib/username';
import { Logo } from './Logo';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] bg-[#1E1440] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1D0F3D] rounded-2xl border border-purple-800/30 p-5 text-white">
          <div className="flex justify-center mb-3"><Logo size="sm" animated={false} /></div>
          <h1 className="text-lg font-bold text-center">{title}</h1>
          <p className="text-sm text-purple-300/90 text-center mt-1 mb-4">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Compte créé mais profil absent (inscription interrompue) : on choisit son pseudo. */
export function FinishProfileDialog({ userId, onDone }: { userId: string; onDone: (profile: any) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = normalizeUsername(username);
    const ruleError = usernameError(u);
    if (ruleError) { setError(ruleError); return; }
    setLoading(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('users_profile')
      .insert([{ id: userId, username: u, display_name: displayName.trim() || u, color: '#B4A7D6', feels_count: 0, feelings_count: 0 }])
      .select('*')
      .single();
    setLoading(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'Ce pseudo est déjà pris.' : friendlyError(insertError));
      return;
    }
    onDone(data);
  };

  return (
    <Shell title="Plus qu'une étape" subtitle="Ton compte existe : choisis ton pseudo pour commencer.">
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
          <input
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            autoCapitalize="none" autoCorrect="off" maxLength={20} required
            placeholder="Pseudo (ex. kenny.shake)"
            className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nom affiché (optionnel)"
          className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        {error && <p className="text-sm text-pink-400">{error}</p>}
        <button disabled={loading} className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'C\'est parti'}
        </button>
      </form>
    </Shell>
  );
}

/** Retour du lien « mot de passe oublié » : choisir un nouveau mot de passe. */
export function ResetPasswordDialog({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('6 caractères minimum.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne sont pas identiques.'); return; }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(friendlyError(updateError)); return; }
    setOk(true);
    setTimeout(onDone, 1500);
  };

  return (
    <Shell title="Nouveau mot de passe" subtitle="Choisis-en un que tu n'as pas déjà utilisé.">
      {ok ? (
        <p className="text-center text-fuchsia-300 font-semibold">Mot de passe changé ✓</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {[{ v: password, set: setPassword, ph: 'Nouveau mot de passe' }, { v: confirm, set: setConfirm, ph: 'Confirme-le' }].map((f) => (
            <div key={f.ph} className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
              <input
                type="password" required minLength={6} autoComplete="new-password"
                value={f.v} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          ))}
          {error && <p className="text-sm text-pink-400">{error}</p>}
          <button disabled={loading} className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
          </button>
        </form>
      )}
    </Shell>
  );
}
