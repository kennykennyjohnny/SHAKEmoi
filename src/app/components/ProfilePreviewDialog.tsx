// Profil d'une autre personne (P1) : grand panneau presque plein écran sur
// téléphone, qui contient TOUT son fil (même grille que mon profil, chargée au
// fil du défilement). « Profil complet » l'agrandit en page entière.
// Règles d'accès : jamais de post privé ou de cercle (B2, B4), géré par la base.
import { X, UserPlus, UserCheck, ArrowLeft, Maximize2, MessageCircle, MoreHorizontal, Ban, Flag, Bug } from 'lucide-react';
import { getBlockStatus, blockUser, unblockUser, type BlockStatus } from '../../lib/moderation';
import { openReport, openBugReport } from '../../lib/appNav';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getUserProfile, getUserShakeCount, getUserFollowersCount, getUserFollowingCount, followUser, followErrorMessage, unfollowUser, isFollowing, getCachedTasteMatch, calculateTasteMatch, getUserActiveStories, getUserPinnedStories } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { StoryViewerDialog } from './StoryViewerDialog';
import { ProfileGrid } from './ProfileGrid';
import { defaultAvatar, avatarThumb } from '../../lib/media';
import { useBackHandler } from '../../lib/navigation';
import { openConversation } from '../../lib/appNav';
import { FollowListSheet, MutualFollowersLine, type FollowListKind } from './FollowListSheet';

interface ProfilePreviewDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
  /** Visiteur sans compte : « Suivre » propose de se connecter / s'inscrire. */
  onRequireAuth?: (user: { id: string; username: string }) => void;
  /** Ouvrir directement en page complète. */
  startExpanded?: boolean;
}

