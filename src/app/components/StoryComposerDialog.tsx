import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Loader2, Music, Image as ImageIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { spotify } from '../../lib/spotify';
import { createStory } from '../../lib/database';
import { supabase } from '../../lib/supabase';

interface StoryComposerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  currentUser?: any;
}

const THEMES = ['#1D0F3D', '#2A1852', '#4A1B4E'];

export function StoryComposerDialog({ open, onClose, onCreated, currentUser }: StoryComposerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [text, setText] = useState('');
  const [durationDays, setDurationDays] = useState<1 | 7 | 30>(1);
  const [themeColor, setThemeColor] = useState(THEMES[0]);
  const [publishAsShake, setPublishAsShake] = useState(false);
  const [saving, setSaving] = useState(false);
  const canPublish = useMemo(() => !!photoPreview || !!selectedTrack, [photoPreview, selectedTrack]);

  useEffect(() => {
    if (!open) return;
    setTrackQuery('');
    setTrackResults([]);
  }, [open]);

  useEffect(() => {
    if (trackQuery.trim().length < 2) {
      setTrackResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setTrackResults(await spotify.searchTracks(trackQuery));
      } catch {
        setTrackResults([]);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [trackQuery]);

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

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !currentUser?.id) return null;
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('story-media')
      .upload(path, photoFile, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('story-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!canPublish || saving) return;
    setSaving(true);
    try {
      const imageUrl = await uploadPhoto();
      const result = await createStory({
        imageUrl,
        track: selectedTrack,
        text,
        themeColor,
        durationDays,
        publishAsShake,
      });
      if (!result.success) throw new Error(result.error);
      onCreated?.();
      onClose();
    } catch (error: any) {
      console.error('Story create error:', error);
      alert(error?.message || 'Impossible de publier la story');
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1D0F3D] rounded-2xl w-full max-w-lg border border-purple-800/30 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-purple-800/20 flex items-center justify-between">
              <h3 className="font-bold text-white">Nouvelle story</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-purple-900/30 rounded-full"><X className="w-4 h-4 text-purple-300/70" /></button>
            </div>

            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              <button onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border border-purple-700/30 bg-purple-950/30 p-3 text-left hover:bg-purple-900/30 transition-colors flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-300/70" />
                <span className="text-sm">Ajouter une photo</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

              {photoPreview && (
                <div className="rounded-xl overflow-hidden border border-purple-700/30">
                  <img src={photoPreview} alt="story" className="w-full h-56 object-cover" />
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/60" />
                <input
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  placeholder="Ajouter un son..."
                  className="w-full pl-9 pr-3 py-2 bg-purple-950/40 border border-purple-700/30 rounded-lg text-sm text-white placeholder-purple-400/50"
                />
              </div>

              {searching && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
              {trackResults.slice(0, 6).map((t: any) => (
                <button key={t.id} onClick={() => setSelectedTrack(t)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-purple-900/25 text-left">
                  <img src={t.cover} alt="" className="w-10 h-10 rounded" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-purple-300/60 truncate">{t.artist}</p>
                  </div>
                </button>
              ))}

              {selectedTrack && (
                <div className="rounded-xl border border-purple-700/30 p-2 bg-purple-950/30 flex items-center gap-2">
                  <img src={selectedTrack.cover} alt="" className="w-10 h-10 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{selectedTrack.name}</p>
                    <p className="text-xs text-purple-300/60 truncate">{selectedTrack.artist}</p>
                  </div>
                  <Music className="w-4 h-4 text-fuchsia-400" />
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Description..."
                rows={2}
                className="w-full px-3 py-2 bg-purple-950/40 border border-purple-700/30 rounded-lg text-sm text-white placeholder-purple-400/50 resize-none"
              />

              <div className="space-y-2">
                <p className="text-xs text-purple-300/70 uppercase tracking-wider">Durée</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ d: 1 as const, l: '1 jour' }, { d: 7 as const, l: '7 jours' }, { d: 30 as const, l: '1 mois' }].map((opt) => (
                    <button key={opt.d} onClick={() => setDurationDays(opt.d)} className={`py-2 rounded-lg text-xs font-semibold border ${durationDays === opt.d ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-300' : 'bg-purple-950/30 border-purple-700/30 text-purple-200/80'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-purple-300/70 uppercase tracking-wider">Fond</p>
                <div className="flex gap-2">
                  {THEMES.map((c) => (
                    <button key={c} onClick={() => setThemeColor(c)} className={`w-8 h-8 rounded-full border-2 ${themeColor === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-purple-200/90">
                <input type="checkbox" checked={publishAsShake} onChange={(e) => setPublishAsShake(e.target.checked)} />
                Publier aussi comme shake
              </label>
            </div>

            <div className="px-4 py-3 border-t border-purple-800/20 flex justify-end">
              <button
                onClick={handleCreate}
                disabled={!canPublish || saving}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> Publier</span>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
