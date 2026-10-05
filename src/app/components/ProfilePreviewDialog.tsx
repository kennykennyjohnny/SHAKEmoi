// Profil d'une autre personne (P1) : grand panneau presque plein écran sur
// téléphone, qui contient TOUT son fil (même grille que mon profil, chargée au
// fil du défilement). « Profil complet » l'agrandit en page entière.
// Règles d'accès : jamais de post privé ou de cercle (B2, B4), géré par la base.
//
// Q1 : en-tête lisible (texte blanc gras, bouton Message plein) ; on le ferme en
// le glissant vers le bas, comme les panneaux d'Instagram (seulement quand le
// contenu est déjà tout en haut), et avec le retour du téléphone (N2).
// Q5 : ce qu'on connaît déjà s'affiche tout de suite (avatar, nom, @), le reste
// arrive en UNE requête (get_profile_header), préchargée dès le toucher, et
// gardée une minute (rouvrir est instantané, puis rafraîchi en fond).
import { openStorySound, prefetchStorySound } from '../../lib/storySound';
import { X, UserPlus, UserCheck, ArrowLeft, Maximize2, MessageCircle, MoreHorizontal, Ban, Flag, Bug } from 'lucide-react';
import { blockUser, unblockUser, type BlockStatus } from '../../lib/moderation';
import { openReport, openBugReport } from '../../lib/appNav';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getUserProfile, followUser, followErrorMessage, unfollowUser } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { StoryViewerDialog } from './StoryViewerDialog';
import { ProfileGrid } from './ProfileGrid';
import { StreakBadge, primeStreak } from './Streak';
import { SuggestionsCarousel } from './SuggestionsCarousel';
import { tasteExplanation, type Taste } from '../../lib/social';
import { defaultAvatar, avatarThumb } from '../../lib/media';
import { useBackHandler } from '../../lib/navigation';
import { openConversation } from '../../lib/appNav';
import { FollowListSheet, MutualFollowersLine, type FollowListKind } from './FollowListSheet';
import { fetchProfileHeader, getSeed, peekProfileHeader, patchProfileHeader, seedProfile, type ProfileHeader } from '../../lib/profileCache';
import { tween, useDragToClose } from '../../lib/motion';

