import { useState, useEffect } from 'react';
import { Users, Loader2, UserPlus, Music, Sparkles, Disc3 } from 'lucide-react';
import { motion } from 'motion/react';
import { getCircleById, getCircleMembers, getCircleFeed, joinCircle } from '../../lib/database';
import { Logo } from './Logo';

interface Props {
  circleId: string;
  currentUser: any | null;
  onJoin: () => void;
  onSignUp: () => void;
}

export function CircleInviteView({ circleId, currentUser, onJoin, onSignUp }: Props) {
  const [circle, setCircle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCircle();
  }, [circleId]);

  const loadCircle = async () => {
    try {
      const [circleData, membersData, feedData] = await Promise.all([
        getCircleById(circleId),
        getCircleMembers(circleId),
        getCircleFeed(circleId, 6),
      ]);
      setCircle(circleData);
      setMembers(membersData || []);
      // Get unique tracks with covers
      const tracks = (feedData || []).filter((p: any) => p.cover_url).slice(0, 4);
      setRecentTracks(tracks);
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
      const result = await joinCircle(circleId);
      if (result.success) {
        setJoined(true);
        setTimeout(() => {
          window.location.hash = '';
          onJoin();
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
    <div className="h-screen bg-[#14092A] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
    </div>
  );

  if (!circle) return (
    <div className="h-screen bg-[#14092A] flex flex-col items-center justify-center gap-4 p-4">
      <p className="text-purple-300/50 text-center">Ce cercle n'existe pas ou a été supprimé</p>
      <button onClick={() => { window.location.hash = ''; onJoin(); }} className="px-5 py-2.5 bg-purple-600/30 rounded-full text-sm text-purple-300 hover:bg-purple-600/40 transition-colors">
        Retour à l'accueil
      </button>
    </div>
  );

  const alreadyMember = currentUser && members.some((m: any) => m.id === currentUser.id);
  const creator = members.find((m: any) => m.id === circle.created_by);

  return (
    <div className="min-h-screen bg-[#14092A] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
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
          <Logo size="sm" animated={true} showText={true} />
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
              <Users className="w-10 h-10 text-fuchsia-400" />
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
                    src={m.profile_album_cover_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#14092A]"
                    alt={m.username}
                  />
                ))}
                {members.length > 5 && (
                  <div className="w-10 h-10 rounded-full bg-violet-900/50 border-2 border-[#14092A] flex items-center justify-center text-xs font-bold text-purple-300">
                    +{members.length - 5}
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-purple-300/50 mt-2">
                {members.length} membre{members.length > 1 ? 's' : ''} actif{members.length > 1 ? 's' : ''}
                {members.length <= 3 && (
                  <> · {members.map((m: any) => m.display_name || m.username).join(', ')}</>
                )}
              </p>
            </div>
          )}

          {/* Recent tracks teaser */}
          {recentTracks.length > 0 && recentTracks.length < 4 && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 text-purple-300/40 text-xs mb-2">
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
                    <img src={t.cover_url} className="w-8 h-8 rounded object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{t.track_name}</p>
                      <p className="text-[10px] text-purple-300/40 truncate">{t.artist}</p>
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
                <p className="text-xs text-purple-300/50 mt-1">Redirection en cours...</p>
              </motion.div>
            ) : alreadyMember ? (
              <button
                onClick={() => { window.location.hash = ''; onJoin(); }}
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

        <p className="text-center text-[10px] text-purple-500/30 mt-8">shakemoi.fr</p>
      </motion.div>
    </div>
  );
}
