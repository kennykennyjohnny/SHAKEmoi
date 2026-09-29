import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Logo } from './Logo';
import { Slogan } from './Slogan';

// SHAKEMOI - Arrivée d'un visiteur sur un profil partagé (/u/<pseudo> ou
// l'invitation /i/<pseudo>) : on voit tout de suite qui invite, ses derniers
// sons, et on peut créer son compte pour l'ajouter en ami d'un geste.

interface Props {
  username: string;
  onSignUp: () => void;
  onLogin: () => void;
  onExplore: () => void;
}

export function ProfileLanding({ username, onSignUp, onLogin, onExplore }: Props) {
  const [profile, setProfile] = useState<any | null | undefined>(undefined);
  const [stats, setStats] = useState({ shakes: 0, followers: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from('users_profile')
        .select('id, username, display_name, bio, profile_album_cover_url')
        .eq('username', username)
        .maybeSingle();
      if (cancelled) return;
      setProfile(p ?? null);
      if (!p) return;
      const [shakes, followers, posts] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', p.id).is('circle_id', null).not('is_private', 'is', true),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', p.id),
        supabase.from('posts').select('id, cover_url, track_name, artist').eq('user_id', p.id).is('circle_id', null)
          .not('is_private', 'is', true).not('cover_url', 'is', null).order('created_at', { ascending: false }).limit(6),
      ]);
      if (cancelled) return;
      setStats({ shakes: shakes.count ?? 0, followers: followers.count ?? 0 });
      setRecent(posts.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [username]);

  if (profile === undefined) return (
    <div className="min-h-[100dvh] bg-[#1E1440] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );

  const name = profile?.display_name || profile?.username || username;
  const avatar = profile?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=2A1852&color=FFEFD5`;

  return (
    <div className="min-h-[100dvh] bg-[#1E1440] text-white relative overflow-x-hidden">
      {profile?.profile_album_cover_url && (
        <div className="fixed inset-0 pointer-events-none">
          <img src={profile.profile_album_cover_url} alt="" className="w-full h-full object-cover opacity-20 blur-3xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1E1440]/60 via-[#1E1440]/70 to-[#1E1440]" />
        </div>
      )}

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 max-w-md mx-auto">
        <Logo size="sm" animated={false} showText={true} />
        <button onClick={onLogin} className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap text-purple-100/90 hover:bg-white/10">
          Se connecter
        </button>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-auto px-5 pb-10 text-center"
      >
        {profile ? (
          <>
            <div className="mt-6 mx-auto w-28 h-28 rounded-full p-[3px] bg-gradient-to-br from-purple-500 to-pink-500">
              <img src={avatar} alt="" className="w-full h-full rounded-full object-cover border-4 border-[#1E1440]" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">{name}</h1>
            <p className="text-sm text-fuchsia-300">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm text-purple-100/75">{profile.bio}</p>}

            <div className="mt-4 flex justify-center gap-8">
              <div><p className="text-lg font-bold">{stats.shakes}</p><p className="text-[10px] uppercase tracking-wider text-purple-300/60">Shakes</p></div>
              <div><p className="text-lg font-bold">{stats.followers}</p><p className="text-[10px] uppercase tracking-wider text-purple-300/60">Abonnés</p></div>
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-400/20 p-4">
              <p className="text-base font-bold">{name} t'invite sur SHAKEmoi</p>
              <p className="text-sm text-purple-100/80 mt-1">
                Crée ton compte : <b className="text-white">@{profile.username}</b> sera ajouté à tes amis et tu verras ses sons.
              </p>
              <button
                onClick={onSignUp}
                className="mt-4 w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90"
              >
                <UserPlus className="w-4 h-4" /> Créer mon compte et ajouter @{profile.username}
              </button>
              <button onClick={onLogin} className="w-full mt-2 py-2 text-xs text-purple-200/80 hover:text-white">
                J'ai déjà un compte
              </button>
            </div>

            {recent.length > 0 && (
              <div className="mt-6 text-left">
                <p className="text-[11px] uppercase tracking-wider text-purple-300/60 font-semibold mb-2">Ses derniers sons</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {recent.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-purple-900/40">
                      <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 p-1.5 pt-5 bg-gradient-to-t from-black/80 to-transparent text-[10px] font-semibold truncate">
                        {p.track_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-16">
            <p className="text-purple-200/80">Ce profil n'existe pas (ou plus).</p>
            <button onClick={onSignUp} className="mt-4 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm">
              Créer mon compte
            </button>
          </div>
        )}

        <button
          onClick={onExplore}
          className="mt-4 w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> Découvrir sans compte
        </button>

        <p className="text-center text-[10px] text-purple-400/40 mt-8">shakemoi.fr · <Slogan /></p>
      </motion.main>
    </div>
  );
}
