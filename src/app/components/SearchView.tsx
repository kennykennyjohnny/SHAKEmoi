import { useState } from 'react';
import { Search as SearchIcon, TrendingUp, Clock, Play, User, Music } from 'lucide-react';
import { motion } from 'motion/react';

interface SearchViewProps {
  onPlayTrack: (track: any) => void;
}

export function SearchView({ onPlayTrack }: SearchViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'tracks' | 'artists' | 'users'>('all');

  const trendingTracks = [
    {
      id: '1',
      title: 'As It Was',
      artist: 'Harry Styles',
      shakes: '12.5K',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
      duration: '2:47'
    },
    {
      id: '2',
      title: 'Heat Waves',
      artist: 'Glass Animals',
      shakes: '9.8K',
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
      duration: '3:59'
    },
    {
      id: '3',
      title: 'Levitating',
      artist: 'Dua Lipa',
      shakes: '8.2K',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
      duration: '3:23'
    }
  ];

  const trendingArtists = [
    {
      id: '1',
      name: 'The Weeknd',
      followers: '89.5M',
      avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop'
    },
    {
      id: '2',
      name: 'Billie Eilish',
      followers: '67.3M',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop'
    }
  ];

  const recentSearches = [
    { id: '1', query: 'Drake', type: 'artist' },
    { id: '2', query: 'One Dance', type: 'track' },
    { id: '3', query: 'Rap français', type: 'genre' }
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Search Bar */}
      <div className="sticky top-0 z-30 bg-black pb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher sons, artistes, utilisateurs..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Tabs */}
        {searchQuery && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'tracks', label: 'Sons' },
              { id: 'artists', label: 'Artistes' },
              { id: 'users', label: 'Utilisateurs' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!searchQuery ? (
        <>
          {/* Trending Tracks */}
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-white">Tendances</h2>
            </div>
            
            <div className="space-y-2">
              {trendingTracks.map((track, index) => (
                <motion.button
                  key={track.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onPlayTrack(track)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-lg p-2.5 flex items-center gap-3 transition-colors border border-zinc-800 group"
                >
                  <span className="text-lg font-bold text-purple-500 w-6">{index + 1}</span>
                  <div className="relative">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-semibold text-sm text-white truncate">{track.title}</h3>
                    <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-purple-400">{track.shakes}</p>
                    <p className="text-xs text-gray-500">{track.duration}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Trending Artists */}
          <section className="mb-6">
            <h2 className="text-lg font-bold text-white mb-3">Artistes populaires</h2>
            <div className="grid grid-cols-2 gap-3">
              {trendingArtists.map((artist) => (
                <button
                  key={artist.id}
                  className="bg-zinc-900 hover:bg-zinc-800 rounded-lg p-3 flex flex-col items-center gap-2 transition-colors border border-zinc-800"
                >
                  <img
                    src={artist.avatar}
                    alt={artist.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <h3 className="font-semibold text-sm text-white">{artist.name}</h3>
                  <p className="text-xs text-gray-400">{artist.followers} abonnés</p>
                </button>
              ))}
            </div>
          </section>

          {/* Recent Searches */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-bold text-white">Récents</h2>
            </div>
            
            <div className="space-y-2">
              {recentSearches.map((search) => (
                <button
                  key={search.id}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-lg px-3 py-2.5 flex items-center justify-between transition-colors border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <SearchIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-white">{search.query}</span>
                  </div>
                  <span className="text-xs text-gray-500 uppercase">{search.type}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="text-center py-12">
          <SearchIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Recherche de "{searchQuery}"...</p>
          <p className="text-sm text-gray-500 mt-2">Intégration Spotify API à venir</p>
        </div>
      )}
    </div>
  );
}
