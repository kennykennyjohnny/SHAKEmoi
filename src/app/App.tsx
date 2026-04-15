import { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, User, TrendingUp, Share2, MessageCircle, Sun, BarChart3 } from 'lucide-react';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { CreateShakeDialog } from './components/CreateShakeDialog';
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
import { WeeklyWrapView } from './components/WeeklyWrapView';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getUserProfile, getUserNotifications, hasShakeToday, getUserCircles } from '../lib/database';

type View = 'feed' | 'search' | 'top' | 'profile' | 'messages' | 'wrap';

function getSharedPostId(): string | null {
  const hash = window.location.hash;
  const m = hash.match(/\/s\/([a-f0-9-]+)/i) || window.location.pathname.match(/\/s\/([a-f0-9-]+)/i);
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
  const [circles, setCircles] = useState<any[]>([]);
  const [activeFeedCircleId, setActiveFeedCircleId] = useState<string | null>(null);
  const [viewOptions, setViewOptions] = useState<any>({});

  const loadUserCircles = async () => {
    try {
      const circles = await getUserCircles();
      setCircles(circles || []);
      if (activeFeedCircleId && !circles.some((c: any) => c.id === activeFeedCircleId)) {
        setActiveFeedCircleId(null);
      }
    } catch (error) {
      console.error('Error loading circles:', error);
    }
  };

  const openCircleFeed = (circleId: string | null) => {
    setActiveFeedCircleId(circleId);
    setCurrentView('feed');
  };

  const handleCircleCreated = (circleId: string) => {
    setActiveFeedCircleId(circleId);
    setCurrentView('feed');
    loadUserCircles();
  };

  const buildUserObject = (profile: any) => ({
    ...profile,
    avatar: profile.profile_album_cover_url || profile.avatar || `https://ui-avatars.com/api/?name=${profile.username}&background=random`,
    displayName: profile.display_name || profile.displayName || profile.username,
    bio: profile.bio || '',
    musicService: profile.preferred_platform || profile.musicService || 'spotify',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await getUserProfile(session.user.id);
        if (profile) {
          setCurrentUser(buildUserObject(profile));
          await loadUserCircles();
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
            new Notification('SHAKEmoi', { body: `@${notifs[0].actor_username} ${notifs[0].content}`, icon: '/favicon.ico' });
          }
        }
        if (notifs.length > 0) lastNotifId = notifs[0].id;
      } catch {}
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [currentUser]);

  const handleAuthComplete = (user: any) => {
    setCurrentUser(buildUserObject(user));
    setShowAuth(false);
    loadUserCircles();
    if (!localStorage.getItem('shakemoi_onboarding')) setShowOnboarding(true);
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

  // Shared post — public, no auth
  const sharedPostId = getSharedPostId();
  if (sharedPostId && !currentUser) {
    return <SharedPostView postId={sharedPostId} onJoin={() => { window.location.hash = ''; setShowAuth(true); }} />;
  }
  if (showOnboarding) return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  if (showAuth) return <AuthDialog onComplete={handleAuthComplete} />;

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return (
          <FeedView
            currentUser={currentUser}
            refreshFeed={refreshFeed}
            circles={circles}
            activeCircleId={activeFeedCircleId}
            onSelectCircle={openCircleFeed}
            onCreateCircle={() => { setCurrentView('messages'); setViewOptions({ initialTab: 'circles', initialShowCreate: true }); }}
          />
        );
      case 'search':
        return <SearchView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'top':
        return <TopFriendsView currentUser={currentUser} />;
      case 'messages':
        return <MessagesView currentUser={currentUser} onOpenCircle={openCircleFeed} onCircleCreated={handleCircleCreated} viewOptions={viewOptions} />;
      case 'wrap':
        return <WeeklyWrapView currentUser={currentUser} />;
      case 'profile':
        return <ProfileView user={currentUser} onUpdateUser={setCurrentUser} />;
      default:
        return <FeedView currentUser={currentUser} refreshFeed={refreshFeed} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0012] text-white overflow-hidden flex">
      {/* Sidebar gauche - Trending */}
      <aside className="hidden lg:block w-80 border-r border-rose-900/30 overflow-y-auto">
        <TrendingBar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-rose-900/30 backdrop-blur-lg bg-[#0a0012]/80 sticky top-0 z-40">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent" style={{ fontFamily: "'Maven Pro', sans-serif" }}>
              SHAKEmoi
            </span>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowShareDialog(true)} className="p-2 hover:bg-rose-900/25 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-rose-300/60" />
              </button>

              {/* Notifications bell — always visible */}
              {currentUser && (
                <NotificationsDropdown
                  userId={currentUser.id}
                  unreadCount={unreadNotifs}
                  onRead={() => setUnreadNotifs(0)}
                />
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
        <main className="flex-1 overflow-auto pb-20">
          {renderView()}
        </main>

        {/* Bottom Navigation Mobile — Feed, Top, Search, DMs, Profile */}
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-rose-900/30 backdrop-blur-lg bg-[#0a0012]/95 z-50">
          <div className="px-2 py-2 flex items-center justify-around max-w-md mx-auto">
            {([
              { view: 'feed' as View, icon: Home, label: 'Feed' },
              { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
              { view: 'search' as View, icon: Search, label: 'Recherche' },
              { view: 'messages' as View, icon: MessageCircle, label: 'DMs' },
              { view: 'profile' as View, icon: User, label: 'Profil' },
            ]).map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  currentView === view ? 'text-purple-400 bg-purple-500/10' : 'text-purple-300/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Sidebar droite - Desktop */}
      <aside className="hidden xl:block w-64 border-l border-rose-900/30 p-4 overflow-y-auto">
        <nav className="space-y-2">
          {([
            { view: 'feed' as View, icon: Home, label: 'Feed' },
            { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
            { view: 'messages' as View, icon: MessageCircle, label: 'Messages' },
            { view: 'wrap' as View, icon: BarChart3, label: 'Mon résumé' },
            { view: 'profile' as View, icon: User, label: 'Profil' },
          ]).map(({ view, icon: Icon, label }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                currentView === view ? 'bg-rose-500/10 text-rose-400' : 'text-rose-300/60 hover:bg-rose-900/25'
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
          <div className="mt-auto pt-4 border-t border-rose-800/25">
            <button
              onClick={() => setCurrentView('profile')}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-rose-900/25 transition-colors"
            >
              <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold text-sm truncate">{currentUser.displayName}</p>
                <p className="text-xs text-rose-300/60 truncate">@{currentUser.username}</p>
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Dialogs */}
      {showCreateShake && (
        <CreateShakeDialog currentUser={currentUser} onClose={() => { setShowCreateShake(false); setRefreshFeed(p => p + 1); }} />
      )}
      {showShareDialog && <ShareDialog onClose={() => setShowShareDialog(false)} />}
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
    </div>
  );
}

