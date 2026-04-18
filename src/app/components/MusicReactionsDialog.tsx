import { useState, useEffect } from 'react';
import { X, Search, Play, Loader2, Music, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getMusicReactions, addMusicReaction } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { getPlatformUrl } from '../../lib/odesli';

interface Props {
  postId: string;
  currentUser: any;
  onClose: () => void;
}

export function MusicReactionsDialog({ postId, currentUser, onClose }: Props) {
  const [reactions, setReactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);

  useEffect(() => { loadReactions(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await spotify.searchTracks(query)); } catch {}
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const loadReactions = async () => {
    setLoading(true);
    try { setReactions(await getMusicReactions(postId)); } catch {}
    setLoading(false);
  };

  const handleSend = async (track: any) => {
    setSending(true);
    try {
      const r = await addMusicReaction(postId, track, comment);
      if (r.success) { setSelectedTrack(null); setComment(''); setQuery(''); setResults([]); await loadReactions(); }
    } catch {}
    setSending(false);
  };

  const openInApp = (r: any) => {
    const url = getPlatformUrl({ spotify_url: r.spotify_url, apple_music_url: r.apple_music_url, deezer_url: r.deezer_url, youtube_url: r.youtube_url, youtube_music_url: r.youtube_music_url, tidal_url: r.tidal_url, odesli_page_url: r.odesli_page_url }, currentUser?.musicService || 'spotify');
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-md border border-purple-800/20 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-bold">Réactions musicales</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-purple-900/40 rounded-full"><X className="w-5 h-5 text-purple-300/60" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Existing reactions */}
          {loading ? <Loader2 className="w-5 h-5 text-purple-500 animate-spin mx-auto" /> :
            reactions.map(r => {
              const embedUrl = r.track_id ? `https://open.spotify.com/embed/track/${r.track_id}` : null;
              const isOpen = activeEmbedId === r.id;
              return (
                <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={r.user?.profile_album_cover_url || `https://ui-avatars.com/api/?name=${r.user?.username}&background=random`} className="w-6 h-6 rounded-full" alt="" />
                    <span className="text-xs font-medium">@{r.user?.username}</span>
                    {r.text && <span className="text-xs text-purple-300/60 ml-1">"{r.text}"</span>}
                  </div>
                  <div className="flex gap-2 items-center cursor-pointer group" onClick={() => setActiveEmbedId(isOpen ? null : r.id)}>
                    <img src={r.cover_url} className="w-10 h-10 rounded-md object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.track_name}</p>
                      <p className="text-xs text-purple-300/60 truncate">{r.artist}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); openInApp(r); }} className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                      <Play className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {isOpen && embedUrl && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                        <iframe src={`${embedUrl}?theme=0`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="rounded-xl" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          }

          {/* Add reaction */}
          <div className="border-t border-purple-800/20 pt-3">
            <p className="text-sm font-medium text-purple-200/80 mb-2">Réponds avec un son</p>
            {!selectedTrack ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Chercher un morceau..." className="w-full pl-9 pr-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500" />
                </div>
                {searching && <Loader2 className="w-4 h-4 text-purple-500 animate-spin mx-auto my-2" />}
                {results.slice(0, 5).map(t => (
                  <button key={t.id} onClick={() => setSelectedTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-purple-900/30 rounded-lg mt-1">
                    <img src={t.cover} className="w-9 h-9 rounded-md object-cover" alt="" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-purple-300/60 truncate">{t.artist}</p>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 items-center bg-purple-950/40 rounded-lg p-2 border border-pink-500/30">
                  <img src={selectedTrack.cover} className="w-10 h-10 rounded-md object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedTrack.name}</p>
                    <p className="text-xs text-purple-300/60 truncate">{selectedTrack.artist}</p>
                  </div>
                  <button onClick={() => setSelectedTrack(null)} className="text-purple-400/50 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (optionnel)" className="w-full px-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-pink-500" maxLength={200} />
                <button onClick={() => handleSend(selectedTrack)} disabled={sending} className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer la réaction</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
