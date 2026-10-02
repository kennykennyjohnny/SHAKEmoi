import { Archive, Pin, Settings, Edit3, X, Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { ProfileGrid } from './ProfileGrid';
import { FollowListSheet } from './FollowListSheet';
import { StreakBadge } from './Streak';
import { PinnedSongs } from './PinnedSongs';
import { InviteSheet } from './InviteSheet';
import { UserPlus } from 'lucide-react';
import { SettingsDialog } from './SettingsDialog';
import { EditProfileDialog } from './EditProfileDialog';
import { getUserShakeCount, getUserFollowersCount, getUserFollowingCount, getUserActiveStories, getUserPinnedStories } from '../../lib/database';
import { StoryViewerDialog } from './StoryViewerDialog';
import { StoryArchiveDialog } from './StoryArchiveDialog';
import { inviteLink, profileLink } from '../../lib/links';

import { defaultAvatar, avatarThumb } from '../../lib/media';
interface ProfileViewProps {
  user: any;
  onUpdateUser?: (updatedUser: any) => void;
}

export function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [showShareProfile, setShowShareProfile] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeStories, setActiveStories] = useState<any[]>([]);
  const [pinnedStories, setPinnedStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  // Liste parcourue par le lecteur (stories en cours OU « À la une »).
  const [storyList, setStoryList] = useState<any[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [stats, setStats] = useState({
    shakes: 0,
    followers: 0,
    following: 0
  });

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  // N2 : l'onglet Profil reste ouvert en arrière-plan ; après une publication,
  // la grille et les chiffres se mettent à jour.
  const [gridKey, setGridKey] = useState(0);
  useEffect(() => {
    const onPosted = () => { setGridKey((k) => k + 1); loadUserData(); };
    window.addEventListener('shakemoi:posted', onPosted);
    return () => window.removeEventListener('shakemoi:posted', onPosted);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserData = async () => {
    if (!user) return;
    try {
      const [followersCount, followingCount, stories, pinned, shakeCount] = await Promise.all([
        getUserFollowersCount(user.id),
        getUserFollowingCount(user.id),
        getUserActiveStories(user.id),
        getUserPinnedStories(user.id),
        getUserShakeCount(user.id),
      ]);
      setStats({
        // Ses shakes seulement : les reshakes ont leur onglet.
        shakes: shakeCount,
        followers: followersCount,
        following: followingCount
      });
      setActiveStories(stories || []);
      setPinnedStories(pinned || []);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  const handleSaveSettings = (settings: { musicService: string }) => {
    const updatedUser = { ...user, ...settings };
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
  };

  const loadFollowersList = (type: 'followers' | 'following') => setShowFollowersList(type);

  return (
    <div className="w-full max-w-2xl mx-auto flex-1 overflow-y-auto pb-[var(--nav-h)] lg:pb-4">
      {/* Profile Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={avatarThumb(user.avatar) || avatarThumb(user.profile_album_cover_url) || defaultAvatar(user.username || user.displayName)}
            alt={user.displayName || user.username}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-purple-500 shadow-lg shadow-purple-500/20 flex-shrink-0"
            onError={(e) => {
              e.currentTarget.src = defaultAvatar(user.username || user.displayName);
            }}
          />

          {/* Info + Stats */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate flex items-center gap-2">
              <span className="truncate">{user.displayName}</span>
              <StreakBadge userId={user.id} />
            </h1>
            <p className="text-sm text-purple-400/70 mb-3">@{user.username}</p>

            {/* Stats Row - clickable for own profile */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">{stats.shakes}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Shakes</p>
              </div>
              <div className="w-px h-8 bg-purple-800/30" />
              <button onClick={() => loadFollowersList('followers')} className="text-center hover:opacity-80 transition-opacity">
                <p className="font-bold text-white text-lg leading-tight">{stats.followers}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Abonnés</p>
              </button>
              <div className="w-px h-8 bg-purple-800/30" />
              <button onClick={() => loadFollowersList('following')} className="text-center hover:opacity-80 transition-opacity">
                <p className="font-bold text-white text-lg leading-tight">{stats.following}</p>
                <p className="text-[10px] text-purple-400/50 uppercase tracking-wider">Suivis</p>
              </button>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-purple-200/70 mt-3 leading-relaxed">{user.bio}</p>
        )}

        {/* Sons épinglés (P24) */}
        <PinnedSongs userId={user.id} isOwn />

        {/* Stories : en cours, « À la une » (épinglées) et accès aux archives */}
        <div className="mt-4">
          <p className="text-[11px] text-purple-300/60 uppercase tracking-wider mb-2">Shakes éphémères</p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {activeStories.map((story: any) => (
              <button key={story.id} onClick={() => { setStoryList(activeStories); setSelectedStory(story); }} className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400">
                  <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                    <img loading="lazy"
                      src={avatarThumb(story.image_url, 256) || story.cover_url || avatarThumb(user.avatar) || defaultAvatar(user.username || user.displayName)}
                      className="w-full h-full rounded-full object-cover"
                      alt={story.track_name || ''}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-purple-200/80 truncate w-full text-center">En cours</span>
              </button>
            ))}
            {pinnedStories.map((story: any) => (
              <button key={story.id} onClick={() => { setStoryList(pinnedStories); setSelectedStory(story); }} className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
                <div className="relative w-16 h-16 rounded-full p-[2px] bg-purple-700/50">
                  <div className="w-full h-full rounded-full bg-[#1E1440] p-[2px]">
                    <img loading="lazy"
                      src={avatarThumb(story.image_url, 256) || story.cover_url || user.avatar}
                      className="w-full h-full rounded-full object-cover"
                      alt={story.track_name || ''}
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-fuchsia-500 border-2 border-[#1E1440] flex items-center justify-center">
                    <Pin className="w-2.5 h-2.5 text-white fill-white" />
                  </span>
                </div>
                <span className="text-[10px] text-purple-200/80 truncate w-full text-center">{story.track_name || 'À la une'}</span>
              </button>
            ))}
            <button onClick={() => setShowArchive(true)} className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-purple-500/40 flex items-center justify-center bg-purple-950/40 hover:bg-purple-900/40 transition-colors">
                <Archive className="w-6 h-6 text-purple-300" />
              </div>
              <span className="text-[10px] text-purple-200/80">Archives</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowEditProfile(true)}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modifier le profil
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-2 bg-purple-950/50 border border-purple-800/30 hover:bg-purple-900/40 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-semibold text-purple-100"
            title="Inviter des amis"
          >
            <UserPlus className="w-4 h-4 text-fuchsia-300" /> Inviter
          </button>
          <button
            onClick={() => setShowShareProfile(true)}
            className="px-4 py-2 bg-purple-950/50 border border-purple-800/30 hover:bg-purple-900/40 rounded-xl transition-colors"
            title="Partager mon profil"
          >
            <Share2 className="w-4 h-4 text-purple-300" />
          </button>
          <button aria-label="Paramètres"
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-purple-950/50 border border-purple-800/30 hover:bg-purple-900/40 rounded-xl transition-colors"
          >
            <Settings className="w-4 h-4 text-purple-300" />
          </button>
        </div>
      </div>

      {/* Fil complet, même composant que le profil des autres (P1/P2) */}
      <ProfileGrid
        userId={user.id}
        currentUser={user}
        isOwn
        refreshKey={gridKey}
        onDeleted={(wasShake: boolean) => { if (wasShake) setStats(st => ({ ...st, shakes: Math.max(0, st.shakes - 1) })); }}
      />

      {/* Abonnés / abonnements : même feuille que pour les autres profils (P4) */}
      <AnimatePresence>
        {showFollowersList && (
          <FollowListSheet
            userId={user.id}
            username={user.username}
            kind={showFollowersList}
            myId={user.id}
            isOwn
            onClose={() => setShowFollowersList(null)}
            onCountsChanged={loadUserData}
          />
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          currentUser={user}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Edit Profile Dialog */}
      {showEditProfile && (
        <EditProfileDialog
          currentUser={user}
          onClose={() => setShowEditProfile(false)}
          onUpdateUser={onUpdateUser}
        />
      )}

      {/* Share Profile Dialog */}
      <AnimatePresence>
        {showShareProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1D0F3D] rounded-2xl w-full max-w-sm border border-purple-800/20 overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-purple-800/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-fuchsia-400" />
                  Partager mon profil
                </h2>
                <button aria-label="Fermer" onClick={() => setShowShareProfile(false)} className="p-1.5 hover:bg-purple-900/40 rounded-full">
                  <X className="w-5 h-5 text-purple-300/60" />
                </button>
              </div>

              {/* Profile card preview */}
              <div className="p-5">
                <div className="bg-gradient-to-br from-fuchsia-600/20 via-purple-900/30 to-pink-600/20 rounded-2xl p-5 text-center border border-fuchsia-500/20 mb-5">
                  <img loading="lazy"
                    src={avatarThumb(user.avatar) || avatarThumb(user.profile_album_cover_url) || defaultAvatar(user.username)}
                    className="w-20 h-20 rounded-full object-cover mx-auto ring-3 ring-fuchsia-500/40 mb-3"
                    alt=""
                  />
                  <h3 className="text-lg font-bold text-white">{user.displayName}</h3>
                  <p className="text-sm text-fuchsia-400">@{user.username}</p>
                  <div className="flex justify-center gap-6 mt-3">
                    <div className="text-center">
                      <p className="font-bold text-white">{stats.shakes}</p>
                      <p className="text-[10px] text-purple-400/50">Shakes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-white">{stats.followers}</p>
                      <p className="text-[10px] text-purple-400/50">Abonnés</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-300/60 mt-3">shakemoi.fr</p>
                </div>

                {/* Share link */}
                <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-purple-400/50 mb-1">Mon lien de profil</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-mono flex-1 truncate">shakemoi.fr/u/{user.username}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(profileLink(user.username));
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${shareCopied ? 'bg-fuchsia-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                    >
                      {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Instagram Story */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Hey ! 👋 Rejoins-moi sur SHAKEmoi 🎵🔥 ${inviteLink(user.username)}`);
                      window.open('instagram://camera', '_blank');
                      setTimeout(() => { window.open('https://instagram.com', '_blank'); }, 500);
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Instagram
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const text = encodeURIComponent(`Hey ! 👋 Rejoins-moi sur SHAKEmoi, l'appli où on partage nos sons préférés avec nos amis 🎵🔥\n\nInscris-toi ici : ${inviteLink(user.username)}`);
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>

                  {/* Twitter/X */}
                  <button
                    onClick={() => {
                      const text = encodeURIComponent(`Découvrez ce que vos amis écoutent vraiment 🎵 Rejoignez-moi sur @SHAKEmoi !\n${inviteLink(user.username)}`);
                      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X / Twitter
                  </button>

                  {/* Snapchat */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Rejoins-moi sur SHAKEmoi 🎵🔥 ${inviteLink(user.username)}`);
                      window.open(`https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(inviteLink(user.username))}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-400 text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.959-.289.096-.057.186-.079.277-.079.194 0 .381.104.489.264.035.053.079.116.079.194 0 .06-.029.169-.18.285-.238.168-.479.27-.72.374-.096.039-.193.08-.287.123-.155.074-.307.167-.434.27-.058.052-.108.123-.139.204l-.003.013c-.159.463.105 1.075.267 1.322.158.237.345.465.552.668.283.291.632.508 1.019.709.195.099.395.171.595.214.102.024.178.07.222.134.052.073.083.164.083.272 0 .061-.01.124-.034.186-.12.31-.378.439-.59.534-.119.051-.241.1-.351.142-1.2.456-1.6 1.024-1.685 1.152-.053.07-.076.132-.076.217 0 .069.025.141.076.209.066.096.141.179.216.261.224.244.47.476.692.692.297.303.504.553.625.796.059.118.094.237.094.363 0 .068-.011.134-.034.198-.159.496-.755.685-1.304.8-.262.052-.531.079-.747.101-.105.01-.21.025-.299.038-.056.007-.112.032-.165.078-.069.058-.116.14-.134.243-.025.14-.107.236-.223.263-.162.03-.318.043-.468.043-.207 0-.417-.024-.643-.074-.236-.052-.466-.12-.689-.18-.33-.09-.648-.152-.96-.152-.083 0-.166.005-.25.016-.438.058-.855.308-1.234.541-.506.311-1.045.642-1.648.642-.063 0-.125-.005-.188-.014-.061.009-.122.014-.186.014-.602 0-1.14-.332-1.648-.642-.381-.234-.8-.485-1.237-.543-.084-.01-.168-.015-.251-.015-.314 0-.633.063-.962.153-.226.061-.459.13-.698.181-.228.051-.442.076-.653.076-.152 0-.313-.013-.481-.045-.117-.027-.199-.122-.224-.262-.017-.1-.064-.183-.133-.24-.053-.045-.108-.07-.164-.078-.091-.013-.197-.028-.301-.038-.215-.022-.489-.05-.752-.102-.543-.114-1.139-.303-1.301-.802-.023-.065-.034-.132-.034-.199 0-.127.035-.246.095-.364.12-.244.332-.495.63-.798.218-.215.46-.443.683-.684.076-.082.152-.167.22-.264.053-.07.078-.143.078-.213 0-.082-.023-.146-.077-.218-.085-.127-.484-.695-1.684-1.15-.11-.042-.234-.092-.354-.142-.213-.096-.474-.226-.595-.538-.023-.062-.034-.125-.034-.187 0-.11.031-.201.084-.275.045-.067.123-.112.224-.136.201-.043.401-.115.595-.214.388-.201.737-.418 1.02-.71.207-.202.394-.43.552-.667.16-.245.422-.858.267-1.316l-.004-.013c-.031-.082-.081-.153-.14-.205-.127-.103-.279-.197-.432-.271-.094-.042-.19-.084-.287-.123-.243-.103-.482-.206-.72-.374-.152-.117-.18-.228-.18-.287 0-.077.043-.14.078-.193.109-.162.297-.264.492-.264.091 0 .181.022.278.079.3.17.659.289.96.29.196 0 .325-.045.401-.091-.009-.164-.019-.331-.031-.51l-.003-.058c-.104-1.628-.23-3.654.3-4.847C7.85 1.068 11.216.793 12.206.793"/></svg>
                    Snapchat
                  </button>
                </div>

                {/* Native share (mobile) */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: `${user.displayName} sur SHAKEmoi`,
                          text: `Découvre mon profil sur SHAKEmoi ! 🎵`,
                          url: profileLink(user.username),
                        });
                      } catch {}
                    }}
                    className="w-full mt-3 py-3 bg-purple-950/50 border border-purple-800/30 rounded-xl text-sm font-semibold text-purple-300 hover:bg-purple-900/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Plus d'options de partage...
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showInvite && <InviteSheet user={user} onClose={() => setShowInvite(false)} />}

      <StoryViewerDialog
        open={!!selectedStory}
        story={selectedStory}
        onClose={() => { setSelectedStory(null); loadUserData(); }}
        currentUser={user}
        stories={storyList}
        onNavigate={setSelectedStory}
      />

      {showArchive && (
        <StoryArchiveDialog
          currentUser={user}
          onClose={() => setShowArchive(false)}
          onChanged={loadUserData}
        />
      )}

    </div>
  );
}
