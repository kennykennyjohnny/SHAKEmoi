import { X, Heart, MessageCircle, Trash2, ChevronLeft, ChevronRight, Send, Eye, Hourglass, Play, Pause, Pin, Volume2, VolumeX, Flag } from 'lucide-react';
import { openReport } from '../../lib/appNav';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { likeStory, unlikeStory, hasLikedStory, commentOnStory, getStoryViewers, getStoryLikes, markStoryAsViewed } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { resolvePreviewUrl, playPreview, stopPreview, togglePreview, onPreviewChange, getPreviewState, getSpotifyTrackTitle, setMuted } from '../../lib/preview';
import { useBackHandler } from '../../lib/navigation';
import { StoryBackdrop } from './StoryBackdrop';
import { getPlatformUrl } from '../../lib/odesli';
import { openExternal } from '../../lib/platforms';

import { thumb, defaultAvatar, avatarThumb } from '../../lib/media';
import { MyAppLogo } from './PlatformLogo';
interface StoryViewerDialogProps {
  open: boolean;
  story: any | null;
  onClose: () => void;
  currentUser: any;
  stories?: any[];
  onNavigate?: (story: any) => void;
  onGroupEnd?: () => void;
  /** Ouvrir directement la liste des likes (story expirée ouverte depuis une notif, M10). */
  initialPanel?: 'likes';
}

// Durée d'affichage d'une story. Trop court à 5s : on laisse le temps de lire,
// et bien plus quand il y a un son (le temps de viber dessus).
const STORY_DURATION_DEFAULT = 7000;
const STORY_DURATION_MUSIC = 15000;

// Profils déjà chargés (auteurs des stories), pour ne pas les redemander.
const ownerCache = new Map<string, any>();

