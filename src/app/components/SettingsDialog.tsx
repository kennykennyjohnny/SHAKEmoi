import { X, Music2, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface SettingsDialogProps {
  currentUser: any;
  onClose: () => void;
  onSave: (settings: { musicService: 'spotify' | 'apple' | 'deezer' }) => void;
  onLogout?: () => void;
}

export function SettingsDialog({ currentUser, onClose, onSave, onLogout }: SettingsDialogProps) {
  const [musicService, setMusicService] = useState<'spotify' | 'apple' | 'deezer'>(
    currentUser?.musicService || 'spotify'
  );

  const handleSave = () => {
    onSave({ musicService });
    onClose();
  };

  const handleLogout = async () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      try {
        // Logout Supabase
        const { supabase } = await import('../../lib/supabase');
        await supabase.auth.signOut();
        
        // Clear local storage
        localStorage.removeItem('shakemoi_auth_token');
        localStorage.removeItem('shakemoi_user');
        localStorage.removeItem('shakemoi_onboarding');
        
        if (onLogout) {
          onLogout();
        } else {
          // Redirect to home
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Paramètres</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Music Service Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Music2 className="w-4 h-4 inline mr-2" />
              Service de musique
            </label>
            <div className="space-y-2">
              {[
                { id: 'spotify', name: 'Spotify', color: 'from-green-600 to-green-500' },
                { id: 'apple', name: 'Apple Music', color: 'from-pink-600 to-red-500' },
                { id: 'deezer', name: 'Deezer', color: 'from-orange-600 to-orange-500' }
              ].map((service) => (
                <button
                  key={service.id}
                  onClick={() => setMusicService(service.id as any)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    musicService === service.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                      <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-white">{service.name}</span>
                  </div>
                  {musicService === service.id && (
                    <Check className="w-5 h-5 text-purple-500" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choisis ton service de streaming préféré pour ouvrir les morceaux
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Enregistrer
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg font-medium transition-colors border border-red-600/20"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </motion.div>
    </div>
  );
}