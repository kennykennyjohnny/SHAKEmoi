import { useState, useEffect } from 'react';
import { Play, ExternalLink, Loader2, UserPlus, Pause, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { getPlatformUrl } from '../../lib/odesli';
import { Logo } from './Logo';

interface Props {
  postId: string;
  onJoin: () => void;
}

export function SharedPostView({ postId, onJoin }: Props) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => { loadPost(); }, [postId]);

  const loadPost = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select(`*, user:users_profile!posts_user_id_fkey(id, username, display_name, profile_album_cover_url)`)
        .eq('id', postId)
        .single();
      setPost(data);
    } catch {}
    setLoading(false);
  };

  if (loading) return (
    <div className="h-screen bg-[#0a0012] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );

  if (!post) return (
    <div className="h-screen bg-[#0a0012] flex items-center justify-center text-purple-300/50">
      Post introuvable
    </div>
  );

  const trackId = post.track_id || (post.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
  const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}?theme=0` : null;
  const userName = post.user?.display_name || post.user?.username || 'Quelqu\'un';
  const avatar = post.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${post.user?.username}&background=random`;

  const openPlatform = (platform: string) => {
    const url = getPlatformUrl({
      spotify_url: post.spotify_url,
      apple_music_url: post.apple_music_url,
      deezer_url: post.deezer_url,
      youtube_url: post.youtube_url,
      youtube_music_url: post.youtube_music_url,
      tidal_url: post.tidal_url,
      odesli_page_url: post.odesli_page_url,
    }, platform);
    if (url) window.open(url, '_blank');
  };

  const platforms = [
    { key: 'spotify', label: 'Spotify', color: 'from-green-500 to-green-600', icon: '🎵' },
    { key: 'apple_music', label: 'Apple Music', color: 'from-pink-500 to-pink-600', icon: '🎧' },
    { key: 'deezer', label: 'Deezer', color: 'from-purple-500 to-purple-600', icon: '💿' },
    { key: 'youtube_music', label: 'YouTube Music', color: 'from-red-500 to-orange-500', icon: '▶️' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0012] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background: blurred cover */}
      {post.cover_url && (
        <div className="absolute inset-0 pointer-events-none">
          <img src={post.cover_url} className="w-full h-full object-cover opacity-15 blur-3xl scale-110" alt="" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0012]/80 via-[#0a0012]/60 to-[#0a0012]" />
        </div>
      )}

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm relative z-10">
        {/* Branding */}
        <div className="flex justify-center mb-6">
          <Logo size="sm" animated={true} showText={true} />
        </div>

        {/* Sender badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-2.5 mb-5"
        >
          <img src={avatar} className="w-9 h-9 rounded-full object-cover border-2 border-fuchsia-500/30" alt="" />
          <p className="text-sm text-purple-300/80">
            <span className="font-bold text-white">@{post.user?.username}</span> t'a envoyé ce son
          </p>
        </motion.div>

        {/* Big album cover */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="relative mb-5 cursor-pointer group"
          onClick={() => setShowEmbed(!showEmbed)}
        >
          <img src={post.cover_url} className="w-full aspect-square rounded-2xl object-cover shadow-2xl shadow-fuchsia-500/20" alt="" />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity">
            {showEmbed ? (
              <Pause className="w-14 h-14 text-white fill-white drop-shadow-lg" />
            ) : (
              <Play className="w-14 h-14 text-white fill-white drop-shadow-lg" />
            )}
          </div>
        </motion.div>

        {/* Track info */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold truncate">{post.track_name}</h2>
          <p className="text-sm text-purple-300/60 truncate">{post.artist}</p>
          {post.text && (
            <p className="text-xs text-purple-200/50 mt-2 italic line-clamp-2">"{post.text}"</p>
          )}
        </div>

        {/* Embed */}
        <AnimatePresence>
          {showEmbed && embedUrl && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
              <iframe src={embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform buttons */}
        <div className="space-y-2 mb-5">
          {platforms.map(p => (
            <button key={p.key} onClick={() => openPlatform(p.key)}
              className={`w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r ${p.color} hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
            >
              <ExternalLink className="w-4 h-4" />
              Écouter sur {p.label}
            </button>
          ))}
        </div>

        {/* CTA Join */}
        <div className="text-center">
          <p className="text-xs text-purple-400/50 mb-2">Envie de répondre à @{post.user?.username} ?</p>
          <button onClick={onJoin} className="w-full py-3.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" />
            Rejoins SHAKEmoi gratuitement
          </button>
        </div>

        <p className="text-center text-[10px] text-purple-500/30 mt-6">shakemoi.fr</p>
      </motion.div>
    </div>
  );
}
