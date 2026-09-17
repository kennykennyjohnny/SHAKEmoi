import { useState, useEffect } from 'react';
import { Play, Pause, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getPlatformUrl } from '../../lib/odesli';
import { resolvePreviewUrl, playPreview, togglePreview, stopPreview, onPreviewChange, getPreviewState } from '../../lib/preview';
import {
  getSharedSong,
  incrementShareViews,
  getPreferredPlatform,
  setPreferredPlatform,
} from '../../lib/shares';
import { Logo } from './Logo';

interface Props {
  slug: string;
  onJoin: () => void;
  /** Si connecté, on propose de revenir dans l'app au lieu de s'inscrire. */
  currentUser?: any;
}

// Boutons plateformes (mêmes logos que SharedPostView, factorisés ici).
const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', color: 'from-green-500 to-green-600', logo: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
  ) },
  { key: 'apple_music', label: 'Apple Music', color: 'from-pink-500 to-pink-600', logo: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0019.7.243a10.16 10.16 0 00-1.564-.2C17.596.007 17.052 0 16.21 0h-8.42c-.842 0-1.386.007-1.926.044-.776.05-1.166.12-1.574.243a5.022 5.022 0 00-1.874.838C1.298 1.926.553 2.926.236 4.236A9.23 9.23 0 000 6.124C.007 6.664 0 7.208 0 8.05v7.9c0 .842.007 1.386.044 1.926.05.776.12 1.166.236 1.574.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 004.3 23.23c.52.098.96.166 1.574.2.54.036 1.084.044 1.926.044h8.42c.842 0 1.386-.008 1.926-.044.776-.05 1.166-.12 1.574-.236a5.022 5.022 0 001.874-.838c1.118-.734 1.863-1.734 2.18-3.043.117-.408.187-.798.236-1.574.037-.54.044-1.084.044-1.926v-7.9c.007-.842-.007-1.386-.06-1.79zM9.75 16.28a2.108 2.108 0 01-1.5.62 2.11 2.11 0 01-1.5-3.6 2.108 2.108 0 011.5-.62c.174 0 .345.02.51.06V7.68a.6.6 0 01.48-.588l5.4-1.09a.6.6 0 01.72.588v6.24a2.108 2.108 0 01-1.5 3.6 2.11 2.11 0 01-2.11-2.11c0-.83.48-1.548 1.18-1.892V9.06l-4.2.848v5.06c0 .49-.17.94-.46 1.31z"/></svg>
  ) },
  { key: 'deezer', label: 'Deezer', color: 'from-purple-500 to-purple-600', logo: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="0" y="18" width="4" height="4" rx="0.5"/><rect x="0" y="13" width="4" height="4" rx="0.5"/><rect x="5" y="18" width="4" height="4" rx="0.5"/><rect x="5" y="13" width="4" height="4" rx="0.5"/><rect x="5" y="8" width="4" height="4" rx="0.5"/><rect x="10" y="18" width="4" height="4" rx="0.5"/><rect x="10" y="13" width="4" height="4" rx="0.5"/><rect x="10" y="8" width="4" height="4" rx="0.5"/><rect x="10" y="3" width="4" height="4" rx="0.5"/><rect x="15" y="18" width="4" height="4" rx="0.5"/><rect x="15" y="13" width="4" height="4" rx="0.5"/><rect x="15" y="8" width="4" height="4" rx="0.5"/><rect x="20" y="18" width="4" height="4" rx="0.5"/><rect x="20" y="13" width="4" height="4" rx="0.5"/><rect x="20" y="8" width="4" height="4" rx="0.5"/><rect x="20" y="3" width="4" height="4" rx="0.5"/></svg>
  ) },
  { key: 'youtube_music', label: 'YouTube Music', color: 'from-red-500 to-orange-500', logo: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/></svg>
  ) },
];

