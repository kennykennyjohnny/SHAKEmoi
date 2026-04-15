import { useState, useEffect } from 'react';
import { Play, ExternalLink, Loader2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { getPlatformUrl } from '../../lib/odesli';

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
    { key: 'spotify', label: 'Spotify', color: 'from-green-500 to-green-600' },
    { key: 'apple_music', label: 'Apple Music', color: 'from-pink-500 to-pink-600' },
    { key: 'deezer', label: 'Deezer', color: 'from-purple-500 to-purple-600' },
    { key: 'youtube_music', label: 'YouTube Music', color: 'from-pink-600 to-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0012] text-white flex flex-col items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
        {/* Branding */}
        <p className="text-center mb-6">
          <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">SHAKEmoi</span>
        </p>

        {/* Sender badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
          <p className="text-sm text-purple-300/80">
            <span className="font-semibold text-white">@{post.user?.username}</span> t'a envoyé ce son
          </p>
        </div>

        {/* Track card */}
        <div className="bg-purple-950/40 rounded-2xl border border-purple-800/30 overflow-hidden">
          <div className="p-4 flex gap-4 items-center cursor-pointer group" onClick={() => setShowEmbed(!showEmbed)}>
            <div className="relative flex-shrink-0">
              <img src={post.cover_url} className="w-20 h-20 rounded-xl object-cover shadow-lg" alt="" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{post.track_name}</h2>
              <p className="text-sm text-purple-300/60 truncate">{post.artist}</p>
              {post.text && <p className="text-xs text-purple-200/70 mt-2 line-clamp-2">"{post.text}"</p>}
            </div>
          </div>

          {/* Embed */}
          <AnimatePresence>
            {showEmbed && embedUrl && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4">
                  <iframe src={embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Platform buttons */}
        <div className="mt-4 space-y-2">
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
        <div className="mt-6 text-center">
          <p className="text-xs text-purple-400/50 mb-2">Envie de répondre à @{post.user?.username} ?</p>
          <button onClick={onJoin} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold hover:opacity-90 flex items-center justify-center gap-2 mx-auto">
            <UserPlus className="w-4 h-4" />
            Rejoins SHAKEmoi
          </button>
        </div>

        <p className="text-center text-[10px] text-purple-500/30 mt-6">shakemoi.fr</p>
      </motion.div>
    </div>
  );
}
