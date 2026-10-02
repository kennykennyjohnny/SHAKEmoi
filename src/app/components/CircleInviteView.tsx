import { useState, useEffect } from 'react';
import { Users, Loader2, UserPlus, Music, Sparkles, Disc3 } from 'lucide-react';
import { motion } from 'motion/react';
import { getCircleMembers, getCircleFeed, joinCircleByCode } from '../../lib/database';
import { isLegacyCircleLink } from '../../lib/links';
import { supabase } from '../../lib/supabase';
import { Logo } from './Logo';
import { Slogan } from './Slogan';

import { defaultAvatar, avatarThumb } from '../../lib/media';
interface Props {
  /** Code d'invitation du lien /c/<code> (ou un ancien id : lien expiré, P31). */
  code: string;
  currentUser: any | null;
  onJoin: (circleId?: string) => void;
  onSignUp: () => void;
}

export function CircleInviteView({ code, currentUser, onJoin, onSignUp }: Props) {
  const [circle, setCircle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  // Ancien lien avec l'id du cercle, ou code remplacé par un nouveau lien.
  const [expired, setExpired] = useState(isLegacyCircleLink(code));

  useEffect(() => {
    loadCircle();
  }, [code, currentUser?.id]);

  const loadCircle = async () => {
    if (isLegacyCircleLink(code)) { setExpired(true); setLoading(false); return; }
    try {
      // Aperçu par le code (nom, photo, nombre de membres), lisible sans compte.
      const { data } = await supabase.rpc('get_circle_invite', { p_code: code });
      const preview = Array.isArray(data) ? data[0] : data;
      if (!preview?.id) { setExpired(true); setLoading(false); return; }
      setCircle({ id: preview.id, name: preview.name, photo_url: preview.photo_url });
      setMemberCount(Number(preview.member_count) || 0);
      setIsMember(!!preview.is_member);
      // Membres et derniers sons : seulement lisibles par les membres.
      if (preview.is_member) {
        const [membersData, feedData] = await Promise.all([getCircleMembers(preview.id), getCircleFeed(preview.id, 6)]);
        setMembers(membersData || []);
        setRecentTracks((feedData || []).filter((p: any) => p.cover_url).slice(0, 4));
      }
    } catch {}
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!currentUser) {
      onSignUp();
      return;
    }
    setJoining(true);
    setError('');
    try {
      const result = await joinCircleByCode(code);
      if (result.success) {
        setJoined(true);
        setTimeout(() => {
          onJoin(result.circleId);
        }, 1500);
      } else {
        setError(result.error || 'Erreur lors de la jonction');
      }
    } catch {
      setError('Erreur réseau');
    }
    setJoining(false);
  };

  if (loading) return (
    <div className="h-[100dvh] bg-[#1E1440] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
    </div>
  );

  if (expired || !circle) return (
    <div className="h-[100dvh] bg-[#1E1440] flex flex-col items-center justify-center gap-4 p-4">
      <Users className="w-10 h-10 text-purple-400/60" />
      <p className="text-white font-semibold text-center">Ce lien n'est plus valide</p>
      <p className="text-purple-300/70 text-sm text-center max-w-xs">Demande un nouveau lien à un membre du cercle.</p>
      <button onClick={() => { onJoin(); }} className="px-5 py-2.5 bg-purple-600/30 rounded-full text-sm text-purple-300 hover:bg-purple-600/40 transition-colors">
        Retour à l'accueil
      </button>
    </div>
  );

  const alreadyMember = !!currentUser && isMember;
  const creator = members.find((m: any) => m.id === circle.created_by);

  return (
    <div className="min-h-[100dvh] bg-[#1E1440] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Branding */}
        <div className="flex justify-center mb-6">
          <Logo size="sm" animated={true} showText={true} href="/" />
        </div>

        {/* Recent track covers mosaic */}
        {recentTracks.length >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-4 gap-1.5 mb-5 px-4"
          >
            {recentTracks.slice(0, 4).map((t: any, i: number) => (
              <motion.img
                key={i}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2 + i * 0.08, type: 'spring' }}
                src={t.cover_url}
                className="w-full aspect-square rounded-lg object-cover shadow-lg shadow-fuchsia-500/10"
                alt=""
              />
            ))}
          </motion.div>
        )}

        {/* Circle card */}
        <div className="bg-violet-950/40 rounded-2xl border border-fuchsia-500/20 overflow-hidden backdrop-blur-sm">
          {/* Circle icon + name */}
          <div className="p-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 rounded-2xl flex items-center justify-center border border-fuchsia-500/20"
            >
              {circle.photo_url
                ? <img src={avatarThumb(circle.photo_url, 160) || circle.photo_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                : <Users className="w-10 h-10 text-fuchsia-400" />}
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-1">{circle.name}</h2>
            {creator && (
              <p className="text-sm text-purple-300/60">
                Créé par <span className="text-fuchsia-400 font-medium">@{creator.username}</span>
              </p>
            )}
            {!creator && <p className="text-sm text-purple-300/60">Cercle privé</p>}
          </div>

          {/* Members preview */}
          {members.length > 0 && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-center -space-x-2">
                {members.slice(0, 5).map((m: any, i: number) => (
                  <motion.img
                    key={m.id}
                    initial={{ scale: 0, x: -20 }}
                    animate={{ scale: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    src={avatarThumb(m.profile_album_cover_url) || defaultAvatar(m.username)}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#1E1440]"
                    alt={m.username}
                  />
                ))}
                {members.length > 5 && (
                  <div className="w-10 h-10 rounded-full bg-violet-900/50 border-2 border-[#1E1440] flex items-center justify-center text-xs font-bold text-purple-300">
                    +{members.length - 5}
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-purple-300/60 mt-2">
                {members.length} membre{members.length > 1 ? 's' : ''} actif{members.length > 1 ? 's' : ''}
                {members.length <= 3 && (
                  <> · {members.map((m: any) => m.display_name || m.username).join(', ')}</>
                )}
              </p>
            </div>
          )}
          {members.length === 0 && memberCount > 0 && (
            <p className="px-6 pb-4 text-center text-xs text-purple-300/60">
              {memberCount} membre{memberCount > 1 ? 's' : ''} actif{memberCount > 1 ? 's' : ''}
            </p>
          )}

          {/* Recent tracks teaser */}
          {recentTracks.length > 0 && recentTracks.length < 4 && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 text-purple-300/60 text-xs mb-2">
                <Disc3 className="w-3 h-3" />
                Derniers sons partagés
              </div>
              <div className="space-y-1.5">
                {recentTracks.slice(0, 3).map((t: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-2.5"
                  >
                    <img loading="lazy" src={t.cover_url} className="w-8 h-8 rounded object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{t.track_name}</p>
                      <p className="text-[10px] text-purple-300/60 truncate">{t.artist}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="p-6 pt-2 space-y-3">
            {joined ? (
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-3">
                <Sparkles className="w-8 h-8 text-fuchsia-400 mx-auto mb-2" />
                <p className="font-bold text-fuchsia-400">Bienvenue dans le cercle !</p>
                <p className="text-xs text-purple-300/60 mt-1">Redirection en cours...</p>
              </motion.div>
            ) : alreadyMember ? (
              <button
                onClick={() => { onJoin(circle.id); }}
                className="w-full py-3.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Music className="w-4 h-4" />
                Ouvrir le cercle
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {joining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {currentUser ? 'Rejoindre le cercle' : 'Rejoindre SHAKEmoi'}
              </button>
            )}
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          </div>
        </div>

        {/* Selling points for non-authenticated */}
        {!currentUser && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 space-y-2"
          >
            {[
              'Partage tes sons du moment avec tes potes',
              'Découvre les goûts de ton entourage',
              'Crée des cercles privés pour vos sessions',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-purple-300/60 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500/60" />
                {text}
              </div>
            ))}
          </motion.div>
        )}

        <p className="text-center text-[10px] text-purple-500/30 mt-8">shakemoi.fr · <Slogan /></p>
      </motion.div>
    </div>
  );
}
