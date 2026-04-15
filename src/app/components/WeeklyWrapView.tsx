import { useState, useEffect } from 'react';
import { BarChart3, Music, Users, Repeat2, TrendingUp, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { getCurrentUser, getUserPosts, getUserFollowing } from '../../lib/database';

interface Props { currentUser: any; }

export function WeeklyWrapView({ currentUser }: Props) {
  const [wrap, setWrap] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { generateWrap(); }, []);

  const generateWrap = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // My posts this week
      const { data: myPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', weekAgo.toISOString())
        .eq('is_reshake', false);

      // My reshakes this week
      const { data: myReshakes } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', weekAgo.toISOString())
        .eq('is_reshake', true);

      // Friends' posts this week
      const following = await getUserFollowing(user.id);
      const friendIds = following.map((f: any) => f.id);

      let mostActiveF = null;
      if (friendIds.length > 0) {
        const { data: friendPosts } = await supabase
          .from('posts')
          .select('user_id, user:users_profile!posts_user_id_fkey(username)')
          .in('user_id', friendIds)
          .gte('created_at', weekAgo.toISOString());

        // Count posts per friend
        const counts: Record<string, { count: number; username: string }> = {};
        (friendPosts || []).forEach((p: any) => {
          if (!counts[p.user_id]) counts[p.user_id] = { count: 0, username: p.user?.username || '?' };
          counts[p.user_id].count++;
        });
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
        if (sorted.length > 0) mostActiveF = sorted[0].username;
      }

      // Most reshaked track
      const { data: reshaked } = await supabase
        .from('posts')
        .select('track_name, artist, reshakes_count')
        .eq('user_id', user.id)
        .order('reshakes_count', { ascending: false })
        .limit(1);

      // Dominant genre/artist
      const artistCounts: Record<string, number> = {};
      (myPosts || []).forEach((p: any) => {
        const a = p.artist || 'Inconnu';
        artistCounts[a] = (artistCounts[a] || 0) + 1;
      });
      const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      setWrap({
        shakesCount: (myPosts || []).length,
        reshakesCount: (myReshakes || []).length,
        topArtist,
        mostActiveFriend: mostActiveF,
        mostReshakedTrack: reshaked?.[0]?.track_name || null,
      });
    } catch (err) {
      console.error('Error generating wrap:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
      <p className="text-purple-400/50">Calcul de ton résumé...</p>
    </div>
  );

  if (!wrap) return null;

  const stats = [
    { icon: Music, label: 'Shakes cette semaine', value: wrap.shakesCount, color: 'text-purple-400' },
    { icon: Repeat2, label: 'Reshakes', value: wrap.reshakesCount, color: 'text-fuchsia-400' },
    { icon: TrendingUp, label: 'Artiste dominant', value: wrap.topArtist || '-', color: 'text-pink-400' },
    { icon: Users, label: 'Ami le plus actif', value: wrap.mostActiveFriend ? `@${wrap.mostActiveFriend}` : '-', color: 'text-fuchsia-400' },
    { icon: BarChart3, label: 'Morceau le + reshaké', value: wrap.mostReshakedTrack || '-', color: 'text-pink-400' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Ton résumé de la semaine
        </h2>
        <p className="text-xs text-purple-400/50 mt-1">Les 7 derniers jours sur SHAKEmoi</p>
      </div>

      <div className="space-y-3">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-4 flex items-center gap-4"
          >
            <div className={`w-10 h-10 rounded-full bg-purple-900/40 flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-purple-400/60">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
