import { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ImageCropDialog } from './ImageCropDialog';

interface CompleteProfileDialogProps {
  user: any;
  onComplete: (updatedUser: any) => void;
}

export function CompleteProfileDialog({ user, onComplete }: CompleteProfileDialogProps) {
  const [displayName, setDisplayName] = useState(user.display_name || user.username || '');
  // Photo déjà cadrée en carré (P11), prête à envoyer.
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.profile_album_cover_url || null);
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCropFile(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let avatarUrl = user.profile_album_cover_url || null;

      if (avatarFile) {
        // Photo de profil compressée (256 px) ; nom unique pour ne pas
        // resservir l'ancienne photo depuis les caches.
        const path = `${user.id}/avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      const updates: any = {};
      if (displayName && displayName !== user.display_name) {
        updates.display_name = displayName;
      }
      if (avatarUrl && avatarUrl !== user.profile_album_cover_url) {
        updates.profile_album_cover_url = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('users_profile')
          .update(updates)
          .eq('id', user.id);
      }

      localStorage.setItem('shakemoi_profile_completed', 'true');
      onComplete({ ...user, ...updates });
    } catch (err) {
      console.error('Error completing profile:', err);
      localStorage.setItem('shakemoi_profile_completed', 'true');
      onComplete(user);
    } finally {
      setLoading(false);
    }
  };

  const skip = () => {
    localStorage.setItem('shakemoi_profile_completed', 'true');
    onComplete(user);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-sm border border-purple-800/30 overflow-hidden"
      >
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-1">Complète ton profil</h2>
          <p className="text-sm text-purple-300/85 mb-5">Ajoute une photo et un nom pour que tes amis te reconnaissent</p>

          {/* Avatar */}
          <label className="mx-auto w-20 h-20 rounded-full bg-purple-950/60 border-2 border-dashed border-purple-500/40 flex items-center justify-center cursor-pointer overflow-hidden mb-4 block hover:border-purple-500 transition-colors">
            {avatarPreview ? (
              <img loading="lazy" src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-6 h-6 text-purple-300/80" />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            {cropFile && (
              <ImageCropDialog
                file={cropFile}
                title="Cadre ta photo de profil"
                onCancel={() => setCropFile(null)}
                onDone={(blob) => { setCropFile(null); setAvatarFile(blob); setAvatarPreview(URL.createObjectURL(blob)); }}
              />
            )}
          </label>

          {/* Display Name */}
          <div className="relative mb-5">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-purple-950/30 border border-purple-800/30 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              placeholder="Ton nom affiché"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : 'Continuer'}
          </button>

          <button onClick={skip} className="mt-3 text-sm text-purple-300/80 hover:text-purple-300/80 transition-colors">
            Passer pour l'instant
          </button>
        </div>
      </motion.div>
    </div>
  );
}
