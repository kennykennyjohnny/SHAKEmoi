import { X, User, Mail, AtSign, MessageSquare, Upload, Loader2, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useRef } from 'react';
import { updateUserProfile } from '../../lib/database';

interface EditProfileDialogProps {
  currentUser: any;
  onClose: () => void;
  onUpdateUser?: (updatedUser: any) => void;
}

export function EditProfileDialog({ currentUser, onClose, onUpdateUser }: EditProfileDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: currentUser.displayName || '',
    username: currentUser.username || '',
    bio: currentUser.bio || '',
    avatar: currentUser.avatar || ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { supabase } = await import('../../lib/supabase');
      
      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avatar: publicUrl });
      setLoading(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Erreur lors du téléchargement de la photo');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update profile in Supabase
      await updateUserProfile(currentUser.id, {
        username: formData.username,
        display_name: formData.displayName,
        bio: formData.bio,
        profile_album_cover_url: formData.avatar,
      } as any);
      
      // Create updated user object
      const updatedUser = {
        ...currentUser,
        username: formData.username,
        display_name: formData.displayName,
        displayName: formData.displayName,
        bio: formData.bio,
        avatar: formData.avatar,
        profile_album_cover_url: formData.avatar,
      };
      
      // Update localStorage
      localStorage.setItem('shakemoi_user', JSON.stringify(updatedUser));
      
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0f0020] rounded-2xl w-full max-w-md border border-purple-800/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Modifier le profil</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-purple-300/60" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Avatar */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-purple-200/80">
              Photo de profil
            </label>
            <div className="flex items-center gap-4">
              <img
                src={formData.avatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-500"
              />
              <div className="flex-1 space-y-2">
                {/* File upload from phone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  {loading ? 'Téléchargement...' : 'Choisir une photo'}
                </button>
                <p className="text-xs text-purple-400/50">
                  📸 Télécharge depuis ton téléphone (sauvegardé sur Supabase)
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    'https://api.dicebear.com/7.x/avataaars/svg?seed=' + currentUser.username,
                    'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.username,
                    'https://api.dicebear.com/7.x/lorelei/svg?seed=' + currentUser.username,
                    'https://api.dicebear.com/7.x/micah/svg?seed=' + currentUser.username
                  ].map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar: url })}
                      className="w-10 h-10 rounded-full overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all"
                    >
                      <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">
              Nom d'affichage
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
              <input
                type="text"
                required
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-purple-950/40 border border-purple-800/30 rounded-lg pl-10 pr-3 py-2 text-white placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ton nom"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">
              Nom d'utilisateur
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-purple-950/40 border border-purple-800/30 rounded-lg pl-10 pr-3 py-2 text-white placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="username"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-purple-200/80 mb-2">
              Bio
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-purple-300/60" />
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                maxLength={160}
                className="w-full bg-purple-950/40 border border-purple-800/30 rounded-lg pl-10 pr-3 py-2 text-white placeholder-purple-400/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Parle-nous de tes goûts musicaux..."
              />
            </div>
            <p className="text-xs text-purple-400/50 mt-1 text-right">
              {formData.bio.length}/160
            </p>
          </div>

          {/* Submit buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}