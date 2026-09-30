import { X, Heart, Play, UserPlus, UserCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getUserProfile, getUserPosts, getUserShakeCount, getUserFollowersCount, getUserFollowingCount, followUser, followErrorMessage, unfollowUser, isFollowing, getUserReshakes, getCachedTasteMatch, calculateTasteMatch, getUserActiveStories, getUserPinnedStories } from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { StoryViewerDialog } from './StoryViewerDialog';

import { thumb, defaultAvatar } from '../../lib/media';
import { SongCover } from './SongCover';
import { useBackHandler } from '../../lib/navigation';
interface ProfilePreviewDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
  /** Visiteur sans compte : « Suivre » propose de se connecter / s'inscrire. */
  onRequireAuth?: (user: { id: string; username: string }) => void;
}

export function ProfilePreviewDialog({ userId, username, onClose, onRequireAuth }: ProfilePreviewDialogProps) {
  // Retour du téléphone : ferme cette fenêtre au lieu de quitter l'appli (N2).
  useBackHandler(true, onClose);
  const [profile, setProfile] = useState<any>(null);
  const [shakes, setShakes] = useState<any[]>([]);
  const [reshakes, setReshakes] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<any | null>(null);
  // Stories « À la une » (épinglées) + liste parcourue par le lecteur.
  const [pinnedStories, setPinnedStories] = useState<any[]>([]);
  const [viewerList, setViewerList] = useState<any[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shakes' | 'reshakes'>('shakes');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [tasteMatch, setTasteMatch] = useState<{ percent: number; commonArtists: string[] } | null>(null);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      let profileData = await getUserProfile(userId);

      if (!profileData && username) {
        const { data } = await supabase
          .from('users_profile')
          .select('*')
          .eq('username', username)
          .maybeSingle();
        profileData = data;
      }

      if (!profileData) {
        setLoading(false);
        return;
      }

      const actualId = profileData.id;

      const [postsData, reshakesData, followersCount, followingCount, followingStatus, storiesData, shakeCount] = await Promise.all([
        getUserPosts(actualId, 9),
        getUserReshakes(actualId),
        getUserFollowersCount(actualId),
        getUserFollowingCount(actualId),
        isFollowing(actualId),
        getUserActiveStories(actualId),
        getUserShakeCount(actualId),
      ]);
      const pinnedData = await getUserPinnedStories(actualId);

      // Separate original shakes from reshakes
      const originalShakes = postsData.filter((p: any) => !p.is_reshake);

      setProfile(profileData);
      setShakes(originalShakes.slice(0, 9));
      setReshakes((reshakesData || []).slice(0, 9));
      setStories((storiesData || []).map((s: any) => ({ ...s, user: profileData })));
      setPinnedStories((pinnedData || []).map((s: any) => ({ ...s, user: profileData })));
      setStats({
        followers: followersCount,
        following: followingCount,
        // Vrai nombre de shakes (avant : reshakes compris, et plafonné à 9).
        posts: shakeCount
      });
      setIsFollowingUser(followingStatus);

      // Load taste match
      const cached = await getCachedTasteMatch(actualId);
      if (cached) {
        setTasteMatch(cached);
      } else {
        calculateTasteMatch(actualId).then(setTasteMatch);
      }
    } catch (error) {
      console.error('Error loading profile preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    if (onRequireAuth) { onRequireAuth({ id: profile.id, username: profile.username }); return; }
    try {
      if (isFollowingUser) {
        const r = await unfollowUser(profile.id); if (!r.success) { alert(followErrorMessage(r.error)); return; }
        setIsFollowingUser(false);
        setStats({ ...stats, followers: stats.followers - 1 });
      } else {
        const r = await followUser(profile.id);
        // Refusé (limite de 100, réseau…) : on le dit au lieu d'afficher « Abonné ».
        if (!r.success) { alert(followErrorMessage(r.error)); return; }
        setIsFollowingUser(true);
        setStats({ ...stats, followers: stats.followers + 1 });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#1D0F3D] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#1D0F3D] rounded-2xl p-8 text-center">
          <p className="text-purple-300/60">Profil introuvable</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-sm">Fermer</button>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const avatar = thumb(profile.profile_album_cover_url) || defaultAvatar(profile.username);

  const currentPosts = activeTab === 'shakes' ? shakes : reshakes;
  const expandedPostRaw = expandedPostId ? currentPosts.find(p => p.id === expandedPostId) : null;
  // For reshakes, show original post data
  const expandedOriginal = expandedPostRaw?.is_reshake ? (Array.isArray(expandedPostRaw.original_post) ? expandedPostRaw.original_post[0] : expandedPostRaw.original_post) : null;
  const expandedPost = expandedOriginal || expandedPostRaw;
  const expandedTrackId = expandedPost?.track_id || (expandedPost?.spotify_url?.match(/track\/([a-zA-Z0-9]+)/)?.[1]) || null;

  return (
    <>
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1D0F3D] rounded-2xl w-full max-w-md border border-purple-800/30 overflow-hidden max-h-[85dvh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button aria-label="Fermer"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Profile Info - No cover photo, compact */}
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <img loading="lazy"
              src={avatar}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
              <p className="text-sm text-purple-400">@{profile.username}</p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-sm text-purple-200/80 mb-3">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-4 mb-3 text-sm">
            <div>
              <span className="font-bold text-white">{stats.posts}</span>
              <span className="text-purple-300/60 ml-1">shakes</span>
            </div>
            <div>
              <span className="font-bold text-white">{stats.followers}</span>
              <span className="text-purple-300/60 ml-1">abonnés</span>
            </div>
            <div>
              <span className="font-bold text-white">{stats.following}</span>
              <span className="text-purple-300/60 ml-1">suivis</span>
            </div>
          </div>

          {/* Taste Match Badge */}
          {tasteMatch && tasteMatch.percent > 0 && (
            <div className="mb-3 p-2 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-300/70">Compatibilité musicale</span>
                <span className="text-sm font-bold text-pink-400">{tasteMatch.percent}% match</span>
              </div>
              {tasteMatch.commonArtists.length > 0 && (
                <p className="text-[10px] text-purple-400/50 mt-1 truncate">
                  En commun : {tasteMatch.commonArtists.slice(0, 5).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Follow Button */}
          <button
            onClick={handleFollowToggle}
            className={`w-full py-2 rounded-full font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
              isFollowingUser
                ? 'bg-purple-950/40 border border-purple-800/30 hover:bg-purple-800/40 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white'
            }`}
          >
            {isFollowingUser ? (
              <><UserCheck className="w-4 h-4" /> Abonné</>
            ) : (
              <><UserPlus className="w-4 h-4" /> S'abonner</>
            )}
          </button>

          {/* Stories : en cours + « À la une » (épinglées) */}
          {(stories.length > 0 || pinnedStories.length > 0) && (
            <div className="mt-4">
              <p className="text-xs text-purple-300/60 font-semibold uppercase tracking-wider mb-2">Stories</p>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {stories.map((story: any) => (
                  <button
                    key={story.id}
                    onClick={() => { setViewerList(stories); setActiveStory(story); }}
                    className="flex-shrink-0 text-center w-14"
                  >
                    <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400">
                      <div className="w-full h-full rounded-full bg-[#1D0F3D] p-[2px]">
                        <img loading="lazy"
                          src={story.cover_url || thumb(story.image_url, 256) || avatar}
                          className="w-full h-full rounded-full object-cover"
                          alt=""
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-purple-300/60 mt-1">En cours</p>
                  </button>
                ))}
                {pinnedStories.map((story: any) => (
                  <button
                    key={story.id}
                    onClick={() => { setViewerList(pinnedStories); setActiveStory(story); }}
                    className="flex-shrink-0 text-center w-14"
                  >
                    <div className="w-14 h-14 rounded-full p-[2px] bg-purple-700/50">
                      <div className="w-full h-full rounded-full bg-[#1D0F3D] p-[2px]">
                        <img loading="lazy" src={thumb(story.image_url, 256) || story.cover_url || avatar} className="w-full h-full rounded-full object-cover" alt="" />
                      </div>
                    </div>
                    <p className="text-[10px] text-purple-300/60 mt-1 truncate">{story.track_name || 'À la une'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Shakes / Reshakes */}
          <div className="flex mt-4 border-b border-purple-800/30">
            <button
              onClick={() => { setActiveTab('shakes'); setExpandedPostId(null); }}
              className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${
                activeTab === 'shakes' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-purple-300/60'
              }`}
            >
              Shakes
            </button>
            <button
              onClick={() => { setActiveTab('reshakes'); setExpandedPostId(null); }}
              className={`flex-1 py-2 text-sm font-semibold text-center transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'reshakes' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-purple-300/60'
              }`}
            >
              <RefreshCw className="w-3 h-3" /> Reshakes
            </button>
          </div>

          {/* Posts Grid */}
          {currentPosts.length > 0 ? (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-1.5">
                {currentPosts.slice(0, 9).map((post) => {
                  // For reshakes, normalize original_post (may be array)
                  const origPost = Array.isArray(post.original_post) ? post.original_post[0] : post.original_post;
                  const displayCover = (activeTab === 'reshakes' && origPost?.cover_url) ? origPost.cover_url : post.cover_url;
                  const displayTrackName = (activeTab === 'reshakes' && origPost?.track_name) ? origPost.track_name : post.track_name;

                  return (
                    <button
                      key={post.id}
                      onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      className={`aspect-square rounded-lg overflow-hidden group cursor-pointer relative transition-all ${
                        expandedPostId === post.id ? 'ring-2 ring-purple-500 scale-[0.95]' : ''
                      }`}
                    >
                      <img loading="lazy" src={displayCover} alt={displayTrackName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                      {activeTab === 'reshakes' && origPost?.user && (
                        <div className="absolute top-0.5 left-0.5 bg-black/60 rounded-full px-1.5 py-0.5">
                          <span className="text-[8px] text-fuchsia-400 font-medium">@{origPost.user.username}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full px-1 py-0.5 flex items-center gap-0.5">
                        <Heart className="w-2 h-2 text-pink-400" />
                        <span className="text-[8px] text-white font-medium">{(activeTab === 'reshakes' && origPost ? origPost.likes_count : post.likes_count) || 0}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Expanded post detail with embed */}
              <AnimatePresence>
                {expandedPost && (
                  <motion.div
                    key={expandedPostId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mt-2"
                  >
                    <div className="bg-purple-950/40 rounded-xl border border-purple-800/30 p-3">
                      {expandedOriginal?.user && (
                        <p className="text-xs text-purple-400/60 mb-2">
                          Shake original de <span className="text-fuchsia-400 font-medium">@{expandedOriginal.user.username}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        {/* M2 : pochette jouable, jamais d'embed Spotify. */}
                        <SongCover
                          songKey={`preview-${expandedPost.id}`}
                          title={expandedPost.track_name} artist={expandedPost.artist} cover={expandedPost.cover_url}
                          previewUrl={expandedPost.preview_url} spotifyId={expandedTrackId} spotifyUrl={expandedPost.spotify_url}
                          className="w-14 h-14" rounded="rounded-md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{expandedPost.track_name}</p>
                          <p className="text-xs text-purple-300/60 truncate">{expandedPost.artist}</p>
                        </div>
                        <div className="flex items-center gap-1 text-pink-400">
                          <Heart className="w-3 h-3" />
                          <span className="text-xs font-medium">{expandedPost.likes_count || 0}</span>
                        </div>
                      </div>
                      {expandedPost.text && (
                        <p className="text-xs text-purple-200/70 mb-2">{expandedPost.text}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="mt-4 text-center py-6">
              <p className="text-purple-300/60 text-sm">
                {activeTab === 'shakes' ? 'Aucun shake pour le moment' : 'Aucun reshake pour le moment'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>

    {/* Story viewer */}
    <StoryViewerDialog
      open={!!activeStory}
      story={activeStory}
      onClose={() => setActiveStory(null)}
      currentUser={null}
      stories={viewerList}
      onNavigate={(s) => setActiveStory(s)}
    />
    </>
  );
}