/** M3 : temps restant en direct, « JJ:HH:MM:SS » (ou « HH:MM:SS » sous un jour). */
function formatCountdown(expiresAt: string, now: number): string | null {
  const diff = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${p(d)}:${p(h)}:${p(m)}:${p(s)}` : `${p(h)}:${p(m)}:${p(s)}`;
}

export function StoryViewerDialog({ open, story, onClose, currentUser, stories, onNavigate, onGroupEnd, initialPanel }: StoryViewerDialogProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<{ id: string; x: number; y: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  // Panneau du propriétaire : qui a vu / qui a liké.
  const [panelMode, setPanelMode] = useState<'views' | 'likes'>('views');
  const [likers, setLikers] = useState<any[] | null>(null);
  const [sentNotice, setSentNotice] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  // Story avec musique => on laisse plus de temps.
  const hasMusic = !!(story?.spotify_embed_url || story?.track_id);
  const STORY_DURATION = hasMusic ? STORY_DURATION_MUSIC : STORY_DURATION_DEFAULT;

  const storyList = stories && stories.length > 0 ? stories : (story ? [story] : []);
  const currentIdx = storyList.findIndex((s: any) => s.id === story?.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < storyList.length - 1;
  const isOwner = currentUser?.id === story?.user_id;

  // Auteur : fourni avec la story (fil) ou chargé à part (stories ouvertes
  // depuis un profil, sans jointure) — sinon l'en-tête restait vide.
  const [owner, setOwner] = useState<any>(story?.user ?? null);
  useEffect(() => {
    if (!story) return;
    if (story.user?.username) { setOwner(story.user); ownerCache.set(story.user_id, story.user); return; }
    if (isOwner && currentUser) {
      setOwner({
        id: currentUser.id,
        username: currentUser.username,
        display_name: currentUser.displayName || currentUser.display_name,
        profile_album_cover_url: currentUser.avatar || currentUser.profile_album_cover_url,
      });
      return;
    }
    const cached = ownerCache.get(story.user_id);
    if (cached) { setOwner(cached); return; }
    setOwner(null);
    let cancelled = false;
    supabase.from('users_profile').select('id, username, display_name, profile_album_cover_url')
      .eq('id', story.user_id).maybeSingle()
      .then(({ data }) => { if (data) ownerCache.set(story.user_id, data); if (!cancelled) setOwner(data); });
    return () => { cancelled = true; };
  }, [story?.id]);

  const navigatePrev = () => {
    if (hasPrev && onNavigate) { setShowCommentInput(false); setShowViewers(false); onNavigate(storyList[currentIdx - 1]); }
  };
  const navigateNext = () => {
    if (hasNext && onNavigate) { setShowCommentInput(false); setShowViewers(false); onNavigate(storyList[currentIdx + 1]); }
    else if (!hasNext) { onGroupEnd?.(); }
  };

  const startProgress = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startTimeRef.current = Date.now() - elapsedRef.current;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        navigateNext();
      }
    }, 50);
  };

  const pauseProgress = () => {
    // Le temps écoulé n'avance que si le minuteur tournait vraiment.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      elapsedRef.current = Date.now() - startTimeRef.current;
    }
  };

  // E1 : le minuteur ne part qu'une fois la photo chargée (8 s max d'attente,
  // pour ne jamais rester bloqué). Sans photo, il part tout de suite.
  const [mediaReady, setMediaReady] = useState(!story?.image_url);
  useEffect(() => {
    setMediaReady(!story?.image_url);
    if (!story?.image_url) return;
    const t = setTimeout(() => setMediaReady(true), 8000);
    return () => clearTimeout(t);
  }, [story?.id]);

  // E2 : appli masquée (autre onglet, écran verrouillé, autre appli) → pause.
  const [appHidden, setAppHidden] = useState(typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onVis = () => setAppHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Nouvelle story : on repart de zéro.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setProgress(0);
    elapsedRef.current = 0;
  }, [story?.id, open]);

  const blocked = isPaused || showCommentInput || showViewers || !mediaReady || appHidden;
  useEffect(() => {
    if (!open || !story) return;
    if (blocked) pauseProgress();
    else startProgress();
  }, [blocked, story?.id, open]);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigatePrev();
      else if (e.key === 'ArrowRight') navigateNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIdx, storyList.length]);

  useEffect(() => {
    if (!story) return;
    setIsLiked(false);
    setLikeCount(story.likes_count || 0);
    setShowViewers(false);
    setViewers([]);
    setLikers(null);
    hasLikedStory(story.id).then(setIsLiked);
    // Une vue = une autre personne que la propriétaire (M4).
    if (currentUser?.id !== story.user_id) markStoryAsViewed(story.id); // la base refuse aussi la vue par la propriétaire
  }, [story?.id]);

  // Le son de la story démarre dès son ouverture (extrait 30s, résolu via
  // preview.ts). Coupé au changement de story et à la fermeture du viewer.
  const storyKey = story ? `story-${story.id}` : '';

  // Stories créées avant l'enregistrement du titre : on le récupère depuis
  // l'oEmbed Spotify (sans clé, mis en cache).
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);
  useEffect(() => {
    setFetchedTitle(null);
    if (!open || !story?.track_id || story?.track_name) return;
    let cancelled = false;
    getSpotifyTrackTitle(story.track_id).then(t => { if (!cancelled) setFetchedTitle(t); });
    return () => { cancelled = true; };
  }, [story?.id, open]);

  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    setStoryPreviewUrl(null);
    if (!open || !story) return;
    // Le titre peut arriver après coup (oEmbed Spotify) : on attend de
    // l'avoir, sinon impossible de retrouver l'extrait.
    const title = story.track_name || fetchedTitle;
    // L'id Spotify suffit : pas besoin d'attendre le titre (anciennes stories).
    if (!title && !story.track_id) return;
    let cancelled = false;
    // M2 : l'extrait est préparé mais ne démarre jamais tout seul :
    // on touche la pochette pour l'écouter (même règle partout).
    resolvePreviewUrl(title || '', title ? story.artist || '' : '', (story as any).preview_url, story.track_id).then(url => {
      if (cancelled || !url) return;
      setStoryPreviewUrl(url);
    });
    return () => { cancelled = true; stopPreview(); };
  }, [story?.id, open]);

  // État réel du son pour afficher le bon bouton play/pause sur la pochette.
  const [preview, setPreview] = useState(getPreviewState());
  useEffect(() => onPreviewChange(() => setPreview(getPreviewState())), []);
  const isSounding = preview.key === storyKey && preview.playing;

  // E2 : le son se coupe aussi quand l'appli est masquée, et reprend au retour.
  const resumeOnShowRef = useRef(false);
  useEffect(() => {
    if (!open || !storyKey) return;
    const state = getPreviewState();
    if (appHidden && state.key === storyKey && state.playing) {
      resumeOnShowRef.current = true;
      togglePreview(storyKey);
    } else if (!appHidden && resumeOnShowRef.current) {
      resumeOnShowRef.current = false;
      if (getPreviewState().key === storyKey && !getPreviewState().playing) togglePreview(storyKey, storyPreviewUrl);
    }
  }, [appHidden]);

  const trackTitle: string | null = story?.track_name || fetchedTitle || null;
  const trackArtist: string | null = story?.artist || null;

  const openInApp = () => {
    // song.link redirige vers la plateforme du visiteur sans dépendre d'une API.
    const links = {
      spotify_url: story?.spotify_url
        || (story?.track_id ? `https://open.spotify.com/track/${story.track_id}` : null),
      apple_music_url: null,
      deezer_url: null,
      youtube_url: null,
      youtube_music_url: null,
      tidal_url: story?.track_id ? null : null,
      odesli_page_url: story?.track_id ? `https://song.link/s/${story.track_id}` : null,
    };
    const url = getPlatformUrl(links, currentUser?.musicService || 'spotify', { title: trackTitle, artist: trackArtist });
    if (url) openExternal(url);
  };

  const [pinned, setPinned] = useState<boolean>(!!story?.is_pinned);
  useEffect(() => { setPinned(!!story?.is_pinned); }, [story?.id]);

  const togglePin = async () => {
    if (!story || !isOwner) return;
    const next = !pinned;
    setPinned(next);
    const { error } = await supabase.from('stories').update({ is_pinned: next }).eq('id', story.id);
    if (error) { setPinned(!next); console.error('Erreur épinglage story:', error); }
  };

  // Retour système : ferme la story au lieu de quitter le site.
  useBackHandler(open, onClose);

  // Tap sur la pochette : lance / met en pause, et réactive le son s'il était
  // coupé. Synchrone quand l'extrait est connu (iOS exige un geste direct).
  const toggleStorySound = async () => {
    if (!trackTitle && !story?.track_id) return;
    const state = getPreviewState();
    if (state.key === storyKey && state.muted) {
      setMuted(false);
      if (!state.playing) togglePreview(storyKey, storyPreviewUrl);
      return;
    }
    if (storyPreviewUrl) { togglePreview(storyKey, storyPreviewUrl); return; }
    const url = await resolvePreviewUrl(trackTitle || '', trackArtist || '', (story as any).preview_url, story?.track_id);
    if (url) { setStoryPreviewUrl(url); playPreview(storyKey, url); }
    else openInApp(); // aucun extrait nulle part : on l'écoute sur la plateforme (M1)
  };

  const loadViewers = async () => {
    if (!story || loadingViewers) return;
    setLoadingViewers(true);
    const data = await getStoryViewers(story.id);
    // Une vue = une autre personne : jamais la propriétaire (M4).
    setViewers(data.filter((v: any) => v.id && v.id !== story.user_id));
    setLoadingViewers(false);
  };

  // M3 : le compte à rebours avance chaque seconde.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // M4 : nombre de vues affiché à la propriétaire (en bas à droite).
  const [viewCount, setViewCount] = useState<number | null>(null);
  useEffect(() => {
    setViewCount(null);
    if (!open || !story || !isOwner) return;
    supabase.rpc('story_view_count', { p_story_id: story.id }).then(({ data }) => setViewCount(Number(data) || 0));
  }, [story?.id, open, isOwner]);

  const loadLikers = () => {
    if (!story) return;
    getStoryLikes(story.id).then(list => setLikers(list.map((l: any) => ({ ...l.user, liked_at: l.created_at }))));
  };

  const toggleViewers = () => {
    const next = !(showViewers && panelMode === 'views');
    setPanelMode('views');
    setShowViewers(next);
    if (next && viewers.length === 0) loadViewers();
    if (next && likers === null) loadLikers();
  };

  const openLikers = () => {
    setPanelMode('likes');
    setShowViewers(true);
    if (likers === null) loadLikers();
  };

  // M10 : story expirée ouverte depuis la cloche → directement la liste des likes.
  useEffect(() => {
    if (open && initialPanel === 'likes') openLikers();
  }, [open, initialPanel, story?.id]);

  // Like optimiste (F4) : cœur et animation tout de suite, annulés si refus.
  const likeBusyRef = useRef(false);
  const toggleLike = async () => {
    if (!story || likeBusyRef.current) return;
    likeBusyRef.current = true;
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    if (next) {
      const id = Math.random().toString();
      setLikeAnimations(prev => [...prev, { id, x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 }]);
      setTimeout(() => setLikeAnimations(prev => prev.filter(a => a.id !== id)), 800);
    }
    const r = next ? await likeStory(story.id) : await unlikeStory(story.id);
    if (!r.success) {
      setIsLiked(!next);
      setLikeCount(c => Math.max(0, c + (next ? -1 : 1)));
    }
    likeBusyRef.current = false;
  };

  const handleComment = async () => {
    if (!story || !commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const result = await commentOnStory(story.id, commentText.trim());
    setIsSubmitting(false);
    if (result.success) {
      setCommentText('');
      setShowCommentInput(false);
      setSentNotice(true);
      setTimeout(() => setSentNotice(false), 2200);
    } else {
      alert("Ta réponse n'a pas pu être envoyée. Réessaie.");
    }
  };

  const handleDelete = async () => {
    if (!story || !currentUser || story.user_id !== currentUser.id) return;
    if (confirm('Supprimer cette story?')) {
      try {
        const { error } = await supabase.from('stories').delete().eq('id', story.id);
        if (error) throw error;
        onClose();
      } catch (err) {
        console.error('Error deleting story:', err);
        alert('Impossible de supprimer la story.');
      }    }
  };

  if (!story) return null;

  const user = owner;
  const avatarSrc = avatarThumb(user?.profile_album_cover_url) || avatarThumb(user?.avatar) || defaultAvatar(user?.username || 'S');
  const timeRemaining = story.expires_at ? formatCountdown(story.expires_at, now) : null;

  const hasTrack = !!(trackTitle || story.track_id);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={onClose}
        >
          {/* Navigation arrows desktop */}
          {hasPrev && (
            <button aria-label="Retour"
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all hidden md:flex"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {(hasNext || !!onGroupEnd) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all hidden md:flex"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Story card — 9:16 ratio */}
          <motion.div
            key={story.id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative flex flex-col overflow-hidden rounded-2xl shadow-2xl bg-[#0A0614]"
            // Exactement 9:16, comme l'aperçu du composeur : la photo publiée
            // s'affiche en entier, sans recadrage surprise.
            style={{ width: 'min(390px, 100vw, calc(88dvh * 9 / 16))', aspectRatio: '9 / 16' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={() => { setIsPaused(true); }}
            onPointerUp={() => { setIsPaused(false); }}
            onPointerLeave={() => { setIsPaused(false); }}
            /* Glisser vers le bas pour fermer, comme Instagram. */
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
          >
            {/* Photo : plein cadre, comme une story Instagram */}
            {story.image_url && (
              <div className="absolute inset-0 pointer-events-none">
                <img loading="lazy" src={thumb(story.image_url, 1024)} alt="" className="w-full h-full object-cover" onLoad={() => setMediaReady(true)} onError={() => setMediaReady(true)} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-60% to-black/60" />
              </div>
            )}

            {/* Story sans photo : fond aux couleurs de la pochette (ou thème choisi) */}
            {!story.image_url && <StoryBackdrop theme={story.theme_color} cover={story.cover_url} />}

            {/* Poignée de fermeture (affordance du glisser) */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 w-10 h-1 rounded-full bg-white/25" />

            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-30">
              {storyList.map((_: any, i: number) => (
                <div key={i} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-none"
                    style={{
                      width: i < currentIdx ? '100%' : i === currentIdx ? `${progress}%` : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-0 right-0 px-3 py-2 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img loading="lazy"
                  src={avatarSrc}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white/40 flex-shrink-0"
                  alt=""
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white drop-shadow leading-tight truncate">
                    {user ? (user.display_name || user.username) : ' '}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {user?.username && <p className="text-[10px] text-white/60 truncate">@{user.username}</p>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* M3 : temps restant, en direct. */}
                {timeRemaining && (
                  <span
                    title="Temps restant avant que la story disparaisse"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/35 backdrop-blur-sm text-[11px] font-semibold text-white tabular-nums"
                  >
                    <Hourglass className="w-3 h-3" /> {timeRemaining}
                  </span>
                )}
                {/* Son : coupé au départ (comme Insta), activé d'un tap.
                    Le choix vaut pour les stories suivantes. */}
                {trackTitle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted(!preview.muted); }}
                    title={preview.muted ? 'Activer le son' : 'Couper le son'}
                    className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                      preview.muted
                        ? 'bg-white/90 text-[#1E1440]'
                        : 'bg-black/30 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {preview.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
                {isOwner && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(); }}
                      title={pinned ? 'Ne plus épingler sur mon profil' : 'Épingler à vie sur mon profil'}
                      className={`flex-shrink-0 p-2 rounded-full transition-colors ${pinned ? 'bg-fuchsia-500/30 text-fuchsia-300' : 'bg-black/30 text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <Pin className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} />
                    </button>
                    <button aria-label="Supprimer"
                      onClick={handleDelete}
                      className="p-2 rounded-full bg-black/30 text-white/70 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {!isOwner && currentUser && story?.id && (
                  <button aria-label="Signaler ce Shake éphémère"
                    onClick={(e) => { e.stopPropagation(); openReport('story', story.id); }}
                    className="p-2 rounded-full bg-black/30 text-white/70 hover:text-pink-300 transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                <button aria-label="Fermer"
                  onClick={onClose}
                  className="p-2 rounded-full bg-black/30 text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tap zones mobile */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); navigateNext(); }}
            />

            {/* Central content */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 pt-20 pb-24 gap-4">
              {story.image_url ? (
                <div className="mt-auto w-full flex flex-col items-center gap-3">
                  {story.text && (
                    <p className="text-sm text-white text-center leading-relaxed bg-black/40 rounded-2xl px-4 py-3 backdrop-blur-sm w-full">
                      {story.text}
                    </p>
                  )}
                  {/* Sticker musique : la photo ne fait plus disparaître le son */}
                  {hasTrack && (
                    <div
                      className="relative z-20 w-full flex items-center gap-3 p-2 pr-2.5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={toggleStorySound}
                        aria-label={isSounding ? 'Mettre en pause' : 'Écouter'}
                        className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                      >
                        {story.cover_url
                          ? <img loading="lazy" src={story.cover_url} alt="" className="w-full h-full object-cover" />
                          : <span className="block w-full h-full bg-gradient-to-br from-purple-600 to-pink-600" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                          {isSounding
                            ? <Pause className="w-6 h-6 text-white fill-white" />
                            : <Play className="w-6 h-6 text-white fill-white" />}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{trackTitle || 'Son'}</p>
                        {trackArtist && <p className="text-xs text-white/70 truncate">{trackArtist}</p>}
                        {isSounding && (
                          <span className="mt-1 flex items-end gap-0.5 h-2.5">
                            {[0, 1, 2, 3].map(i => (
                              <motion.span
                                key={i}
                                className="w-0.5 bg-fuchsia-400 rounded-full"
                                animate={{ height: ['30%', '100%', '40%', '80%', '30%'] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={openInApp}
                        title="Ouvrir dans mon appli"
                        className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white flex-shrink-0"
                      >
                        <MyAppLogo className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  {story.cover_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleStorySound(); }}
                      aria-label={isSounding ? 'Mettre en pause' : 'Écouter'}
                      className="relative z-20 block w-52 max-w-[60vw] aspect-square mx-auto mb-5 group focus:outline-none"
                    >
                      <img loading="lazy"
                        src={story.cover_url}
                        alt={trackTitle || ''}
                        className={`w-full h-full rounded-2xl object-cover shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 transition-all ${isSounding ? 'ring-white/30' : 'ring-white/10'}`}
                      />
                      {trackTitle && (
                        <span className={`absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity ${
                          isSounding ? 'bg-black/30 opacity-0 group-hover:opacity-100' : 'bg-black/40 opacity-100'
                        }`}>
                          {isSounding ? (
                            <Pause className="w-10 h-10 text-white fill-white drop-shadow-lg" />
                          ) : (
                            <Play className="w-10 h-10 text-white fill-white drop-shadow-lg" />
                          )}
                        </span>
                      )}
                      {isSounding && (
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-3">
                          {[0, 1, 2, 3].map(i => (
                            <motion.span
                              key={i}
                              className="w-1 bg-fuchsia-400 rounded-full"
                              animate={{ height: ['30%', '100%', '40%', '80%', '30%'] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  )}
                  <p className="text-2xl font-bold text-white leading-tight drop-shadow-lg px-2">
                    {trackTitle || 'Shake éphémère'}
                  </p>
                  {trackArtist && (
                    <p className="text-sm text-white/70 mt-1.5">{trackArtist}</p>
                  )}

                  {/* Ouvrir le son dans l'appli de l'utilisateur */}
                  {(trackTitle || story.track_id) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openInApp(); }}
                      className="relative z-20 mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-xs font-semibold text-white transition-colors"
                    >
                      <MyAppLogo className="w-3.5 h-3.5" />
                      Ouvrir dans mon appli
                    </button>
                  )}
                </div>
              )}

              {story.text && !story.image_url && (
                <p className="mt-6 text-sm text-white/90 text-center leading-relaxed bg-black/35 rounded-2xl px-4 py-3 backdrop-blur-sm w-full">
                  {story.text}
                </p>
              )}

              {/* Pas d'embed Spotify ici : il a son propre bouton (état illisible
                  depuis la page) et il contredisait le lecteur. Le son de la story
                  passe uniquement par l'extrait, piloté depuis la pochette. */}
            </div>

            {/* Viewers panel (owner only) */}
            <AnimatePresence>
              {showViewers && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl rounded-t-2xl max-h-[55%] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={toggleViewers}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${panelMode === 'views' ? 'bg-white/15 text-white' : 'text-white/50'}`}
                      >
                        <Eye className="w-4 h-4" /> Vues {viewers.length > 0 ? `(${viewers.length})` : ''}
                      </button>
                      <button
                        onClick={openLikers}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${panelMode === 'likes' ? 'bg-white/15 text-white' : 'text-white/50'}`}
                      >
                        <Heart className="w-4 h-4" /> Likes {likers && likers.length > 0 ? `(${likers.length})` : ''}
                      </button>
                    </div>
                    <button aria-label="Fermer" onClick={() => setShowViewers(false)} className="p-1 text-white/50 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 py-2">
                    {panelMode === 'likes' ? (
                      likers === null ? (
                        <div className="flex justify-center py-6">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      ) : likers.length === 0 ? (
                        <p className="text-center text-sm text-white/40 py-6">Pas encore de like sur cette story</p>
                      ) : (
                        likers.map((u: any) => (
                          <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                            <img loading="lazy"
                              src={avatarThumb(u.profile_album_cover_url) || defaultAvatar(u.username || 'U')}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                              alt=""
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{u.display_name || u.username}</p>
                              <p className="text-xs text-white/40 truncate">@{u.username}</p>
                            </div>
                            <Heart className="w-4 h-4 text-red-400 fill-red-400 flex-shrink-0" />
                          </div>
                        ))
                      )
                    ) : loadingViewers ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : viewers.length === 0 ? (
                      <p className="text-center text-sm text-white/40 py-6">Personne n'a encore vu cette story</p>
                    ) : (
                      viewers.map((viewer: any) => (
                        <div key={viewer.id} className="flex items-center gap-3 px-4 py-2.5">
                          <img loading="lazy"
                            src={avatarThumb(viewer.profile_album_cover_url) || defaultAvatar(viewer.username || 'U')}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{viewer.display_name || viewer.username}</p>
                            <p className="text-xs text-white/40 truncate">@{viewer.username}</p>
                          </div>
                          {likers?.some((l: any) => l.id === viewer.id) && (
                            <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400 flex-shrink-0" />
                          )}
                          {viewer.viewed_at && (
                            <span className="text-[10px] text-white/30 flex-shrink-0">
                              {new Date(viewer.viewed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom actions */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5">
              <AnimatePresence>
                {sentNotice && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-3 mx-auto w-fit px-3 py-1.5 rounded-full bg-white/90 text-[#1E1440] text-xs font-bold"
                  >
                    Envoyé en message privé ✓
                  </motion.p>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showCommentInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mb-3 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Répondre en message privé…"
                      enterKeyHint="send"
                      className="flex-1 min-w-0 px-4 py-2.5 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); }
                        if (e.key === 'Escape') setShowCommentInput(false);
                      }}
                    />
                    <button
                      onClick={handleComment}
                      disabled={isSubmitting || !commentText.trim()}
                      className="p-2.5 bg-white/20 backdrop-blur-sm rounded-full text-white disabled:opacity-30 hover:bg-white/30 transition-colors flex-shrink-0"
                    >
                      {isSubmitting ? '…' : <Send className="w-4 h-4" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <button
                    onClick={toggleLike}
                    className={`p-2.5 rounded-full backdrop-blur-sm transition-all ${
                      isLiked ? 'bg-red-500/30 text-red-400' : 'bg-black/30 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {likeAnimations.map(anim => (
                      <motion.div
                        key={anim.id}
                        initial={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        animate={{ opacity: 0, scale: 1.8, y: -60, x: anim.x }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="absolute pointer-events-none"
                        style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
                      >
                        <Heart className="w-7 h-7 fill-red-400 text-red-400" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                {likeCount > 0 && (isOwner ? (
                  <button
                    onClick={openLikers}
                    title="Voir qui a liké"
                    className="text-xs text-white/90 font-semibold -ml-1 underline underline-offset-2 decoration-dotted px-1 py-1"
                  >{likeCount}</button>
                ) : (
                  <span className="text-xs text-white/70 font-semibold -ml-1">{likeCount}</span>
                ))}
                {/* On ne répond pas à sa propre story : la réponse part en DM à l'auteur. */}
                {!isOwner && <button
                  onClick={() => setShowCommentInput(!showCommentInput)}
                  className="p-2.5 rounded-full bg-black/30 text-white/80 hover:bg-white/10 backdrop-blur-sm transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>}
                {/* M4 : vues, en bas à droite, visibles par la propriétaire seulement. */}
                {isOwner && (
                  <button
                    onClick={toggleViewers}
                    aria-label="Voir qui a vu ta story"
                    className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-sm text-sm font-semibold transition-colors ${showViewers ? 'bg-white/25 text-white' : 'bg-black/35 text-white/90 hover:bg-white/15'}`}
                  >
                    <Eye className="w-4 h-4" /> {viewCount ?? '…'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
