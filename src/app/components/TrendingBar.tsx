// TOP des shakes les plus likés (colonne de droite sur ordinateur, M7).
// Pochettes jouables (M2) : un clic lance l'extrait, jamais d'embed Spotify.
import { useState, useEffect } from 'react';
import { Flame, Heart, MessageCircle, Crown, Medal, Award, Music, Send } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { getTopPosts } from '../../lib/database';
import { SendSongDialog } from './SendSongDialog';
import { SongCover } from './SongCover';
import { openPost } from '../../lib/appNav';

export function TrendingBar({ limit = 10, onSeeAll }: { limit?: number; onSeeAll?: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendSongTrack, setSendSongTrack] = useState<any>(null);

  useEffect(() => {
    getTopPosts(limit)
      .then(setItems)
      .catch((err) => console.error('Error loading trending:', err))
      .finally(() => setLoading(false));
  }, [limit]);

  const rankBadge = (index: number) => {
    if (index === 0) return <Crown className="w-4 h-4 text-yellow-400" />;
    if (index === 1) return <Medal className="w-4 h-4 text-gray-300" />;
    if (index === 2) return <Award className="w-4 h-4 text-amber-600" />;
    return <span className="text-[11px] font-bold text-purple-300/70 w-4 text-center">{index + 1}</span>;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Flame className="w-4 h-4 text-pink-500" />
        <h2 className="text-sm font-bold text-white">TOP des shakes</h2>
        {onSeeAll && (
          <button onClick={onSeeAll} className="ml-auto text-[11px] text-purple-300/70 hover:text-white">Voir tout</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg bg-violet-950/40 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-4 text-center border border-purple-800/20">
          <Music className="w-6 h-6 text-purple-600 mx-auto mb-1" />
          <p className="text-xs text-purple-300/70">Pas encore de tendance</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((post, index) => (
            <div key={post.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-violet-900/20 group">
              <div className="w-4 flex justify-center flex-shrink-0">{rankBadge(index)}</div>
              <SongCover
                songKey={`trend-${post.id}`}
                title={post.track_name} artist={post.artist} cover={post.cover_url}
                previewUrl={post.preview_url} spotifyId={post.track_id} spotifyUrl={post.spotify_url}
                className="w-10 h-10" rounded="rounded-md" iconSize="sm"
              />
              {/* Toucher le titre ouvre le post complet (P2). */}
              <button onClick={() => openPost(post.id)} className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-white truncate hover:underline">{post.track_name}</p>
                <p className="text-[11px] text-purple-300/60 truncate">{post.artist}</p>
                <div className="flex items-center gap-2 text-[10px] text-purple-300/60">
                  <span className="flex items-center gap-0.5 text-pink-400/80"><Heart className="w-2.5 h-2.5" />{post.likes_count || 0}</span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{post.comments_count || 0}</span>
                </div>
              </button>
              <button
                onClick={() => setSendSongTrack({ id: post.track_id, title: post.track_name, artist: post.artist, coverUrl: post.cover_url, spotifyUrl: post.spotify_url })}
                aria-label="Envoyer à quelqu'un"
                className="p-1.5 rounded-full text-purple-300/60 hover:text-white hover:bg-violet-900/40 opacity-70 group-hover:opacity-100"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sendSongTrack && <SendSongDialog track={sendSongTrack} onClose={() => setSendSongTrack(null)} />}
      </AnimatePresence>
    </div>
  );
}
