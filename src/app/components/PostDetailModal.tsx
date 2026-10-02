// Post ouvert en grand (P2), avec toutes les actions.
//
// Q2 : ouvert depuis une liste (grille d'un profil, TOP…), on passe au post
// suivant / précédent DE LA MÊME LISTE en glissant à gauche / à droite (ou
// avec les flèches, ou les flèches du clavier). Trois posts sont montés côte à
// côte (précédent, affiché, suivant) : le suivant est déjà chargé, le passage
// est instantané. Au bout de la liste, ça résiste un peu (pas de boucle).
// Glisser vers le bas ferme le post : il suit le doigt et rétrécit, puis sa
// pochette revient se poser sur sa vignette ; l'ouverture fait l'inverse.
// La direction du geste est décidée dès les premiers pixels (pas de mélange).
// Q3 : même courbe et même durée que Messages ↔ Cercles (lib/motion).
import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatRelative } from '../../lib/dates';
import { X, Heart, MessageCircle, Send, Trash2, Share2, Music, Search, Repeat2, Flag, Pin, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { pinSong } from './PinnedSongs';
import { AnimatePresence } from 'motion/react';
import { getPostById, likePost, unlikePost, hasLikedPost, getPostComments, addComment, getMusicReactions, addMusicReaction, deleteComment, reshakePost, unreshakePost, hasReshaked } from '../../lib/database';
import { ReshakeDialog } from './ReshakeDialog';
import { SendSongDialog } from './SendSongDialog';
import { getPlatformUrl } from '../../lib/odesli';
import { spotify } from '../../lib/spotify';
import { postLink } from '../../lib/links';
import { SongShareSheet } from './SongShareSheet';
import { openExternal } from '../../lib/platforms';
import { LikersSheet } from './LikersSheet';
import { defaultAvatar, avatarThumb, thumb } from '../../lib/media';
import { SongCover } from './SongCover';
import { MyAppLogo } from './PlatformLogo';
import { useBackHandler } from '../../lib/navigation';
import { openProfile, openReport } from '../../lib/appNav';
import { profileProps } from '../../lib/profileCache';
import { stopPreview } from '../../lib/preview';
import { EASE, duration, transitionCss } from '../../lib/motion';

interface PostDetailModalProps {
  postId: string;
  currentUser: any;
  /** `lastId` : le dernier post affiché (la grille s'y repositionne). */
  onClose: (lastId?: string) => void;
  onDeletePost?: (postId: string) => void;
  /** Like / reshake faits ici : l'écran d'en dessous (profil, TOP…) suit. */
  onUpdated?: (postId: string, patch: { likes_count?: number; reshaked?: boolean }) => void;
  /** Q2 : ids de la liste d'où on vient, dans l'ordre affiché. */
  list?: string[];
  /** Q2 : on approche du bout de la liste chargée → charger la suite. */
  onNeedMore?: () => void;
  /** Q2 : le post affiché change (la grille garde sa vignette à l'écran). */
  onIndexChange?: (id: string) => void;
  /** Q2 : position de la vignette du post (animations ouverture / fermeture). */
  originRect?: (id: string) => DOMRect | null;
}

// ---------- Données d'un post (avec un petit cache : revenir est instantané) ----------
interface PostData { post: any; liked: boolean; reshaked: boolean; comments: any[]; reactions: any[]; at: number }
const cache = new Map<string, PostData>();
const inflight = new Map<string, Promise<PostData | null>>();

/** Un reshake affiche le post d'origine (mêmes chiffres que dans le fil). */
function loadPostData(id: string, force = false): Promise<PostData | null> {
  const hit = cache.get(id);
  if (!force && hit && Date.now() - hit.at < 60_000) return Promise.resolve(hit);
  const running = inflight.get(id);
  if (running && !force) return running;
  const p = (async () => {
    let post = await getPostById(id);
    if (post?.is_reshake && post.original_post_id) post = await getPostById(post.original_post_id);
    if (!post) return null;
    const pid = post.id;
    const [liked, reshaked, comments, reactions] = await Promise.all([
      hasLikedPost(pid).catch(() => false), hasReshaked(pid).catch(() => false),
      getPostComments(pid).catch(() => []), getMusicReactions(pid).catch(() => []),
    ]);
    const d: PostData = { post, liked, reshaked, comments, reactions, at: Date.now() };
    cache.set(id, d);
    if (pid !== id) cache.set(pid, d);
    return d;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

export function PostDetailModal({ postId, currentUser, onClose, onDeletePost, onUpdated, list, onNeedMore, onIndexChange, originRect }: PostDetailModalProps) {
  const ids = list && list.length ? list : [postId];
  const [index, setIndex] = useState(() => Math.max(0, ids.indexOf(postId)));
  const idx = Math.min(index, ids.length - 1);
  const currentId = ids[idx] ?? postId;
  const lastRef = useRef(currentId);
  lastRef.current = currentId;
  const hasPrev = idx > 0;
  const hasNext = idx < ids.length - 1;

  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  // ---------- Fermeture : la pochette revient se poser sur sa vignette ----------
  const finish = () => onClose(lastRef.current);
  const closeAnimated = () => {
    if (closing.current) return;
    closing.current = true;
    stopPreview();
    const card = cardRef.current;
    const bd = backdropRef.current;
    const slot = trackRef.current?.children[1] as HTMLElement | undefined;
    const coverEl = slot?.querySelector('[data-post-cover]') as HTMLElement | null;
    const coverUrl = slot?.getAttribute('data-cover') || '';
    const to = originRect?.(lastRef.current);
    const d = duration();
    if (bd) { bd.style.transition = transitionCss('opacity'); bd.style.opacity = '0'; }
    if (card && coverEl && coverUrl && to && to.width > 0) {
      const from = coverEl.getBoundingClientRect();
      const ghost = document.createElement('img');
      ghost.src = thumb(coverUrl, 600) || coverUrl;
      Object.assign(ghost.style, {
        position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
        objectFit: 'cover', zIndex: '70', borderRadius: '0px', transformOrigin: '0 0', pointerEvents: 'none',
        transition: `transform ${d}ms ${EASE}, border-radius ${d}ms ${EASE}`,
      } as CSSStyleDeclaration);
      document.body.appendChild(ghost);
      card.style.transition = `opacity ${Math.round(d * 0.5)}ms ease-out`;
      card.style.opacity = '0';
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})`;
        ghost.style.borderRadius = `${8 * (from.width / to.width)}px`;
      });
      window.setTimeout(() => { finish(); window.setTimeout(() => ghost.remove(), 60); }, d);
      return;
    }
    if (card) {
      card.style.transition = transitionCss('transform, opacity');
      card.style.transform = 'translate3d(0, 40px, 0) scale(.96)';
      card.style.opacity = '0';
    }
    window.setTimeout(finish, d);
  };

  // Retour du téléphone : ferme le post ; adresse /post/<id> (N2, Q6).
  useBackHandler(true, closeAnimated, `/post/${currentId}`);

  // ---------- Ouverture : le post s'agrandit depuis sa vignette ----------
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const to = originRect?.(postId);
    const base = card.getBoundingClientRect();
    if (to && to.width > 0 && base.width > 0) {
      const s = to.width / base.width;
      const tx = to.left + to.width / 2 - (base.left + base.width / 2);
      const ty = to.top + to.height / 2 - (base.top + base.height / 2);
      card.style.transition = 'none';
      card.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
      card.style.opacity = '0';
    } else {
      card.style.transition = 'none';
      card.style.transform = 'translate3d(0, 24px, 0) scale(.96)';
      card.style.opacity = '0';
    }
    const bd = backdropRef.current;
    if (bd) { bd.style.transition = 'none'; bd.style.opacity = '0'; }
    void card.offsetWidth; // départ appliqué avant l'animation
    card.style.transition = transitionCss('transform, opacity');
    card.style.transform = '';
    card.style.opacity = '1';
    if (bd) { bd.style.transition = transitionCss('opacity'); bd.style.opacity = '1'; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Passage au post suivant / précédent ----------
  const setTrack = (offsetPx: number, animate: boolean) => {
    const t = trackRef.current;
    if (!t) return;
    t.style.transition = animate ? transitionCss('transform') : 'none';
    t.style.transform = `translate3d(calc(-100% + ${offsetPx}px), 0, 0)`;
  };
  const go = (dir: 1 | -1) => {
    if ((dir === 1 && !hasNext) || (dir === -1 && !hasPrev)) { setTrack(0, true); return; }
    const w = trackRef.current?.offsetWidth || window.innerWidth;
    setTrack(-dir * w, true);
    window.setTimeout(() => setIndex((i) => Math.min(ids.length - 1, Math.max(0, i + dir))), duration());
  };
  // Nouveau post affiché : la piste revient au centre (sans animation, les
  // posts ont déjà changé de place), le son du post quitté s'arrête (M2 :
  // le nouveau ne démarre pas tout seul), la grille suit, la suite se charge.
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    setTrack(0, false);
    if (firstRender.current) { firstRender.current = false; } else { stopPreview(); onIndexChange?.(currentId); }
    if (onNeedMore && idx >= ids.length - 3) onNeedMore();
    // Préchargement un cran plus loin que les voisins montés.
    [ids[idx + 2], ids[idx - 2]].forEach((x) => { if (x) loadPostData(x).catch(() => {}); });
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clavier (ordinateur) : flèches, Échap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') closeAnimated();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- Gestes : gauche/droite = post voisin, bas = fermer ----------
  const gestureRef = useRef({ hasPrev, hasNext, go, closeAnimated });
  gestureRef.current = { hasPrev, hasNext, go, closeAnimated };
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let st: { x: number; y: number; t: number; canClose: boolean; lock: 'h' | 'v' | 'none' | null; dx: number; dy: number } | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1 || closing.current) { st = null; return; }
      const t = e.touches[0];
      const target = e.target as Element;
      if (target.closest('input, textarea, [data-no-swipe]')) { st = null; return; }
      const slot = trackRef.current?.children[1];
      const scroller = slot?.querySelector('[data-post-scroll]') as HTMLElement | null;
      const onCover = !!target.closest('[data-post-cover]');
      st = { x: t.clientX, y: t.clientY, t: Date.now(), canClose: onCover || !scroller || scroller.scrollTop <= 0, lock: null, dx: 0, dy: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      if (!st.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) st.lock = 'h';
        else if (dy > 0 && st.canClose) st.lock = 'v';
        else st.lock = 'none';
      }
      if (st.lock === 'none') return;
      e.preventDefault();
      st.dx = dx; st.dy = dy;
      const g = gestureRef.current;
      if (st.lock === 'h') {
        const atEdge = (dx > 0 && !g.hasPrev) || (dx < 0 && !g.hasNext);
        setTrack(atEdge ? dx * 0.25 : dx, false);
      } else {
        const h = window.innerHeight;
        const y = Math.max(0, dy);
        const scale = 1 - Math.min(0.25, (y / h) * 0.45);
        card.style.transition = 'none';
        card.style.transform = `translate3d(${dx * 0.6}px, ${y}px, 0) scale(${scale})`;
        const bd = backdropRef.current;
        if (bd) { bd.style.transition = 'none'; bd.style.opacity = String(Math.max(0, 1 - (y / h) * 1.6)); }
      }
    };
    const onEnd = (e: TouchEvent) => {
      const s = st;
      st = null;
      if (!s || !s.lock || s.lock === 'none') return;
      const g = gestureRef.current;
      // Geste interrompu (appel, notification…) : tout revient en place.
      if (e.type === 'touchcancel') { s.dx = 0; s.dy = 0; }
      const v = (s.lock === 'h' ? Math.abs(s.dx) : s.dy) / Math.max(1, Date.now() - s.t);
      if (s.lock === 'h') {
        const w = trackRef.current?.offsetWidth || window.innerWidth;
        const far = Math.abs(s.dx) > w * 0.22 || (v > 0.5 && Math.abs(s.dx) > 30);
        if (far && s.dx < 0 && g.hasNext) g.go(1);
        else if (far && s.dx > 0 && g.hasPrev) g.go(-1);
        else setTrack(0, true);
        return;
      }
      if (s.dy > Math.min(140, window.innerHeight * 0.2) || (v > 0.6 && s.dy > 30)) { g.closeAnimated(); return; }
      // Pas assez loin : retour en place, avec un petit rebond.
      card.style.transition = `transform ${duration() + 80}ms cubic-bezier(.34,1.56,.64,1)`;
      card.style.transform = '';
      const bd = backdropRef.current;
      if (bd) { bd.style.transition = transitionCss('opacity'); bd.style.opacity = '1'; }
    };
    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: false });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('touchcancel', onEnd);
    return () => {
      card.removeEventListener('touchstart', onStart);
      card.removeEventListener('touchmove', onMove);
      card.removeEventListener('touchend', onEnd);
      card.removeEventListener('touchcancel', onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slots: (string | null)[] = [ids[idx - 1] ?? null, currentId, ids[idx + 1] ?? null];
  const multi = ids.length > 1;

  return (
    <div className="fixed inset-0 z-50">
      <div ref={backdropRef} className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={closeAnimated} />
      <div className="absolute inset-0 flex items-center justify-center sm:p-4 pointer-events-none">
        <div ref={cardRef} onClick={(e) => e.stopPropagation()}
          className="relative pointer-events-auto bg-[#1D0F3D] w-full h-full sm:h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:border border-purple-500/30 overflow-hidden will-change-transform"
          role="dialog" aria-label="Shake">
          <div ref={trackRef} className="flex h-full" style={{ transform: 'translate3d(-100%, 0, 0)' }}>
            {slots.map((id, i) => (
              <div key={id || `vide-${i}`} className="w-full h-full flex-shrink-0" aria-hidden={i !== 1}
                {...(i !== 1 ? ({ inert: '' } as any) : {})}>
                {id && (
                  <PostBody postId={id} active={i === 1} currentUser={currentUser}
                    onClose={closeAnimated} onDeletePost={onDeletePost} onUpdated={onUpdated} />
                )}
              </div>
            ))}
          </div>
          {/* Flèches : discrètes sur téléphone, plus visibles sur ordinateur. */}
          {multi && hasPrev && (
            <button data-no-swipe aria-label="Shake précédent" onClick={() => go(-1)}
              className="absolute left-1.5 sm:left-2 top-[38%] -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/35 sm:bg-black/55 text-white/80 sm:text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70">
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          {multi && hasNext && (
            <button data-no-swipe aria-label="Shake suivant" onClick={() => go(1)}
              className="absolute right-1.5 sm:right-2 top-[38%] -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/35 sm:bg-black/55 text-white/80 sm:text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70">
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Les fenêtres ouvertes depuis un post sortent de la piste animée. */
const Layer = ({ children }: { children: ReactNode }) => createPortal(children, document.body);

function PostBody({ postId, active, currentUser, onClose, onDeletePost, onUpdated }: {
  postId: string; active: boolean; currentUser: any; onClose: () => void;
  onDeletePost?: (postId: string) => void;
  onUpdated?: (postId: string, patch: { likes_count?: number; reshaked?: boolean }) => void;
}) {
  const initial = cache.get(postId);
  const [post, setPost] = useState<any>(initial?.post || null);
  const [loading, setLoading] = useState(!initial);
  const [missing, setMissing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [isLiked, setIsLiked] = useState(!!initial?.liked);
  const [likeCount, setLikeCount] = useState(initial?.post?.likes_count || 0);
  // Reshake (P2) : un par personne, jamais le sien, annulable (F1).
  const [reshaked, setReshaked] = useState(!!initial?.reshaked);
  const [reshakeCount, setReshakeCount] = useState(initial?.post?.reshakes_count || 0);
  const [showReshake, setShowReshake] = useState(false);
  const [reshakeNotice, setReshakeNotice] = useState<string | null>(null);
  const [sendTrack, setSendTrack] = useState<any>(null);

  // Comments & music reactions
  const [tab, setTab] = useState<'comments' | 'music'>('comments');
  const [comments, setComments] = useState<any[]>(initial?.comments || []);
  const [musicReactions, setMusicReactions] = useState<any[]>(initial?.reactions || []);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  // Music reaction states
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<any[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [musicComment, setMusicComment] = useState('');
  const [musicSending, setMusicSending] = useState(false);

  const apply = (d: PostData | null) => {
    if (!d) { setMissing(true); setLoading(false); return; }
    setPost(d.post);
    setLikeCount(d.post.likes_count || d.post.likes || 0);
    setReshakeCount(d.post.reshakes_count || 0);
    setIsLiked(d.liked);
    setReshaked(d.reshaked);
    setComments(d.comments);
    setMusicReactions(d.reactions);
    setLoading(false);
  };
  useEffect(() => {
    let off = false;
    loadPostData(postId).then((d) => { if (!off) apply(d); }).catch(() => { if (!off) { setMissing(true); setLoading(false); } });
    return () => { off = true; };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Revenu à l'écran : les chiffres sont relus (ils ont pu bouger).
  useEffect(() => {
    if (!active || !initial || Date.now() - initial.at < 5_000) return;
    let off = false;
    loadPostData(postId, true).then((d) => { if (!off && d) apply(d); }).catch(() => {});
    return () => { off = true; };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const pid = post?.id || postId;
  const remember = (patch: Partial<PostData>) => { const c = cache.get(postId); if (c) cache.set(postId, { ...c, ...patch }); };

  useEffect(() => {
    if (musicQuery.length < 2) { setMusicResults([]); return; }
    const t = setTimeout(async () => {
      setMusicSearching(true);
      try { setMusicResults(await spotify.searchTracks(musicQuery)); } catch {}
      setMusicSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [musicQuery]);

  const loadComments = async () => {
    try { const c = await getPostComments(pid); setComments(c); remember({ comments: c }); } catch {}
  };
  const loadMusicReactions = async () => {
    try { const r = await getMusicReactions(pid); setMusicReactions(r); remember({ reactions: r }); } catch {}
  };

  // Like optimiste (F4) : affiché tout de suite, annulé si le serveur refuse.
  const likeBusyRef = useRef(false);
  const toggleLike = async () => {
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;
    const next = !isLiked;
    const count = Math.max(0, likeCount + (next ? 1 : -1));
    setIsLiked(next);
    setLikeCount(count);
    const r = next ? await likePost(pid) : await unlikePost(pid);
    if (!r.success) {
      setIsLiked(!next);
      setLikeCount(likeCount);
    } else {
      remember({ liked: next, post: { ...post, likes_count: count } });
      onUpdated?.(pid, { likes_count: count });
    }
    likeBusyRef.current = false;
  };

  const notice = (text: string) => { setReshakeNotice(text); setTimeout(() => setReshakeNotice(null), 3000); };
  const handleReshakeButton = async () => {
    if (isOwner) { notice('C’est ton shake : partage-le plutôt avec le bouton Partager.'); return; }
    if (!reshaked) { setShowReshake(true); return; }
    setReshaked(false);
    setReshakeCount((c: number) => Math.max(0, c - 1));
    const r = await unreshakePost(pid);
    if (!r.success) { setReshaked(true); setReshakeCount((c: number) => c + 1); notice('Impossible d’annuler le reshake. Réessaie.'); return; }
    remember({ reshaked: false });
    onUpdated?.(pid, { reshaked: false });
  };
  const confirmReshake = async (comment?: string) => {
    const r = await reshakePost(pid, comment);
    if (!r.success) { notice(r.error || 'Le reshake n’a pas marché. Réessaie.'); return; }
    setReshaked(true);
    setReshakeCount((c: number) => c + 1);
    remember({ reshaked: true });
    onUpdated?.(pid, { reshaked: true });
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const result = await addComment(pid, newComment.trim());
      if (result.success) {
        setNewComment('');
        await loadComments();
      } else {
        alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
      }
    } catch {
      alert("Ton commentaire n'est pas parti. Vérifie ta connexion et réessaie.");
    }
    setSending(false);
  };

  const handleSendMusicReaction = async (track: any) => {
    setMusicSending(true);
    try {
      const r = await addMusicReaction(pid, track, musicComment);
      if (r.success) { setSelectedTrack(null); setMusicComment(''); setMusicQuery(''); setMusicResults([]); await loadMusicReactions(); }
    } catch {}
    setMusicSending(false);
  };

  const openInMusicApp = () => {
    if (!post) return;
    const url = getPlatformUrl({
      spotify_url: post.spotify_url,
      apple_music_url: post.apple_music_url,
      deezer_url: post.deezer_url,
      youtube_url: post.youtube_url,
      youtube_music_url: post.youtube_music_url,
      tidal_url: post.tidal_url,
      odesli_page_url: post.odesli_page_url,
    }, currentUser?.musicService || 'spotify', { title: post.track_name, artist: post.artist });
    if (url) openExternal(url);
  };

  const openReactionInApp = (r: any) => {
    const url = getPlatformUrl({ spotify_url: r.spotify_url, apple_music_url: r.apple_music_url, deezer_url: r.deezer_url, youtube_url: r.youtube_url, youtube_music_url: r.youtube_music_url, tidal_url: r.tidal_url, odesli_page_url: r.odesli_page_url }, currentUser?.musicService || 'spotify', { title: r.track_name, artist: r.artist });
    if (url) openExternal(url);
  };

  // Même format de date partout (lib/dates).
  const formatTime = (ts: string) => formatRelative(ts);

  const trackId = post?.track_id || (post?.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;
  const coverUrl = post?.cover_url || post?.track_cover_url;
  const userName = post?.user?.display_name || post?.user?.username || '';
  const avatar = avatarThumb(post?.user?.profile_album_cover_url) || defaultAvatar(post?.user?.username || 'U');
  const isOwner = currentUser?.id === post?.user_id || currentUser?.id === post?.user?.id;

  const closeBtn = (
    <button aria-label="Fermer" onClick={onClose} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
      <X className="w-6 h-6 text-purple-200" />
    </button>
  );

  // Squelette (jamais d'écran vide pendant le chargement).
  if (loading) return (
    <div className="h-full flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-purple-500/20">
        <span className="w-10 h-10 rounded-full bg-purple-300/15 animate-pulse" />
        <span className="flex-1"><span className="block h-4 w-28 rounded bg-purple-300/15 animate-pulse mb-1.5" /><span className="block h-3 w-16 rounded bg-purple-300/15 animate-pulse" /></span>
        {closeBtn}
      </div>
      <div className="w-full aspect-square bg-purple-300/10 animate-pulse" />
      <div className="px-4 pt-3"><span className="block h-5 w-48 rounded bg-purple-300/15 animate-pulse mb-2" /><span className="block h-4 w-28 rounded bg-purple-300/15 animate-pulse" /></div>
    </div>
  );

  if (missing || !post) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-purple-100">Ce shake n’existe plus (ou n’est pas visible pour toi).</p>
      <button onClick={onClose} className="px-4 py-2 rounded-full bg-purple-700/60 text-sm font-semibold">Fermer</button>
    </div>
  );

  return (
    <div className="h-full flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0" data-cover={coverUrl || ''}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-purple-500/20 flex items-center gap-3 flex-shrink-0">
          {/* L'auteur : ouvre son profil par-dessus (le retour ramène ici). */}
          <button {...profileProps({ ...post.user, id: post.user_id || post.user?.id })} onClick={() => openProfile(post.user_id || post.user?.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <img loading="lazy" src={avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-700/30" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">{userName}</p>
              <p className="text-xs text-purple-200">@{post.user?.username}</p>
            </div>
          </button>

          {!isOwner && currentUser && (
            <button aria-label="Signaler ce shake" onClick={() => openReport('post', post.id)} className="p-2 hover:bg-purple-900/40 rounded-full transition-colors">
              <Flag className="w-4 h-4 text-purple-200" />
            </button>
          )}
          <button aria-label="Partager"
            onClick={() => setShowShare(true)}
            className="p-2 hover:bg-purple-900/40 rounded-full transition-colors"
          >
            <Share2 className="w-5 h-5 text-purple-200" />
          </button>
          {showShare && (
            <SongShareSheet
              song={{ title: post.track_name, artist: post.artist, cover: post.cover_url, previewUrl: post.preview_url }}
              by={currentUser?.username}
              link={postLink(post.id)}
              onClose={() => setShowShare(false)}
            />
          )}
          {closeBtn}
        </div>

        {/* Scrollable content */}
        <div data-post-scroll className="flex-1 overflow-y-auto overscroll-contain">
          {/* Cover */}
          {coverUrl && (
            // M2 : la grande pochette lance l'extrait dans notre lecteur (jamais tout seul).
            <div data-post-cover>
              <SongCover
                songKey={`post-${post.id}`}
                title={post.track_name} artist={post.artist} cover={coverUrl}
                previewUrl={post.preview_url} spotifyId={trackId} spotifyUrl={post.spotify_url}
                className="w-full aspect-square" rounded="rounded-none" iconSize="lg"
              />
            </div>
          )}

          {/* Track info */}
          <div className="px-4 pt-3">
            <h3 className="font-bold text-lg text-white truncate">{post.track_name}</h3>
            <p className="text-sm text-purple-200 truncate">{post.artist}</p>
          </div>

          {/* Caption */}
          {post.text && (
            <div className="px-4 pt-2">
              <p className="text-sm text-purple-100">{post.text}</p>
            </div>
          )}

          {/* Action bar */}
          <div className="px-4 py-3 flex items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <button onClick={toggleLike} aria-label={isLiked ? 'Retirer le like' : 'Liker'} className="group">
                <Heart className={`w-6 h-6 transition-all ${isLiked ? 'text-pink-500 fill-pink-500' : 'text-purple-200 group-hover:text-pink-500'}`} />
              </button>
              {isOwner && likeCount > 0 ? (
                <button
                  onClick={() => setShowLikers(true)}
                  title="Voir qui a liké"
                  className="text-sm font-medium text-pink-300 underline underline-offset-2 decoration-dotted px-1 -mx-1 py-1"
                >{likeCount}</button>
              ) : (
                <span className={`text-sm font-medium ${isLiked ? 'text-pink-400' : 'text-purple-200'}`}>{likeCount}</span>
              )}
            </div>
            {showLikers && <LikersSheet postId={post.id} onClose={() => setShowLikers(false)} />}

            <button onClick={() => setTab('comments')} className="flex items-center gap-1.5 group">
              <MessageCircle className="w-6 h-6 text-purple-200 group-hover:text-fuchsia-400 transition-colors" />
              {/* Texte + réponses en musique (O3), comme dans le fil. */}
              <span className="text-sm font-medium text-purple-200">{comments.length + musicReactions.length}</span>
            </button>

            <button
              onClick={handleReshakeButton}
              aria-label={reshaked ? 'Annuler le reshake' : 'Reshaker'}
              aria-pressed={reshaked}
              className={`flex items-center gap-1.5 group ${isOwner ? 'opacity-40' : ''}`}
            >
              <Repeat2 className={`w-6 h-6 transition-colors ${reshaked ? 'text-fuchsia-400' : 'text-purple-200 group-hover:text-fuchsia-400'}`} />
              <span className={`text-sm font-medium ${reshaked ? 'text-fuchsia-400' : 'text-purple-200'}`}>{reshakeCount}</span>
            </button>

            <button
              onClick={() => setSendTrack({ id: post.track_id, title: post.track_name, artist: post.artist, coverUrl: post.cover_url, spotifyUrl: post.spotify_url, previewUrl: post.preview_url })}
              aria-label="Envoyer à un ami"
              className="p-1 group"
            >
              <Send className="w-5 h-5 text-purple-200 group-hover:text-fuchsia-400 transition-colors" />
            </button>

            <button onClick={openInMusicApp} className="flex items-center gap-1.5 group ml-auto px-3 py-1.5 rounded-full bg-fuchsia-500/15 hover:bg-fuchsia-500/25 transition-colors">
              <MyAppLogo className="w-4 h-4 text-fuchsia-300" />
              <span className="text-xs font-semibold text-fuchsia-200">Écouter</span>
            </button>

            {isOwner && (
              <button aria-label="Épingler sur mon profil" title="Épingler sur mon profil"
                onClick={async () => { const err = await pinSong(null, post); notice(err || 'Épinglé sur ton profil 📌'); }}
                className="p-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 rounded-lg transition-colors">
                <Pin className="w-4 h-4 text-fuchsia-300" />
              </button>
            )}
            {isOwner && onDeletePost && (
              <button aria-label="Supprimer"
                onClick={() => { if (confirm('Supprimer ce shake ?')) { onDeletePost(post.id); onClose(); } }}
                className="p-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-pink-400" />
              </button>
            )}
          </div>

          {reshakeNotice && <p className="mx-4 mb-2 text-xs text-pink-200 bg-pink-500/10 border border-pink-500/20 rounded-lg px-3 py-2">{reshakeNotice}</p>}

          {/* Tabs: Comments / Music reactions */}
          <div className="px-4 border-t border-purple-500/20">
            <div className="flex items-center gap-4 py-2">
              <button
                onClick={() => setTab('comments')}
                className={`text-sm font-bold transition-colors ${tab === 'comments' ? 'text-white' : 'text-purple-200 hover:text-white'}`}
              >
                Commentaires ({comments.length})
              </button>
              <button
                onClick={() => setTab('music')}
                className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${tab === 'music' ? 'text-pink-300' : 'text-purple-200 hover:text-white'}`}
              >
                <Music className="w-4 h-4" />
                Sons ({musicReactions.length})
              </button>
            </div>
          </div>

          {tab === 'comments' ? (
            <div className="px-4 pb-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-purple-200 py-4 text-sm">Aucun commentaire</p>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2.5">
                    <button {...profileProps({ ...c.user, id: c.user_id || c.user?.id })} onClick={() => openProfile(c.user_id || c.user?.id)} aria-label={`Profil de @${c.user?.username || ''}`} className="flex-shrink-0 self-start">
                      <img loading="lazy" src={avatarThumb(c.user?.profile_album_cover_url) || defaultAvatar(c.user?.username || 'U')} alt="" className="w-7 h-7 rounded-full object-cover" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <button {...profileProps({ ...c.user, id: c.user_id || c.user?.id })} onClick={() => openProfile(c.user_id || c.user?.id)} className="font-semibold text-xs text-white hover:underline">@{c.user?.username || 'inconnu'}</button>
                        <span className="text-[10px] text-purple-300/85">{formatTime(c.created_at)}</span>
                        {currentUser?.id && c.user_id !== currentUser.id && (
                          <button onClick={() => openReport('comment', c.id)} aria-label="Signaler le commentaire" className="ml-auto p-1 text-purple-300/85 hover:text-pink-300">
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                        {currentUser?.id && (c.user_id === currentUser.id || isOwner) && (
                          <button
                            onClick={async () => {
                              const before = comments;
                              setComments(prev => prev.filter((x: any) => x.id !== c.id));
                              const r = await deleteComment(c.id);
                              if (!r.success) setComments(before);
                              else remember({ comments: before.filter((x: any) => x.id !== c.id) });
                            }}
                            aria-label="Supprimer le commentaire"
                            className="ml-auto p-1 text-purple-300/85 hover:text-pink-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-purple-100">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 space-y-3">
              {musicReactions.map(r => (
                  <div key={r.id} className="bg-purple-950/30 rounded-xl border border-purple-800/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button {...profileProps({ ...r.user, id: r.user_id || r.user?.id })} onClick={() => openProfile(r.user_id || r.user?.id)} className="flex items-center gap-2">
                        <img loading="lazy" src={avatarThumb(r.user?.profile_album_cover_url) || defaultAvatar(r.user?.username)} className="w-6 h-6 rounded-full object-cover" alt="" />
                        <span className="text-xs font-medium hover:underline">@{r.user?.username}</span>
                      </button>
                      {r.text && <span className="text-xs text-purple-200 ml-1">"{r.text}"</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      <SongCover songKey={`reaction-${r.id}`} title={r.track_name} artist={r.artist} cover={r.cover_url} previewUrl={r.preview_url} spotifyId={r.track_id} spotifyUrl={r.spotify_url} className="w-10 h-10" rounded="rounded-md" iconSize="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.track_name}</p>
                        <p className="text-xs text-purple-200 truncate">{r.artist}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); openReactionInApp(r); }} aria-label="Ouvrir dans mon appli de musique" className="p-1.5 rounded-full bg-purple-600/10 hover:bg-purple-600/20">
                        <MyAppLogo className="w-3.5 h-3.5 text-purple-300" />
                      </button>
                    </div>
                  </div>
              ))}
              {musicReactions.length === 0 && <p className="text-center text-purple-200 py-4 text-sm">Aucune réaction musicale</p>}

              {/* Add music reaction */}
              <div className="border-t border-purple-800/20 pt-3">
                <p className="text-sm font-medium text-purple-100 mb-2">Réponds avec un son</p>
                {!selectedTrack ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/80" />
                      <input type="text" value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Chercher un morceau..." className="w-full pl-9 pr-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-300/70 focus:outline-none focus:border-purple-500" />
                    </div>
                    {musicSearching && <Loader2 className="w-4 h-4 text-purple-400 animate-spin mx-auto my-2" />}
                    {musicResults.slice(0, 5).map(t => (
                      <button key={t.id} onClick={() => setSelectedTrack(t)} className="w-full flex items-center gap-2 p-2 hover:bg-purple-900/30 rounded-lg mt-1">
                        <img loading="lazy" src={t.cover} className="w-9 h-9 rounded-md object-cover" alt="" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-purple-200 truncate">{t.artist}</p>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center bg-purple-950/40 rounded-lg p-2 border border-pink-500/30">
                      <img loading="lazy" src={selectedTrack.cover} className="w-10 h-10 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedTrack.name}</p>
                        <p className="text-xs text-purple-200 truncate">{selectedTrack.artist}</p>
                      </div>
                      <button aria-label="Retirer le son" onClick={() => setSelectedTrack(null)} className="text-purple-200 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <input type="text" value={musicComment} onChange={e => setMusicComment(e.target.value)} placeholder="Commentaire (optionnel)" className="w-full px-3 py-2 bg-purple-950/30 border border-purple-800/30 rounded-lg text-sm text-white placeholder-purple-300/70 focus:outline-none focus:border-pink-500" maxLength={200} />
                    <button onClick={() => handleSendMusicReaction(selectedTrack)} disabled={musicSending} className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {musicSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer la réaction</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comment input (always visible when in comments tab) */}
        {tab === 'comments' && (
          <div className="px-4 py-3 border-t border-purple-500/25 flex items-center gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              placeholder="Écrire un commentaire..."
              enterKeyHint="send"
              className="flex-1 min-w-0 bg-purple-950/40 border border-purple-800/30 rounded-full px-4 py-2 text-sm text-white placeholder-purple-300/70 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              aria-label="Envoyer le commentaire"
              className="flex-shrink-0 p-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 rounded-full transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      {active && (
        <Layer>
          {showReshake && (
            <ReshakeDialog
              shake={{ track: { coverUrl: post.cover_url, title: post.track_name, artist: post.artist }, user: { username: post.user?.username }, caption: post.text }}
              onClose={() => setShowReshake(false)}
              onConfirm={confirmReshake}
            />
          )}
          <AnimatePresence>
            {sendTrack && <SendSongDialog track={sendTrack} onClose={() => setSendTrack(null)} />}
          </AnimatePresence>
        </Layer>
      )}
    </div>
  );
}