interface ProfilePreviewDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
  /** Visiteur sans compte : « Suivre » propose de se connecter / s'inscrire. */
  onRequireAuth?: (user: { id: string; username: string }) => void;
  /** Ouvrir directement en page complète. */
  startExpanded?: boolean;
  /** Au-dessus d'une story ouverte (N1). */
  elevated?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Petit bloc gris qui « respire » en attendant la donnée (jamais d'écran vide). */
const Skel = ({ className = '' }: { className?: string }) => <span className={`block rounded-md bg-purple-300/15 animate-pulse ${className}`} />;

export function ProfilePreviewDialog({ userId, username, onClose, onRequireAuth, startExpanded = false, elevated = false }: ProfilePreviewDialogProps) {
  const layer = elevated ? 'z-[80]' : 'z-50';
  const isId = UUID_RE.test(userId || '');
  const [expanded, setExpanded] = useState(startExpanded);
  const [me, setMe] = useState<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  // Q5 : ce qu'on sait déjà (post, liste touchée…) puis l'en-tête en cache.
  const seed = isId ? getSeed(userId) : null;
  const cached = isId ? peekProfileHeader(userId) : null;
  const [header, setHeader] = useState<ProfileHeader | null>(cached?.data || null);
  const [failed, setFailed] = useState(false);
  const profile: any = header?.profile || (seed?.username ? seed : null);
  const loaded = !!header;
  useBackHandler(true, onClose, profile?.username || username ? `/u/${encodeURIComponent(profile?.username || username)}` : undefined);
  const [activeStory, setActiveStory] = useState<any | null>(null);
  const [viewerList, setViewerList] = useState<any[]>([]);
  const [justFollowed, setJustFollowed] = useState(false);
  const [list, setList] = useState<FollowListKind | null>(null);
  const [menu, setMenu] = useState(false);
  const block: BlockStatus = (header?.block as BlockStatus) || 'none';
  const stats = { posts: header?.counts?.shakes ?? 0, followers: header?.counts?.followers ?? 0, following: header?.counts?.following ?? 0 };
  const isFollowingUser = !!header?.is_following;
  const taste: Taste | null = header?.taste || null;
  const stories = (header?.stories || []).map((s: any) => ({ ...s, user: profile }));
  const pinnedStories = (header?.pinned_stories || []).map((s: any) => ({ ...s, user: profile }));

  // Q1 : glisser vers le bas pour fermer.
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  useDragToClose({ panelRef, scrollRef, backdropRef, enabled: !expanded, onClose });

  const apply = (h: ProfileHeader | null) => {
    if (!h) { setFailed(true); return; }
    setFailed(false);
    if (h.streak && h.profile?.id) primeStreak(h.profile.id, h.streak);
    setHeader(h);
  };
  const load = async (force = false) => {
    try {
      if (isId) apply(await fetchProfileHeader(userId, force));
      else {
        const { data, error } = await supabase.rpc('get_profile_header', { p_username: (username || userId).toLowerCase() });
        if (error) throw error;
        if ((data as any)?.profile) seedProfile((data as any).profile);
        apply(data as ProfileHeader);
      }
    } catch {
      if (!header) setFailed(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      setMyId(data.session.user.id);
      const p = await getUserProfile(data.session.user.id);
      if (p) setMe({ ...p, musicService: p.preferred_streaming_app || p.preferred_platform });
    });
  }, []);

  useEffect(() => {
    // Déjà en cache et récent : rien à attendre. Un peu ancien : affiché tout
    // de suite, rafraîchi discrètement.
    if (cached?.fresh) { apply(cached.data); return; }
    load(!!cached);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocal = (patch: Partial<ProfileHeader>) => {
    setHeader((h) => (h ? { ...h, ...patch } : h));
    if (profile?.id) patchProfileHeader(profile.id, patch);
  };

  const toggleBlock = async () => {
    setMenu(false);
    if (!profile) return;
    if (block === 'i_blocked') {
      if (await unblockUser(profile.id)) load(true);
      return;
    }
    if (!confirm(`Bloquer @${profile.username} ? Vous ne verrez plus vos shakes, vos Shakes éphémères ni vos profils ; vous ne pourrez plus vous écrire ni vous suivre (vos abonnements mutuels sont retirés).`)) return;
    if (await blockUser(profile.id)) setLocal({ block: 'i_blocked', is_following: false });
    else alert('Impossible de bloquer pour l’instant. Réessaie.');
  };

  const handleFollowToggle = async () => {
    if (!profile || !header) return;
    if (onRequireAuth) { onRequireAuth({ id: profile.id, username: profile.username }); return; }
    const counts = header.counts || { shakes: 0, followers: 0, following: 0 };
    if (isFollowingUser) {
      const r = await unfollowUser(profile.id);
      if (!r.success) { alert(followErrorMessage(r.error)); return; }
      setLocal({ is_following: false, counts: { ...counts, followers: Math.max(0, counts.followers - 1) } });
    } else {
      const r = await followUser(profile.id);
      // Refusé (limite de 100, réseau…) : on le dit au lieu d'afficher « Abonné ».
      if (!r.success) { alert(followErrorMessage(r.error)); return; }
      setLocal({ is_following: true, counts: { ...counts, followers: counts.followers + 1 } });
      setJustFollowed(true);
    }
  };

  const isMe = !!myId && profile?.id === myId;
  const displayName = profile?.display_name || profile?.username || username;
  const avatar = avatarThumb(profile?.profile_album_cover_url) || defaultAvatar(profile?.username || username);

  // Panneau presque plein écran (téléphone) ou fenêtre haute (ordinateur) ;
  // « Profil complet » = toute la page.
  const panelClass = expanded
    ? 'w-full h-full bg-[#1E1440] text-white flex flex-col pointer-events-auto'
    : 'w-full h-[96dvh] sm:h-[88dvh] bg-[#1E1440] text-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-500/40 shadow-2xl shadow-black/60 flex flex-col pointer-events-auto overflow-hidden';

  const content = (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween()}
        className={`fixed inset-0 ${layer}`} onClick={onClose}>
        <div ref={backdropRef} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      </motion.div>
      <div className={`fixed inset-0 ${layer} flex items-end sm:items-center justify-center pointer-events-none`}>
      <motion.div
        initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
        transition={tween()}
        className={expanded ? 'w-full h-full' : 'w-full sm:max-w-lg'}
      >
      <div ref={panelRef} className={panelClass} role="dialog" aria-label={`Profil de @${profile?.username || username}`}>
        {/* Barre du haut (Q1 : texte blanc gras, sur un fond plein) */}
        <div data-drag-handle className="relative flex items-center gap-2 px-3 py-2.5 border-b border-purple-500/25 bg-[#1D0F3D] flex-shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
          {!expanded && <span aria-hidden className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 sm:hidden" />}
          <button aria-label={expanded ? 'Retour' : 'Fermer'} onClick={onClose} className="p-2 rounded-full text-white hover:bg-white/10">
            {expanded ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <p className="flex-1 min-w-0 font-extrabold text-white truncate">@{profile?.username || username}</p>
          {profile && loaded && !onRequireAuth && !isMe && (
            <div className="relative">
              <button aria-label="Plus d’options" onClick={() => setMenu(!menu)} className="p-2 rounded-full text-white hover:bg-white/10"><MoreHorizontal className="w-5 h-5" /></button>
              {menu && (
                <div className="absolute right-0 top-11 z-10 w-56 rounded-xl bg-[#2A1852] border border-purple-500/50 shadow-xl overflow-hidden">
                  <button onClick={toggleBlock} className="w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-purple-900/50 text-pink-200"><Ban className="w-4 h-4" /> {block === 'i_blocked' ? 'Débloquer' : 'Bloquer'} @{profile.username}</button>
                  <button onClick={() => { setMenu(false); openReport('user', profile.id); }} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-white hover:bg-purple-900/50"><Flag className="w-4 h-4" /> Signaler ce compte</button>
                  <button onClick={() => { setMenu(false); openBugReport(); }} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-white hover:bg-purple-900/50"><Bug className="w-4 h-4" /> Signaler un bug</button>
                </div>
              )}
            </div>
          )}
          {!expanded && profile && (
            <button onClick={() => setExpanded(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 text-xs font-bold text-white">
              <Maximize2 className="w-3.5 h-3.5" /> Profil complet
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className={expanded ? 'w-full max-w-2xl mx-auto' : ''}>
            {!profile && failed ? (
              <div className="py-16 text-center">
                <p className="text-purple-200">Profil introuvable</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold">Fermer</button>
              </div>
            ) : profile && block === 'blocked_me' ? (
              <div className="py-16 text-center px-6">
                <p className="text-lg font-semibold">Profil indisponible</p>
                <p className="text-sm text-purple-200 mt-1">Ce profil n'est pas accessible.</p>
              </div>
            ) : profile && block === 'i_blocked' ? (
              <div className="py-16 text-center px-6">
                <Ban className="w-10 h-10 text-pink-300 mx-auto mb-3" />
                <p className="text-lg font-semibold">Tu as bloqué @{profile.username}</p>
                <p className="text-sm text-purple-200 mt-1">Vous ne voyez plus vos contenus et ne pouvez plus vous écrire.</p>
                <button onClick={toggleBlock} className="mt-5 px-5 py-2 rounded-full bg-purple-700/60 text-sm font-semibold">Débloquer</button>
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    {profile
                      ? <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-500 flex-shrink-0" />
                      : <Skel className="w-20 h-20 !rounded-full flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      {profile ? (
                        <>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2 min-w-0">
                            <span className="truncate">{displayName}</span>
                            {loaded && <StreakBadge userId={profile.id} />}
                          </h2>
                          <p className="text-sm text-purple-200 mb-3">@{profile.username}</p>
                        </>
                      ) : (
                        <><Skel className="h-5 w-32 mb-2" /><Skel className="h-4 w-20 mb-3" /></>
                      )}
                      <div className="flex items-center gap-5">
                        {([['posts', 'Shakes', null], ['followers', 'Abonnés', 'followers'], ['following', 'Suivis', 'following']] as const).map(([k, label, kind], i) => (
                          <div key={k} className="flex items-center gap-5">
                            {i > 0 && <div className="w-px h-8 bg-purple-500/25" />}
                            <button disabled={!kind || !!onRequireAuth || !loaded} onClick={() => kind && setList(kind)} className="text-center hover:opacity-80 disabled:hover:opacity-100">
                              {loaded ? <p className="font-bold text-white text-lg leading-tight tabular-nums">{stats[k]}</p> : <Skel className="h-6 w-8 mx-auto mb-0.5" />}
                              <p className="text-[10px] text-purple-200 uppercase tracking-wider">{label}</p>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {header?.profile?.bio && <p className="text-sm text-purple-100 mt-3 leading-relaxed">{header.profile.bio}</p>}

                  {/* P3 : abonnés en commun (connecté seulement) */}
                  {profile && loaded && myId && !isMe && <MutualFollowersLine userId={profile.id} initial={header?.mutual ?? null} onOpen={() => setList('mutual')} />}

                  {/* Compatibilité musicale (P25), avec son explication. */}
                  {taste && !isMe && (
                    <div className="mt-3 p-2.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl border border-purple-500/25">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-purple-100">Compatibilité musicale</span>
                        {taste.status === 'ok'
                          ? <span className="text-sm font-bold text-pink-300">{taste.score} %</span>
                          : <span className="text-[11px] text-purple-200">Pas encore assez de sons</span>}
                      </div>
                      {taste.status === 'ok' && tasteExplanation(taste) && <p className="text-[11px] text-purple-100 mt-1">{tasteExplanation(taste)}</p>}
                      {taste.status === 'not_enough' && <p className="text-[11px] text-purple-200 mt-1">Il faut au moins 5 sons partagés chacun (toi : {taste.mine}, @{profile?.username} : {taste.theirs}).</p>}
                    </div>
                  )}

                  {!isMe && (
                    loaded ? (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={handleFollowToggle}
                          className={`flex-1 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm text-white ${
                            isFollowingUser ? 'bg-[#3A1F6E] border border-purple-400/50 hover:bg-[#4A2E7A]' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90'
                          }`}
                        >
                          {isFollowingUser ? <><UserCheck className="w-4 h-4" /> Abonné</> : <><UserPlus className="w-4 h-4" /> Suivre</>}
                        </button>
                        {!onRequireAuth && profile && (
                          <button
                            onClick={() => { onClose(); openConversation(profile.id); }}
                            className="px-4 py-2.5 rounded-xl bg-[#3A1F6E] border border-purple-400/50 hover:bg-[#4A2E7A] flex items-center gap-2 text-sm font-bold text-white"
                          >
                            <MessageCircle className="w-4 h-4" /> Message
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-4"><Skel className="flex-1 h-10 !rounded-xl" /><Skel className="w-28 h-10 !rounded-xl" /></div>
                    )
                  )}

                  {/* P18 : « Suis aussi… » juste après un abonnement. */}
                  {justFollowed && profile && <SuggestionsCarousel title="Suis aussi…" exclude={[profile.id]} compact className="mt-4" />}

                  {(stories.length > 0 || pinnedStories.length > 0) && (
                    <div className="mt-4">
                      <p className="text-[11px] text-purple-200 uppercase tracking-wider mb-2">Shakes éphémères</p>
                      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {stories.map((story: any) => (
                          <button key={story.id} onPointerDown={() => prefetchStorySound(story)} onClick={() => { openStorySound(story); setViewerList(stories); setActiveStory(story); }} className="flex-shrink-0 text-center w-16">
                            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400">
                              <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                                <img loading="lazy" src={avatarThumb(story.image_url, 256) || story.cover_url || avatar} className="w-full h-full rounded-full object-cover" alt="" />
                              </div>
                            </div>
                            <p className="text-[10px] text-purple-100 mt-1">En cours</p>
                          </button>
                        ))}
                        {pinnedStories.map((story: any) => (
                          <button key={story.id} onPointerDown={() => prefetchStorySound(story)} onClick={() => { openStorySound(story); setViewerList(pinnedStories); setActiveStory(story); }} className="flex-shrink-0 text-center w-16">
                            <div className="w-16 h-16 rounded-full p-[2px] bg-purple-700/50">
                              <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                                <img loading="lazy" src={avatarThumb(story.image_url, 256) || story.cover_url || avatar} className="w-full h-full rounded-full object-cover" alt="" />
                              </div>
                            </div>
                            <p className="text-[10px] text-purple-100 mt-1 truncate">{story.track_name || 'À la une'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tout le fil, comme sur mon profil (P1/P2). Lancé en même temps que l'en-tête. */}
                {(profile?.id || (isId && userId)) && <ProfileGrid userId={profile?.id || userId} currentUser={me} />}
              </>
            )}
          </div>
        </div>
      </div>
      </motion.div>
      </div>

      <AnimatePresence>
        {list && profile && (
          <FollowListSheet userId={profile.id} username={profile.username} kind={list} myId={me?.id} onClose={() => setList(null)} onCountsChanged={() => load(true)} />
        )}
      </AnimatePresence>

      <StoryViewerDialog
        open={!!activeStory}
        story={activeStory}
        onClose={() => setActiveStory(null)}
        currentUser={me}
        stories={viewerList}
        onNavigate={(s) => setActiveStory(s)}
      />
    </>
  );

  // Portail : au-dessus de tout, quel que soit l'endroit d'où on l'ouvre.
  return createPortal(content, document.body);
}
