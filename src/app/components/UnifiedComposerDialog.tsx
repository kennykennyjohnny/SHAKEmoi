import { useState, useEffect } from 'react';
import { X, Search, Music2, Sparkles, Loader2, Image as ImageIcon, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPost, createStory } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { supabase } from '../../lib/supabase';

interface UnifiedComposerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  currentUser: any;
  initialComposerType?: 'shake' | 'story';
}

const THEMES = ['#1D0F3D', '#2A1852', '#4A1B4E'];

type ComposerType = 'shake' | 'story';

export function UnifiedComposerDialog({ open, onClose, onCreated, currentUser, initialComposerType = 'shake' }: UnifiedComposerDialogProps) {
  // Type selector - use initialComposerType when opening
  const [composerType, setComposerType] = useState<ComposerType>(initialComposerType);

  // Shared state
  const [caption, setCaption] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Photo/file upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Story-only state
  const [durationDays, setDurationDays] = useState<1 | 7 | 30>(1);
  const [themeColor, setThemeColor] = useState(THEMES[0]);

  // Reset all states when dialog opens or closes
  useEffect(() => {
    if (!open) {
      // Reset everything
      resetForm();
    } else {
      // Set initial composer type when dialog opens
      setComposerType(initialComposerType);
    }
  }, [open, initialComposerType]);

  const resetForm = () => {
    setCaption('');
    setSearchQuery('');
    setSelectedTrack(null);
    setSuccess(false);
    setSearchResults([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    setDurationDays(1);
    setThemeColor(THEMES[0]);
    setComposerType('shake');
    setIsCreating(false);
  };

  // Debounce search
  useEffect(() => {
    if (!open || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const tracks = await spotify.searchTracks(query);
      const formatted = tracks.map((t: any) => ({
        id: t.id,
        title: t.name,
        artist: t.artist,
        coverUrl: t.cover,
        duration: '3:00',
        previewUrl: t.preview_url,
        spotifyUri: t.spotify_url,
      }));
      setSearchResults(formatted);
    } catch (error) {
      console.error('Failed to search Spotify:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePhotoSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo trop lourde (max 10 Mo)');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhotoIfNeeded = async (): Promise<string | null> => {
    if (!photoFile || !currentUser?.id) return null;
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
    const bucketCandidates = composerType === 'story'
      ? ['story-media', 'shake-media']
      : ['shake-media'];

    let lastError: any = null;
    for (const bucketName of bucketCandidates) {
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, photoFile, { cacheControl: '3600', upsert: false });
      if (!error) {
        const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        return data.publicUrl;
      }
      lastError = error;
    }

    throw lastError || new Error('Upload photo impossible');
  };

  const handleCreate = async () => {
    if (composerType === 'shake') {
      await handleCreateShake();
    } else {
      await handleCreateStory();
    }
  };

  const handleCreateShake = async () => {
    if (!selectedTrack && !photoPreview) return;
    setIsCreating(true);
    try {
      const imageUrl = await uploadPhotoIfNeeded();
      await createPost(
        selectedTrack?.title || '',
        selectedTrack?.artist || '',
        selectedTrack?.coverUrl || '',
        caption,
        selectedTrack?.previewUrl || null,
        selectedTrack?.spotifyUri || null,
        selectedTrack?.id || null,
        false,
        null,
        imageUrl
      );
      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onClose();
        onCreated?.();
      }, 500);
    } catch (error) {
      console.error('Error creating shake:', error);
      alert('Erreur lors de la création du shake');
      setIsCreating(false);
    }
  };

  const handleCreateStory = async () => {
    if (!photoPreview && !selectedTrack && !caption.trim()) {
      alert('Ajoute une photo, un son ou du texte');
      return;
    }
    setIsCreating(true);
    try {
      const imageUrl = await uploadPhotoIfNeeded();
      const result = await createStory({
        imageUrl,
        track: selectedTrack,
        text: caption,
        themeColor,
        durationDays,
        publishAsShake: false,
      });
      if (!result.success) throw new Error(result.error);
      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onClose();
        onCreated?.();
      }, 500);
    } catch (error: any) {
      console.error('Error creating story:', error);
      alert(error?.message || 'Erreur lors de la création de la story');
      setIsCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1D0F3D] rounded-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-hidden flex flex-col border border-purple-800/20 my-auto"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-white">
                  {composerType === 'shake' ? 'Crée un Shake' : 'Publie un Shake Éphémère'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-purple-300/60" />
              </button>
            </div>

            {/* Type Selector */}
            <div className="px-4 py-2 border-b border-purple-800/20 flex gap-2">
              <button
                onClick={() => {
                  setComposerType('shake');
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  composerType === 'shake'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/30'
                }`}
              >
                Shake Classique
              </button>
              <button
                onClick={() => setComposerType('story')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  composerType === 'story'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/30'
                }`}
              >
                Shake Éphémère
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
              {/* For STORY: Photo is required-ish */}
              {composerType === 'story' && (
                <div className="bg-purple-950/40 rounded-lg p-3 border border-purple-700/30">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/25 border border-purple-700/30 cursor-pointer text-sm mb-2">
                    <ImageIcon className="w-4 h-4 text-purple-300/70" />
                    {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </label>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}

              {/* Selected Track (Shake only: required) */}
              {selectedTrack ? (
                <div>
                  <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-3 flex gap-3 items-center border border-purple-500/20 mb-3">
                    <img
                      src={selectedTrack.coverUrl}
                      alt={selectedTrack.title}
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white truncate">
                        {selectedTrack.title}
                      </h4>
                      <p className="text-sm text-purple-300 truncate">
                        {selectedTrack.artist}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedTrack(null)}
                      className="p-1.5 hover:bg-purple-900/40 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-purple-300/60" />
                    </button>
                  </div>

                  {/* For SHAKE only: add photo option */}
                  {composerType === 'shake' && (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/25 border border-purple-700/30 cursor-pointer text-sm mb-3">
                      <ImageIcon className="w-4 h-4 text-purple-300/70" />
                      Ajouter une photo (optionnel)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  )}
                  {photoPreview && composerType === 'shake' && (
                    <img
                      src={photoPreview}
                      alt="preview"
                      className="w-full h-44 object-cover rounded-xl mb-3"
                    />
                  )}
                </div>
              ) : (
                <>
                  {/* For SHAKE only: offer photo upload before track */}
                  {composerType === 'shake' && (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/25 border border-purple-700/30 cursor-pointer text-sm">
                      <ImageIcon className="w-4 h-4 text-purple-300/70" />
                      Ajouter une photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  )}
                  {photoPreview && composerType === 'shake' && (
                    <img
                      src={photoPreview}
                      alt="preview"
                      className="mt-2 w-full h-44 object-cover rounded-xl"
                    />
                  )}

                  {/* Track Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/60" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un titre, artiste..."
                        className="w-full pl-10 pr-4 py-2.5 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Search results (no suggestions) */}
                  <div>
                    <h3 className="text-sm font-semibold text-purple-300/60 mb-3">
                      {searchQuery.trim() ? 'Résultats' : 'Recherche musicale (optionnel)'}
                    </h3>
                    <div className="space-y-2">
                      {isSearching ? (
                        <div className="flex justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-300/60" />
                        </div>
                      ) : !searchQuery.trim() ? (
                        <p className="text-xs text-purple-300/50">
                          Tape au moins 1 caractere pour chercher un son.
                        </p>
                      ) : searchResults.length === 0 ? (
                        <p className="text-xs text-purple-300/50">
                          Aucun resultat.
                        </p>
                      ) : (
                        searchResults.map((track) => (
                          <button
                            key={track.id}
                            onClick={() => setSelectedTrack(track)}
                            className="w-full p-2 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center gap-3 transition-colors text-left"
                          >
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm text-white truncate">
                                {track.title}
                              </h4>
                              <p className="text-xs text-purple-300/60 truncate">
                                {track.artist}
                              </p>
                            </div>
                            <Music2 className="w-4 h-4 text-purple-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Caption Textarea */}
              <div>
                <label className="text-xs text-purple-300/70 font-medium">
                  {composerType === 'shake' ? 'Ajoute un commentaire...' : 'Ajoute du texte...'}
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="(optionnel)"
                  className="w-full mt-1 px-3 py-2 bg-purple-950/40 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  rows={2}
                />
              </div>

              {/* Story-only options */}
              {composerType === 'story' && (
                <>
                  {/* Duration selector */}
                  <div>
                    <label className="text-xs text-purple-300/70 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Durée de la story
                    </label>
                    <div className="flex gap-2 mt-2">
                      {[1, 7, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() => setDurationDays(days as any)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                            durationDays === days
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                              : 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/30'
                          }`}
                        >
                          {days === 1 ? '1 jour' : days === 7 ? '7 jours' : '1 mois'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme color selector */}
                  <div>
                    <label className="text-xs text-purple-300/70 font-medium">
                      Couleur de fond
                    </label>
                    <div className="flex gap-2 mt-2">
                      {THEMES.map((color) => (
                        <button
                          key={color}
                          onClick={() => setThemeColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-12 h-12 rounded-lg border-2 transition-all ${
                            themeColor === color
                              ? 'border-yellow-400 shadow-lg shadow-yellow-400/30'
                              : 'border-purple-600/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              className="sticky bottom-0 z-10 px-4 py-3 border-t border-purple-800/20 flex justify-between items-center bg-[#1D0F3D]"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <p className="text-xs text-purple-300/60">
                {composerType === 'shake'
                  ? selectedTrack || photoPreview
                    ? 'Prêt à shaker ?'
                    : 'Sélectionne un son ou ajoute une photo'
                  : photoPreview || selectedTrack
                  ? 'Prêt à publier ?'
                  : 'Ajoute une photo ou sélectionne un son (optionnel)'}
              </p>
              <button
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  success ||
                  (composerType === 'shake' && !selectedTrack && !photoPreview) ||
                  (composerType === 'story' && !photoPreview && !selectedTrack && !caption.trim())
                }
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {composerType === 'shake' ? 'Shake' : 'Éphémère'} ✨
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