export function ProfilePreviewDialog({ userId, username, onClose, onRequireAuth, startExpanded = false }: ProfilePreviewDialogProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
  const [expanded, setExpanded] = useState(startExpanded);
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<any | null>(null);
  const [pinnedStories, setPinnedStories] = useState<any[]>([]);
  const [viewerList, setViewerList] = useState<any[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasteMatch, setTasteMatch] = useState<{ percent: number; commonArtists: string[] } | null>(null);
  const [list, setList] = useState<FollowListKind | null>(null);
  // P17 : blocage (imposé par la base ; ici l'affichage).
  const [block, setBlock] = useState<BlockStatus>('none');
  const [menu, setMenu] = useState(false);
  const toggleBlock = async () => {
    setMenu(false);
    if (!profile) return;
    if (block === 'i_blocked') {
      if (await unblockUser(profile.id)) { setBlock('none'); loadProfile(); }
      return;
    }
    if (!confirm(`Bloquer @${profile.username} ? Vous ne verrez plus vos shakes, vos Shakes éphémères ni vos profils ; vous ne pourrez plus vous écrire ni vous suivre (vos abonnements mutuels sont retirés).`)) return;
    if (await blockUser(profile.id)) { setBlock('i_blocked'); setIsFollowingUser(false); }
    else alert('Impossible de bloquer pour l’instant. Réessaie.');
  };
  const refreshCounts = async () => {
    if (!profile) return;
    const [followers, following] = await Promise.all([getUserFollowersCount(profile.id), getUserFollowingCount(profile.id)]);
    setStats(s => ({ ...s, followers, following }));
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const p = await getUserProfile(data.session.user.id);
      if (p) setMe({ ...p, musicService: p.preferred_streaming_app || p.preferred_platform });
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      let profileData = userId ? await getUserProfile(userId) : null;
      if (!profileData && username) {
        const { data } = await supabase.from('users_profile').select('*').eq('username', username.toLowerCase()).maybeSingle();
        profileData = data;
      }
      if (!profileData) { setLoading(false); return; }
      const actualId = profileData.id;
      if (!onRequireAuth) getBlockStatus(actualId).then(setBlock).catch(() => {});
      const [followersCount, followingCount, followingStatus, storiesData, pinnedData, shakeCount] = await Promise.all([
        getUserFollowersCount(actualId),
        getUserFollowingCount(actualId),
        isFollowing(actualId),
        getUserActiveStories(actualId),
        getUserPinnedStories(actualId),
        getUserShakeCount(actualId),
      ]);
      setProfile(profileData);
      setStories((storiesData || []).map((s: any) => ({ ...s, user: profileData })));
      setPinnedStories((pinnedData || []).map((s: any) => ({ ...s, user: profileData })));
      // Vrai nombre de shakes (sans les reshakes).
      setStats({ followers: followersCount, following: followingCount, posts: shakeCount });
      setIsFollowingUser(followingStatus);
      const cached = await getCachedTasteMatch(actualId);
      if (cached) setTasteMatch(cached);
      else calculateTasteMatch(actualId).then(setTasteMatch).catch(() => {});
    } catch (error) {
      console.error('Error loading profile preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    if (onRequireAuth) { onRequireAuth({ id: profile.id, username: profile.username }); return; }
    if (isFollowingUser) {
      const r = await unfollowUser(profile.id);
      if (!r.success) { alert(followErrorMessage(r.error)); return; }
      setIsFollowingUser(false);
      setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
    } else {
      const r = await followUser(profile.id);
      // Refusé (limite de 100, réseau…) : on le dit au lieu d'afficher « Abonné ».
      if (!r.success) { alert(followErrorMessage(r.error)); return; }
      setIsFollowingUser(true);
      setStats(s => ({ ...s, followers: s.followers + 1 }));
    }
  };

  const isMe = !!me && profile?.id === me.id;
  const displayName = profile?.display_name || profile?.username || username;
  const avatar = avatarThumb(profile?.profile_album_cover_url) || defaultAvatar(profile?.username || username);

  // Panneau presque plein écran (téléphone) ou fenêtre haute (ordinateur) ;
  // « Profil complet » = toute la page.
  const panelClass = expanded
    ? 'w-full h-full bg-[#1E1440] flex flex-col pointer-events-auto'
    : 'w-full h-[96dvh] sm:h-[88dvh] sm:max-w-lg bg-[#1E1440] rounded-t-3xl sm:rounded-2xl border-t sm:border border-purple-700/40 flex flex-col pointer-events-auto overflow-hidden';

  const content = (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'tween', duration: 0.22 }}
        className={panelClass}
        role="dialog" aria-label={`Profil de @${profile?.username || username}`}
      >
        {/* Barre du haut */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-purple-800/30 flex-shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <button aria-label={expanded ? 'Retour' : 'Fermer'} onClick={onClose} className="p-2 rounded-full hover:bg-purple-900/40">
            {expanded ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <p className="flex-1 min-w-0 font-bold truncate">@{profile?.username || username}</p>
          {profile && !onRequireAuth && !isMe && (
            <div className="relative">
              <button aria-label="Plus d’options" onClick={() => setMenu(!menu)} className="p-2 rounded-full hover:bg-purple-900/40"><MoreHorizontal className="w-5 h-5" /></button>
              {menu && (
                <div className="absolute right-0 top-11 z-10 w-56 rounded-xl bg-[#2A1852] border border-purple-600/40 shadow-xl overflow-hidden">
                  <button onClick={toggleBlock} className="w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-purple-900/50 text-pink-200"><Ban className="w-4 h-4" /> {block === 'i_blocked' ? 'Débloquer' : 'Bloquer'} @{profile.username}</button>
                  <button onClick={() => { setMenu(false); openReport('user', profile.id); }} className="w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-purple-900/50"><Flag className="w-4 h-4" /> Signaler ce compte</button>
                  <button onClick={() => { setMenu(false); openBugReport(); }} className="w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-purple-900/50"><Bug className="w-4 h-4" /> Signaler un bug</button>
                </div>
              )}
            </div>
          )}
          {!expanded && profile && (
            <button onClick={() => setExpanded(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/40 hover:bg-purple-900/60 text-xs font-semibold">
              <Maximize2 className="w-3.5 h-3.5" /> Profil complet
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className={expanded ? 'w-full max-w-2xl mx-auto' : ''}>
            {loading ? (
              <div className="py-16 flex justify-center"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : profile && block === 'blocked_me' ? (
              <div className="py-16 text-center px-6">
                <p className="text-lg font-semibold">Profil indisponible</p>
                <p className="text-sm text-purple-300/70 mt-1">Ce profil n'est pas accessible.</p>
              </div>
            ) : profile && block === 'i_blocked' ? (
              <div className="py-16 text-center px-6">
                <Ban className="w-10 h-10 text-pink-300 mx-auto mb-3" />
                <p className="text-lg font-semibold">Tu as bloqué @{profile.username}</p>
                <p className="text-sm text-purple-300/70 mt-1">Vous ne voyez plus vos contenus et ne pouvez plus vous écrire.</p>
                <button onClick={toggleBlock} className="mt-5 px-5 py-2 rounded-full bg-purple-700/60 text-sm font-semibold">Débloquer</button>
              </div>
            ) : !profile ? (
              <div className="py-16 text-center">
                <p className="text-purple-300/70">Profil introuvable</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-sm">Fermer</button>
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
                      <p className="text-sm text-purple-400/80 mb-3">@{profile.username}</p>
                      <div className="flex items-center gap-5">
                        <div className="text-center">
                          <p className="font-bold text-white text-lg leading-tight">{stats.posts}</p>
                          <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">Shakes</p>
                        </div>
                        <div className="w-px h-8 bg-purple-800/30" />
                        <button onClick={() => !onRequireAuth && setList('followers')} className="text-center hover:opacity-80">
                          <p className="font-bold text-white text-lg leading-tight">{stats.followers}</p>
                          <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">Abonnés</p>
                        </button>
                        <div className="w-px h-8 bg-purple-800/30" />
                        <button onClick={() => !onRequireAuth && setList('following')} className="text-center hover:opacity-80">
                          <p className="font-bold text-white text-lg leading-tight">{stats.following}</p>
                          <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">Suivis</p>
                        </button>
                      </div>
                    </div>
                  </div>

                  {profile.bio && <p className="text-sm text-purple-200/80 mt-3 leading-relaxed">{profile.bio}</p>}

                  {/* P3 : abonnés en commun (connecté seulement) */}
                  {me && !isMe && <MutualFollowersLine userId={profile.id} onOpen={() => setList('mutual')} />}

                  {tasteMatch && tasteMatch.percent > 0 && !isMe && (
                    <div className="mt-3 p-2.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-purple-300/80">Compatibilité musicale</span>
                        <span className="text-sm font-bold text-pink-400">{tasteMatch.percent}%</span>
                      </div>
                      {tasteMatch.commonArtists.length > 0 && (
                        <p className="text-[11px] text-purple-300/60 mt-1 truncate">En commun : {tasteMatch.commonArtists.slice(0, 5).join(', ')}</p>
                      )}
                    </div>
                  )}

                  {!isMe && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleFollowToggle}
                        className={`flex-1 py-2 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
                          isFollowingUser ? 'bg-purple-950/40 border border-purple-800/40 hover:bg-purple-800/40 text-white' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white'
                        }`}
                      >
                        {isFollowingUser ? <><UserCheck className="w-4 h-4" /> Abonné</> : <><UserPlus className="w-4 h-4" /> Suivre</>}
                      </button>
                      {!onRequireAuth && (
                        <button
                          onClick={() => { onClose(); openConversation(profile.id); }}
                          className="px-4 py-2 rounded-xl bg-purple-950/50 border border-purple-800/40 hover:bg-purple-900/40 flex items-center gap-2 text-sm font-semibold"
                        >
                          <MessageCircle className="w-4 h-4" /> Message
                        </button>
                      )}
                    </div>
                  )}

                  {(stories.length > 0 || pinnedStories.length > 0) && (
                    <div className="mt-4">
                      <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-2">Shakes éphémères</p>
                      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {stories.map((story: any) => (
                          <button key={story.id} onClick={() => { setViewerList(stories); setActiveStory(story); }} className="flex-shrink-0 text-center w-16">
                            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400">
                              <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                                <img loading="lazy" src={avatarThumb(story.image_url, 256) || story.cover_url || avatar} className="w-full h-full rounded-full object-cover" alt="" />
                              </div>
                            </div>
                            <p className="text-[10px] text-purple-300/70 mt-1">En cours</p>
                          </button>
                        ))}
                        {pinnedStories.map((story: any) => (
                          <button key={story.id} onClick={() => { setViewerList(pinnedStories); setActiveStory(story); }} className="flex-shrink-0 text-center w-16">
                            <div className="w-16 h-16 rounded-full p-[2px] bg-purple-700/50">
                              <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                                <img loading="lazy" src={avatarThumb(story.image_url, 256) || story.cover_url || avatar} className="w-full h-full rounded-full object-cover" alt="" />
                              </div>
                            </div>
                            <p className="text-[10px] text-purple-300/70 mt-1 truncate">{story.track_name || 'À la une'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tout le fil, comme sur mon profil (P1/P2). */}
                <ProfileGrid userId={profile.id} currentUser={me} />
              </>
            )}
          </div>
        </div>
      </motion.div>
      </div>

      <AnimatePresence>
        {list && profile && (
          <FollowListSheet userId={profile.id} username={profile.username} kind={list} myId={me?.id} onClose={() => setList(null)} onCountsChanged={refreshCounts} />
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
