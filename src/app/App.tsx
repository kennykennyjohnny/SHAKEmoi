import { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, User, TrendingUp, Share2, MessageCircle, Sun, Bell, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { UnifiedComposerDialog } from './components/UnifiedComposerDialog';
import { TrendingBar } from './components/TrendingBar';
import { OnboardingDialog } from './components/OnboardingDialog';
import { ShareDialog } from './components/ShareDialog';
import { AuthDialog } from './components/AuthDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { CompleteProfileDialog } from './components/CompleteProfileDialog';
import { ShakeDuJourDialog } from './components/ShakeDuJourDialog';
import { MessagesView } from './components/MessagesView';
import { TopFriendsView } from './components/TopFriendsView';
import { SharedPostView } from './components/SharedPostView';

import { CircleInviteView } from './components/CircleInviteView';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { NotificationsView } from './components/NotificationsView';
import { ProfilePreviewDialog } from './components/ProfilePreviewDialog';
import { PostDetailModal } from './components/PostDetailModal';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getUserProfile, getUserNotifications, hasShakeToday, followUser } from '../lib/database';

type View = 'feed' | 'search' | 'top' | 'profile' | 'messages' | 'notifications';

function getSharedPostId(): string | null {
  const hash = window.location.hash;
  const m = hash.match(/\/s\/([a-f0-9-]+)/i) || window.location.pathname.match(/\/s\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

function getCircleInviteId(): string | null {
  const hash = window.location.hash;
  const m = hash.match(/\/circle\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('feed');
  const [showCreateShake, setShowCreateShake] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showShakeDuJour, setShowShakeDuJour] = useState(false);
  const [hasPostedToday, setHasPostedToday] = useState(true);
  const [viewOptions, setViewOptions] = useState<any>({});
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [notifPostId, setNotifPostId] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);

  const openCirclesInMessages = () => {
    setCurrentView('messages');
    setViewOptions({ initialTab: 'circles' });
  };

  const buildUserObject = (profile: any) => ({
    ...profile,
    avatar: profile.profile_album_cover_url || profile.avatar || `https://ui-avatars.com/api/?name=${profile.username}&background=2A1852&color=FFEFD5`,
    displayName: profile.display_name || profile.displayName || profile.username,
    bio: profile.bio || '',
    musicService: profile.preferred_platform || profile.musicService || 'spotify',
  });

  useEffect(() => {
    const checkAuth = async () => {
      // Handle referral parameter
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) {
        localStorage.setItem('shakemoi_referrer', ref);
        setReferrer(ref);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const storedRef = localStorage.getItem('shakemoi_referrer');
        if (storedRef) setReferrer(storedRef);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await getUserProfile(session.user.id);
        if (profile) {
          setCurrentUser(buildUserObject(profile));
          if (!localStorage.getItem('shakemoi_onboarding')) setShowOnboarding(true);
          const profileCompleted = localStorage.getItem('shakemoi_profile_completed');
          if (!profileCompleted && (!profile.display_name || !profile.profile_album_cover_url)) setShowCompleteProfile(true);
          const postedToday = await hasShakeToday();
          setHasPostedToday(postedToday);
          if (!postedToday) setShowShakeDuJour(true);
        } else { setShowAuth(true); }
      } else { setShowAuth(true); }
    };
    checkAuth();
  }, []);

  // Poll notifications
  useEffect(() => {
    if (!currentUser) return;
    let lastNotifId: string | null = null;
    const check = async () => {
      try {
        const notifs = await getUserNotifications(currentUser.id);
        setUnreadNotifs(notifs.filter((n: any) => !n.is_read).length);
        const pushEnabled = localStorage.getItem('shakemoi_push_enabled') === 'true';
        if (pushEnabled && notifs.length > 0 && lastNotifId && notifs[0].id !== lastNotifId) {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('SHAKEmoi', { body: `@${notifs[0].actor_username} ${notifs[0].content}`, icon: '/shakemoi-favicon.png' });
          }
        }
        if (notifs.length > 0) lastNotifId = notifs[0].id;
      } catch {}
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [currentUser]);

  const handleAuthComplete = async (user: any) => {
    setCurrentUser(buildUserObject(user));
    setShowAuth(false);
    if (!localStorage.getItem('shakemoi_onboarding')) setShowOnboarding(true);

    // Auto-follow referrer if one exists
    const ref = localStorage.getItem('shakemoi_referrer');
    if (ref) {
      try {
        const { data: refProfile } = await supabase
          .from('users_profile')
          .select('id')
          .eq('username', ref)
          .single();
        if (refProfile && refProfile.id !== user.id) {
          await followUser(refProfile.id);
        }
      } catch (err) {
        console.error('Auto-follow referrer error:', err);
      }
      localStorage.removeItem('shakemoi_referrer');
      setReferrer(null);
    }
  };

  const handleOnboardingComplete = async (preferences: { musicService: 'spotify' | 'apple' }) => {
    localStorage.setItem('shakemoi_onboarding', JSON.stringify(preferences));
    setShowOnboarding(false);
    try {
      const user = await getCurrentUser();
      if (user) {
        const profile = await getUserProfile(user.id);
        if (profile) {
          if (preferences.musicService) await supabase.from('users_profile').update({ preferred_platform: preferences.musicService }).eq('id', user.id);
          setCurrentUser(buildUserObject({ ...profile, musicService: preferences.musicService }));
        }
      }
    } catch {}
  };

  // Circle invite — show landing page
  const circleInviteId = getCircleInviteId();
  if (circleInviteId) {
    return (
      <CircleInviteView
        circleId={circleInviteId}
        currentUser={currentUser}
        onJoin={async () => {
          window.location.hash = '';
          openCirclesInMessages();
        }}
        onSignUp={() => { window.location.hash = ''; setShowAuth(true); }}
      />
    );
  }

  // Shared post — public, no auth
  const sharedPostId = getSharedPostId();
  if (sharedPostId && !currentUser) {
    return <SharedPostView postId={sharedPostId} onJoin={() => { window.location.hash = ''; setShowAuth(true); }} />;
  }
  if (showOnboarding) return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  if (showAuth) return <AuthDialog onComplete={handleAuthComplete} referrer={referrer} />;

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return (
          <FeedView
            currentUser={currentUser}
            refreshFeed={refreshFeed}
          />
        );
      case 'search':
        return <SearchView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'top':
        return <TopFriendsView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'messages':
        return <MessagesView currentUser={currentUser} viewOptions={viewOptions} />;
      case 'notifications':
        return <NotificationsView currentUser={currentUser} onNavigateToPost={(postId) => setNotifPostId(postId)} onNavigateToProfile={(userId) => setProfilePreview({ userId, username: '' })} />;
      case 'profile':
        return <ProfileView user={currentUser} onUpdateUser={setCurrentUser} />;
      default:
        return <FeedView currentUser={currentUser} refreshFeed={refreshFeed} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#14092A] text-white overflow-hidden flex">
      {/* Sidebar gauche - Trending */}
      <aside className="hidden lg:block w-80 border-r border-violet-900/30 overflow-y-auto">
        <TrendingBar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-violet-900/30 backdrop-blur-lg bg-[#14092A]/80 sticky top-0 z-40">
          <div className="px-4 py-2 flex items-center justify-between">
            <button onClick={() => { setCurrentView('feed'); }} className="focus:outline-none">
              <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-5 object-contain" draggable={false} />
            </button>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowShareDialog(true)} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-purple-300/60" />
              </button>

              <button onClick={openCirclesInMessages} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors" title="Groupes">
                <Users className="w-5 h-5 text-purple-300/60" />
              </button>

              {currentUser && (
                <button
                  onClick={() => { if (currentView === 'notifications') { setCurrentView('feed'); return; } setCurrentView('notifications'); setUnreadNotifs(0); supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false); }}
                  className="p-2 hover:bg-violet-900/25 rounded-full transition-colors relative"
                >
                  <Bell className={`w-5 h-5 ${currentView === 'notifications' ? 'text-purple-400' : 'text-purple-300/60'}`} />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-pink-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white min-w-[18px] px-1">
                      {unreadNotifs > 9 ? '9+' : unreadNotifs}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => setShowCreateShake(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Shake</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto pb-24 lg:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation Mobile — Feed, Top, Search, DMs, Profile */}
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-violet-900/30 backdrop-blur-lg bg-[#14092A]/95 z-50">
          <div className="px-4 py-2.5 flex items-center justify-around max-w-lg mx-auto">
            {([
              { view: 'feed' as View, icon: Home, label: 'Accueil' },
              { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
              { view: 'search' as View, icon: Search, label: 'Recherche' },
              { view: 'messages' as View, icon: MessageCircle, label: 'DMs' },
              { view: 'profile' as View, icon: User, label: 'Profil' },
            ]).map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all active:scale-90 ${
                  currentView === view ? 'text-fuchsia-400 bg-fuchsia-500/15 shadow-lg shadow-fuchsia-500/10' : 'text-purple-300/60 hover:text-purple-200'
                }`}
              >
                <Icon className={`w-6 h-6 ${currentView === view ? 'drop-shadow-[0_0_6px_rgba(217,70,239,0.5)]' : ''}`} />
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Sidebar droite - Desktop */}
      <aside className="hidden xl:block w-64 border-l border-violet-900/30 p-4 overflow-y-auto">
        <nav className="space-y-2">
          {([
              { view: 'feed' as View, icon: Home, label: 'Accueil' },
            { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
            { view: 'messages' as View, icon: MessageCircle, label: 'Messages' },
            { view: 'profile' as View, icon: User, label: 'Profil' },
          ]).map(({ view, icon: Icon, label }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                currentView === view ? 'bg-purple-500/10 text-purple-400' : 'text-purple-300/60 hover:bg-violet-900/25'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </button>
          ))}

          {!hasPostedToday && (
            <button
              onClick={() => setShowShakeDuJour(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition-colors animate-pulse"
            >
              <Sun className="w-5 h-5" />
              <span className="font-medium">Shake du jour</span>
            </button>
          )}
        </nav>

        {currentUser && (
          <div className="mt-auto pt-4 border-t border-purple-500/25">
            <button
              onClick={() => setCurrentView('profile')}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-violet-900/25 transition-colors"
            >
              <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold text-sm truncate">{currentUser.displayName}</p>
                <p className="text-xs text-purple-300/60 truncate">@{currentUser.username}</p>
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Dialogs */}
      {showCreateShake && (
        <UnifiedComposerDialog
          open={showCreateShake}
          onClose={() => {
            setShowCreateShake(false);
            setRefreshFeed((p) => p + 1);
          }}
          onCreated={() => setRefreshFeed((p) => p + 1)}
          currentUser={currentUser}
        />
      )}
      {showShareDialog && <ShareDialog currentUser={currentUser} onClose={() => setShowShareDialog(false)} />}
      {showCompleteProfile && (
        <CompleteProfileDialog user={currentUser} onComplete={(u) => { setCurrentUser(buildUserObject(u)); setShowCompleteProfile(false); }} />
      )}
      {showShakeDuJour && (
        <ShakeDuJourDialog
          onComplete={() => { setShowShakeDuJour(false); setHasPostedToday(true); setRefreshFeed(p => p + 1); }}
          onSkip={() => setShowShakeDuJour(false)}
        />
      )}
      {showSettings && (
        <SettingsDialog
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onSave={(s) => { setCurrentUser({ ...currentUser, musicService: s.musicService }); }}
          onLogout={() => { setCurrentUser(null); setShowAuth(true); setShowSettings(false); }}
        />
      )}
      {/* Profile Preview from Notifications */}
      <AnimatePresence>
        {profilePreview && (
          <ProfilePreviewDialog
            userId={profilePreview.userId}
            username={profilePreview.username}
            onClose={() => setProfilePreview(null)}
          />
        )}
      </AnimatePresence>
      {/* Post Detail Modal from Notifications */}
      <AnimatePresence>
        {notifPostId && (
          <PostDetailModal
            postId={notifPostId}
            currentUser={currentUser}
            onClose={() => setNotifPostId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

