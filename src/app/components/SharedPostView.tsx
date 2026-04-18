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
    { key: 'spotify', label: 'Spotify', color: 'from-green-500 to-green-600', logo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
    ) },
    { key: 'apple_music', label: 'Apple Music', color: 'from-pink-500 to-pink-600', logo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.243a10.16 10.16 0 00-1.564-.2C17.596.007 17.052 0 16.21 0h-8.42c-.842 0-1.386.007-1.926.044-.776.05-1.166.12-1.574.243a5.022 5.022 0 00-1.874.838C1.298 1.926.553 2.926.236 4.236A9.23 9.23 0 000 6.124C.007 6.664 0 7.208 0 8.05v7.9c0 .842.007 1.386.044 1.926.05.776.12 1.166.236 1.574.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.23c.52.098.96.166 1.574.2.54.036 1.084.044 1.926.044h8.42c.842 0 1.386-.008 1.926-.044.776-.05 1.166-.12 1.574-.236a5.022 5.022 0 001.874-.838c1.118-.734 1.863-1.734 2.18-3.043.117-.408.187-.798.236-1.574.037-.54.044-1.084.044-1.926v-7.9c.007-.842-.007-1.386-.06-1.79zM17.06 12.12l-.01 5.022c0 .56-.045.948-.148 1.297-.196.672-.637 1.147-1.277 1.377-.362.13-.748.176-1.138.176-.832 0-1.532-.353-1.98-.938-.45-.585-.574-1.322-.348-2.07.23-.757.81-1.265 1.574-1.508.404-.128.82-.176 1.24-.246.395-.066.788-.148 1.11-.363.19-.127.303-.33.32-.584V9.86c0-.347-.076-.607-.363-.696-.19-.06-.39-.036-.587 0l-4.678 1.046c-.098.02-.195.046-.293.076-.234.07-.35.24-.365.487-.01.16-.004.317-.004.477v6.423c0 .354-.004.708-.056 1.058a2.245 2.245 0 01-.395.95c-.285.39-.658.66-1.108.808-.346.114-.706.16-1.072.178-.79.038-1.486-.178-2.05-.71-.535-.504-.76-1.125-.653-1.858.09-.6.404-1.08.886-1.425.382-.272.81-.413 1.263-.488.418-.07.838-.108 1.237-.235.263-.084.49-.22.604-.49.077-.176.108-.355.108-.544V6.66c0-.41.05-.788.328-1.115.246-.292.56-.448.92-.536.18-.044.363-.07.547-.104l5.497-1.22c.23-.05.46-.106.696-.126.42-.036.772.093.994.48.106.185.145.395.145.613l.01 7.47z"/></svg>
    ) },
    { key: 'deezer', label: 'Deezer', color: 'from-purple-500 to-purple-600', logo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="0" y="18" width="4" height="4" rx="0.5"/><rect x="0" y="13" width="4" height="4" rx="0.5"/><rect x="5" y="18" width="4" height="4" rx="0.5"/><rect x="5" y="13" width="4" height="4" rx="0.5"/><rect x="5" y="8" width="4" height="4" rx="0.5"/><rect x="10" y="18" width="4" height="4" rx="0.5"/><rect x="10" y="13" width="4" height="4" rx="0.5"/><rect x="10" y="8" width="4" height="4" rx="0.5"/><rect x="10" y="3" width="4" height="4" rx="0.5"/><rect x="15" y="18" width="4" height="4" rx="0.5"/><rect x="15" y="13" width="4" height="4" rx="0.5"/><rect x="15" y="8" width="4" height="4" rx="0.5"/><rect x="20" y="18" width="4" height="4" rx="0.5"/><rect x="20" y="13" width="4" height="4" rx="0.5"/><rect x="20" y="8" width="4" height="4" rx="0.5"/><rect x="20" y="3" width="4" height="4" rx="0.5"/></svg>
    ) },
    { key: 'youtube_music', label: 'YouTube Music', color: 'from-red-500 to-orange-500', logo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/></svg>
    ) },
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
          <img src={post.cover_url} className="w-64 aspect-square mx-auto rounded-2xl object-cover shadow-2xl shadow-fuchsia-500/20" alt="" />
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
              {p.logo}
              Écouter sur {p.label}
            </button>
          ))}
        </div>

        {/* CTA Join */}
        <div className="text-center">
          <p className="text-xs text-purple-400/50 mb-3">Envie de répondre à @{post.user?.username} ?</p>
          <div className="flex gap-3">
            <button onClick={onJoin} className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 text-sm">
              Inscription
            </button>
            <button onClick={onJoin} className="flex-1 py-3 bg-purple-950/60 border border-purple-700/40 rounded-xl font-bold hover:bg-purple-900/50 transition-colors text-sm">
              Connexion
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-purple-500/30 mt-6">shakemoi.fr</p>
      </motion.div>
    </div>
  );
}