export function SongSharePage({ slug, onJoin, currentUser }: Props) {
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preferred, setPreferred] = useState<string | null>(null);

  useEffect(() => {
    setPreferred(getPreferredPlatform());
    let cancelled = false;
    (async () => {
      const res = await getSharedSong(slug);
      if (cancelled) return;
      setSong(res?.song ?? null);
      setLoading(false);
      incrementShareViews(slug);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Même lecteur que le reste de l'app : l'extrait vient du preview stocké ou,
  // à défaut, d'iTunes — donc ça marche aussi pour les sons non-Spotify.
  const previewKey = `share-${slug}`;
  const [preview, setPreview] = useState(getPreviewState());
  useEffect(() => onPreviewChange(() => setPreview(getPreviewState())), []);
  useEffect(() => () => stopPreview(), []);
  const playing = preview.key === previewKey && preview.playing;

  useEffect(() => {
    if (!song) return;
    let cancelled = false;
    resolvePreviewUrl(song.track_name, song.artist || '', song.preview_url).then(url => {
      if (!cancelled && url) playPreview(previewKey, url);
    });
    return () => { cancelled = true; };
  }, [song]);

  const togglePlay = async () => {
    if (getPreviewState().key === previewKey) { togglePreview(previewKey); return; }
    const url = await resolvePreviewUrl(song.track_name, song.artist || '', song.preview_url);
    if (url) playPreview(previewKey, url);
  };

  const openPlatform = (platform: string) => {
    setPreferredPlatform(platform);
    setPreferred(platform);
    const url = getPlatformUrl({
      spotify_url: song.spotify_url,
      apple_music_url: song.apple_music_url,
      deezer_url: song.deezer_url,
      youtube_url: song.youtube_url,
      youtube_music_url: song.youtube_music_url,
      tidal_url: song.tidal_url,
      odesli_page_url: song.odesli_page_url,
    }, platform);
    if (url) window.open(url, '_blank');
  };

  if (loading) return (
    <div className="h-screen bg-[#1E1440] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  );

  if (!song) return (
    <div className="min-h-screen bg-[#1E1440] flex flex-col items-center justify-center gap-4 text-center p-6">
      <Logo size="sm" animated={false} showText={true} />
      <p className="text-purple-300/60">Ce son n'existe plus ou le lien est invalide.</p>
      <button onClick={onJoin} className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold text-sm">
        Découvrir SHAKEmoi
      </button>
    </div>
  );

  // On met en avant la plateforme préférée du visiteur (one-tap au lien suivant).
  const ordered = [...PLATFORMS].sort((a, b) =>
    (b.key === preferred ? 1 : 0) - (a.key === preferred ? 1 : 0)
  );

  return (
    <div className="min-h-screen bg-[#1E1440] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {song.cover_url && (
        <div className="absolute inset-0 pointer-events-none">
          <img src={song.cover_url} className="w-full h-full object-cover opacity-15 blur-3xl scale-110" alt="" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1E1440]/80 via-[#1E1440]/60 to-[#1E1440]" />
        </div>
      )}


      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm relative z-10">
        <div className="flex justify-center mb-6">
          <Logo size="sm" animated={true} showText={true} />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="text-center text-sm text-purple-300/80 mb-5"
        >
          On t'a envoyé <span className="font-bold text-white">ce son</span> 🎧
        </motion.p>

        {/* Pochette cliquable = play/pause de l'extrait */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}
          className="relative mb-5 cursor-pointer group w-64 mx-auto"
          onClick={togglePlay}
        >
          <img src={song.cover_url} className="w-64 aspect-square rounded-2xl object-cover shadow-2xl shadow-fuchsia-500/20" alt="" />
          <div className={`absolute inset-0 bg-black/30 flex items-center justify-center rounded-2xl transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
            {playing ? (
              <Pause className="w-14 h-14 text-white fill-white drop-shadow-lg" />
            ) : (
              <Play className="w-14 h-14 text-white fill-white drop-shadow-lg" />
            )}
          </div>
          {playing && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-4">
              {[0,1,2,3].map(i => (
                <motion.span key={i} className="w-1 bg-fuchsia-400 rounded-full"
                  animate={{ height: ['30%','100%','40%','80%','30%'] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }} />
              ))}
            </div>
          )}
        </motion.div>

        <div className="text-center mb-5">
          <h2 className="text-xl font-bold truncate">{song.track_name}</h2>
          <p className="text-sm text-purple-300/60 truncate">{song.artist}</p>
        </div>

        <div className="space-y-2 mb-5">
          {ordered.map(p => {
            const isPref = p.key === preferred;
            return (
              <button key={p.key} onClick={() => openPlatform(p.key)}
                className={`w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r ${p.color} hover:opacity-90 transition-opacity flex items-center justify-center gap-2 relative ${isPref ? 'ring-2 ring-white/70' : ''}`}
              >
                {p.logo}
                Écouter sur {p.label}
                {isPref && <span className="absolute right-3 text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded-full">Ta plateforme</span>}
              </button>
            );
          })}
        </div>

        {/* Mur re-shake = inscription (capture l'intention) */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <p className="text-sm text-purple-200/80 mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            {currentUser ? 'Envie de le shaker à ton tour ?' : 'Tu kiffes ? Re-shake-le à tes potes'}
          </p>
          {currentUser ? (
            <button onClick={onJoin} className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 text-sm">
              Continuer sur SHAKEmoi
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={onJoin} className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl font-bold hover:opacity-90 text-sm">
                Inscription
              </button>
              <button onClick={onJoin} className="flex-1 py-3 bg-purple-950/60 border border-purple-700/40 rounded-xl font-bold hover:bg-purple-900/50 transition-colors text-sm">
                Connexion
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-purple-500/30 mt-6">shakemoi.fr</p>
      </motion.div>
    </div>
  );
}
