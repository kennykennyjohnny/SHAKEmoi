import { useState, useEffect } from 'react';
import { X, Search, Sparkles, Loader2, Image as ImageIcon, Clock, ZoomIn, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPost, createStory } from '../../lib/database';
import { spotify } from '../../lib/spotify';
import { supabase } from '../../lib/supabase';
import { compressImage, extFor } from '../../lib/media';
import { SongCover } from './SongCover';
import { stopPreview } from '../../lib/preview';
import { STORY_THEMES, getCoverPalette, themeCss, autoBackgroundCss, type StoryTheme, type Palette } from '../../lib/storyTheme';
import { StoryComposerPreview, composeStoryImage, defaultTransform, type PhotoTransform } from './StoryComposerPreview';
import { useCoverPalette } from './StoryBackdrop';
import { useBackHandler } from '../../lib/navigation';
import { friendlyError } from '../../lib/errors';

interface UnifiedComposerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  currentUser: any;
  initialComposerType?: 'shake' | 'story';
}


type ComposerType = 'shake' | 'story';

export function UnifiedComposerDialog({ open, onClose, onCreated, currentUser, initialComposerType = 'shake' }: UnifiedComposerDialogProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(open, onClose);
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
  const [storyTheme, setStoryTheme] = useState<StoryTheme>(STORY_THEMES[0]);
  // Cadrage de la photo dans la story (voir StoryComposerPreview).
  const [photoTransform, setPhotoTransform] = useState<PhotoTransform>({ x: 0, y: 0, s: 0.88 });
  const [photoSize, setPhotoSize] = useState<{ w: number; h: number } | null>(null);
  const coverPalette = useCoverPalette(selectedTrack?.coverUrl);

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
    setStoryTheme(STORY_THEMES[0]);
    setPhotoSize(null);
    setComposerType('shake');
    setIsCreating(false);
  };

  // L'aperçu écouté pendant la création s'arrête quand on ferme.
  useEffect(() => { if (!open) stopPreview(); return () => stopPreview(); }, [open]);

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
    setPhotoSize(null); // le cadrage par défaut est calculé au chargement de l'image
  };

  const onPhotoSize = (w: number, h: number) => {
    if (photoSize?.w === w && photoSize?.h === h) return;
    setPhotoSize({ w, h });
    setPhotoTransform(defaultTransform(w, h));
  };

  const uploadPhotoIfNeeded = async (composed?: Blob): Promise<string | null> => {
    if ((!photoFile && !composed) || !currentUser?.id) return null;
    // Photo compressée dans le navigateur (1280 px max, ~200 Ko au lieu de 10 Mo).
    const body = composed ?? await compressImage(photoFile!, 1280, 0.8);
    const ext = composed ? 'jpg' : extFor(body, photoFile!.name);
    const fileName = `${currentUser.id}/${Date.now()}.${ext}`;
    const bucketCandidates = composerType === 'story'
      ? ['story-media', 'shake-media']
      : ['shake-media'];

    let lastError: any = null;
    for (const bucketName of bucketCandidates) {
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, body, { cacheControl: '31536000', upsert: false, contentType: composed ? 'image/jpeg' : (body.type || undefined) });
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
      // createPost ne lève pas d'erreur : on lit son résultat (avant, un échec
      // affichait quand même la coche « publié »).
      const result = await createPost(
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
      if (!result?.success) throw new Error(result?.error || 'createPost');
      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onClose();
        onCreated?.();
      }, 500);
    } catch (error) {
      console.error('Error creating shake:', error);
      alert(friendlyError(error, "Ton shake n'a pas pu être publié. Vérifie ta connexion et réessaie."));
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
      // Story photo : on publie exactement l'aperçu (fond + photo cadrée).
      let composed: Blob | undefined;
      if (photoPreview) {
        const palette: Palette | null = storyTheme.stops ? null : await getCoverPalette(selectedTrack?.coverUrl);
        composed = await composeStoryImage({
          photo: photoPreview,
          theme: storyTheme,
          palette,
          cover: selectedTrack?.coverUrl || null,
          transform: photoTransform,
        });
      }
      const imageUrl = await uploadPhotoIfNeeded(composed);
      const result = await createStory({
        imageUrl,
        track: selectedTrack,
        text: caption,
        themeColor: themeCss(storyTheme),
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
      alert(friendlyError(error, "Ta story n'a pas pu être publiée. Vérifie ta connexion et réessaie."));
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
              <button aria-label="Fermer"
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
              {/* Story : aperçu fidèle (format 9:16) + cadrage de la photo */}
              {composerType === 'story' && (
                <div className="space-y-3">
                  <div className="mx-auto w-[min(260px,64vw)]">
                    <StoryComposerPreview
                      theme={storyTheme}
                      cover={selectedTrack?.coverUrl || null}
                      track={selectedTrack ? { title: selectedTrack.title, artist: selectedTrack.artist } : null}
                      photo={photoPreview}
                      text={caption}
                      transform={photoTransform}
                      onTransform={setPhotoTransform}
                      onPhotoSize={onPhotoSize}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/25 border border-purple-700/30 cursor-pointer text-sm flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-purple-300/70" />
                      {photoPreview ? 'Changer' : 'Ajouter une photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                    </label>
                    {photoPreview && (
                      <>
                        <ZoomIn className="w-4 h-4 text-purple-300/70 flex-shrink-0" />
                        <input
                          type="range"
                          min={0.2}
                          max={3}
                          step={0.01}
                          value={photoTransform.s}
                          onChange={e => setPhotoTransform(t => ({ ...t, s: Number(e.target.value) }))}
                          className="flex-1 min-w-0 accent-fuchsia-500"
                          aria-label="Taille de la photo"
                        />
                        <button
                          onClick={() => photoSize && setPhotoTransform(defaultTransform(photoSize.w, photoSize.h))}
                          className="p-2 rounded-lg bg-purple-900/25 border border-purple-700/30 flex-shrink-0"
                          title="Recentrer"
                          aria-label="Recentrer la photo"
                        >
                          <RotateCcw className="w-4 h-4 text-purple-300/70" />
                        </button>
                        <button
                          onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoSize(null); }}
                          className="p-2 rounded-lg bg-purple-900/25 border border-purple-700/30 flex-shrink-0"
                          title="Retirer la photo"
                          aria-label="Retirer la photo"
                        >
                          <X className="w-4 h-4 text-purple-300/70" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Track (Shake only: required) */}
              {selectedTrack ? (
                <div>
                  <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl p-3 flex gap-3 items-center border border-purple-500/20 mb-3">
                    {/* M2 : écouter l'aperçu de ce qu'on va publier. */}
                    <SongCover
                      songKey={`compose-${selectedTrack.id}`}
                      title={selectedTrack.title} artist={selectedTrack.artist} cover={selectedTrack.coverUrl}
                      previewUrl={selectedTrack.previewUrl} spotifyId={selectedTrack.id} spotifyUrl={selectedTrack.spotifyUri}
                      className="w-16 h-16" rounded="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white truncate">
                        {selectedTrack.title}
                      </h4>
                      <p className="text-sm text-purple-300 truncate">
                        {selectedTrack.artist}
                      </p>
                    </div>
                    <button aria-label="Fermer"
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
                    <img loading="lazy"
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
                    <img loading="lazy"
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
                          <div
                            key={track.id}
                            className="w-full p-2 bg-purple-950/40 hover:bg-purple-800/40 rounded-lg flex items-center gap-3 transition-colors text-left"
                          >
                            {/* Pochette = écouter ; le reste de la ligne = choisir. */}
                            <SongCover
                              songKey={`compose-${track.id}`}
                              title={track.title} artist={track.artist} cover={track.coverUrl}
                              previewUrl={track.previewUrl} spotifyId={track.id} spotifyUrl={track.spotifyUri}
                              className="w-12 h-12" rounded="rounded"
                            />
                            <button onClick={() => setSelectedTrack(track)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm text-white truncate">
                                  {track.title}
                                </h4>
                                <p className="text-xs text-purple-300/60 truncate">
                                  {track.artist}
                                </p>
                              </div>
                              <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-purple-600/40 text-[11px] font-semibold">Choisir</span>
                            </button>
                          </div>
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

                  {/* Fond de la story */}
                  <div>
                    <label className="text-xs text-purple-300/70 font-medium">Fond</label>
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {STORY_THEMES.map(theme => {
                        const selected = storyTheme.id === theme.id;
                        return (
                          <button
                            key={theme.id}
                            onClick={() => setStoryTheme(theme)}
                            className="flex flex-col items-center gap-1 flex-shrink-0"
                          >
                            <span
                              className={`w-11 h-16 rounded-lg border-2 transition-all ${selected ? 'border-white scale-105 shadow-lg shadow-white/20' : 'border-white/10'}`}
                              style={{ background: themeCss(theme) ?? autoBackgroundCss(coverPalette) }}
                            />
                            <span className={`text-[10px] ${selected ? 'text-white font-semibold' : 'text-purple-300/60'}`}>{theme.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-purple-300/50 mt-1">« Auto » reprend les couleurs de la pochette.</p>
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
