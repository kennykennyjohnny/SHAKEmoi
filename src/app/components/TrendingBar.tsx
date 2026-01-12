import { useState, useEffect } from 'react';
import { TrendingUp, Flame, Clock, Play, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import * as api from '../utils/api';

interface TrendingBarProps {
  onPlayTrack: (track: any) => void;
}

export function TrendingBar({ onPlayTrack }: TrendingBarProps) {
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      setLoading(true);
      const data = await api.getTrending();
      setTrending(data);
    } catch (err) {
      console.error('Error loading trending:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold">Tendances</h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-2" />
          <p className="text-sm text-gray-400">Chargement...</p>
        </div>
      ) : trending.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-6 text-center">
          <p className="text-gray-400 text-sm">Aucune tendance pour le moment</p>
          <p className="text-gray-500 text-xs mt-1">Commence à shaker des sons !</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trending.map((item, index) => (
            <motion.div
              key={item.track.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900 hover:bg-zinc-800 rounded-lg p-3 transition-colors group cursor-pointer"
              onClick={() => onPlayTrack(item.track)}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <span className="absolute -left-1 -top-1 w-5 h-5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <img
                    src={item.track.coverUrl}
                    alt={item.track.title}
                    className="w-12 h-12 rounded-md object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{item.track.title}</h4>
                  <p className="text-xs text-gray-400 truncate">{item.track.artist}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-purple-400 font-medium">
                      {item.count} shake{item.count > 1 ? 's' : ''}
                    </span>
                    {item.totalLikes > 0 && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-xs text-pink-400">
                          {item.totalLikes} ❤️
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Quick stats */}
      <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold">Activité récente</h3>
        </div>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Shakes aujourd'hui</span>
            <span className="text-white font-semibold">{trending.reduce((sum, t) => sum + t.count, 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tracks en tendance</span>
            <span className="text-white font-semibold">{trending.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
