import { useState } from 'react';
import { Search as SearchIcon, Music, UserPlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { SearchView } from './SearchView';

interface ShakeTabsDialogProps {
  onClose: () => void;
}

export function ShakeTabsDialog({ onClose }: ShakeTabsDialogProps) {
  const [activeTab, setActiveTab] = useState<'song' | 'friend'>('song');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header avec tabs */}
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Shake</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('song')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'song'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-zinc-800 text-gray-400 hover:text-white'
              }`}
            >
              <Music className="w-5 h-5" />
              Shake un son
            </button>
            <button
              onClick={() => setActiveTab('friend')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'friend'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-zinc-800 text-gray-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              Shake un ami
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'song' ? (
            <div className="p-4">
              <p className="text-gray-400 text-center py-8">
                Fonctionnalité "Shake un son" à venir
              </p>
            </div>
          ) : (
            <div className="h-full">
              <SearchView onPlayTrack={() => {}} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
