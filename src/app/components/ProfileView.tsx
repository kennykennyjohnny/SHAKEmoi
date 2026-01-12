import { Users, Music, Heart, Settings, Share2, Play, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
import * as api from '../utils/api';

interface ProfileViewProps {
  user: any;
  onPlayTrack: (track: any) => void;
  onUpdateUser?: (updatedUser: any) => void;
}

export function ProfileView({ user, onPlayTrack, onUpdateUser }: ProfileViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userShakes, setUserShakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserShakes();
  }, [user]);

  const loadUserShakes = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Get user's shakes from API
      const shakes = await api.getUserShakes(user.id);
      setUserShakes(shakes);
    } catch (error) {
      console.error('Failed to load user shakes:', error);
      setUserShakes([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const handleSaveSettings = (settings: { musicService: 'spotify' | 'apple' }) => {
    const updatedUser = { ...user, ...settings };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
    // Also update localStorage
    const onboarding = localStorage.getItem('shakemoi_onboarding');
    if (onboarding) {
      const data = JSON.parse(onboarding);
      localStorage.setItem('shakemoi_onboarding', JSON.stringify({ ...data, ...settings }));
    }
  };

  const handleDeleteShake = async (shakeId: string) => {
    try {
      await api.deleteShake(shakeId);
      setUserShakes(userShakes.filter(shake => shake.id !== shakeId));
    } catch (error) {
      console.error('Failed to delete shake:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900" />
        
        <div className="px-4 pb-4">
          {/* Avatar & Actions */}
          <div className="flex items-end justify-between -mt-16 mb-4">
            <motion.img
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              src={user.avatar}
              alt={user.displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-black ring-4 ring-purple-500"
            />
            
            <div className="flex gap-2 pb-2">
              <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400 mb-2">@{user.username}</p>
            
            {user.bio && (
              <p className="text-sm text-gray-300 mb-3">
                {user.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <button className="hover:underline">
                <span className="font-bold text-white">{user.shakes}</span>
                <span className="text-gray-400 ml-1">shakes</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold text-white">{user.followers}</span>
                <span className="text-gray-400 ml-1">abonnés</span>
              </button>
              <button className="hover:underline">
                <span className="font-bold text-white">{user.following}</span>
                <span className="text-gray-400 ml-1">abonnements</span>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => setShowEditProfile(true)}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity text-sm"
          >
            Modifier le profil
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-y border-zinc-800 px-4 sticky top-0 bg-black z-30">
        <div className="flex gap-6">
          <button className="py-3 border-b-2 border-purple-500 text-purple-500 font-semibold text-sm">
            Mes shakes
          </button>
          <button className="py-3 text-gray-400 hover:text-white transition-colors text-sm">
            Playlists
          </button>
          <button className="py-3 text-gray-400 hover:text-white transition-colors text-sm">
            Likes
          </button>
        </div>
      </div>

      {/* Shakes Grid */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400">Chargement...</div>
        ) : userShakes.length > 0 ? (
          userShakes.map((shake, index) => (
            <motion.div
              key={shake.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 hover:border-zinc-700 transition-all relative"
            >
              {/* Delete button */}
              <button
                onClick={() => {
                  if (confirm('Supprimer ce shake ?')) {
                    handleDeleteShake(shake.id);
                  }
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors z-10"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>

              <button
                onClick={() => onPlayTrack(shake.track)}
                className="w-full flex gap-3 items-center group"
              >
                <div className="relative">
                  <img
                    src={shake.track.coverUrl}
                    alt={shake.track.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <h4 className="font-semibold text-sm text-white truncate">{shake.track.title}</h4>
                  <p className="text-xs text-gray-400 truncate">{shake.track.artist}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {shake.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {shake.reshakes}
                    </span>
                    <span>{shake.timestamp}</span>
                  </div>
                </div>
                
                <span className="text-xs text-gray-500">{shake.track.duration}</span>
              </button>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-gray-400 py-8">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun shake pour le moment</p>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          currentUser={user}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Edit Profile Dialog */}
      {showEditProfile && (
        <EditProfileDialog
          currentUser={user}
          onClose={() => setShowEditProfile(false)}
          onUpdateUser={onUpdateUser}
        />
      )}
    </div>
  );
}