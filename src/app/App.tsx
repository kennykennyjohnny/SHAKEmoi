import { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, User, TrendingUp, Share2, MessageCircle, Users, Sun, BarChart3, Settings } from 'lucide-react';
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
import { CirclesView } from './components/CirclesView';
import { SharedPostView } from './components/SharedPostView';
import { WeeklyWrapView } from './components/WeeklyWrapView';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getUserProfile, getUserNotifications, hasShakeToday, getUserCircles, getCircleMembers, searchUsers, addCircleMember, removeCircleMember } from '../lib/database';

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
  // Circle tabs on feed
  const [circles, setCircles] = useState<any[]>([]);
  const [activeFeedTab, setActiveFeedTab] = useState<string>('feed'); // 'feed' or circle ID
  const [showCircleSettings, setShowCircleSettings] = useState(false);

  const buildUserObject = (profile: any) => ({
    ...profile,
    avatar: profile.profile_album_cover_url || profile.avatar || `https://ui-avatars.com/api/?name=${profile.username}&background=random`,
    displayName: profile.display_name || profile.displayName || profile.username,
    bio: profile.bio || '',
    musicService: profile.preferred_platform || profile.musicService || 'spotify',
  });

  const loadCircles = async () => {
    try {
      const c = await getUserCircles();
      setCircles(c);
    } catch {}
  };

  useEffect(() => {
    const checkAuth = async () => {
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
          // Load circles for tabs
          await loadCircles();
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

  const activeCircle = activeFeedTab !== 'feed' ? circles.find(c => c.id === activeFeedTab) : null;

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return <FeedView currentUser={currentUser} refreshFeed={refreshFeed} circleId={activeCircle?.id} />;
      case 'search':
        return <SearchView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'top':
        return <TopFriendsView currentUser={currentUser} />;
      case 'messages':
        return <MessagesView currentUser={currentUser} />;
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
              {/* Circle settings gear — only when viewing a circle */}
              {currentView === 'feed' && activeCircle && (
                <button
                  onClick={() => setShowCircleSettings(!showCircleSettings)}
                  className="p-2 hover:bg-rose-900/25 rounded-full transition-colors"
                  title={`Paramètres ${activeCircle.name}`}
                >
                  <Settings className="w-5 h-5 text-rose-300/60 hover:text-rose-400" />
                </button>
              )}

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

          {/* Swipeable underline tab bar — only on feed view */}
          {currentView === 'feed' && circles.length > 0 && (
            <div className="relative flex overflow-x-auto no-scrollbar border-b border-rose-800/25">
              <button
                onClick={() => setActiveFeedTab('feed')}
                className={`flex-shrink-0 px-5 py-2 text-sm font-semibold transition-colors relative ${
                  activeFeedTab === 'feed' ? 'text-white' : 'text-rose-300/50 hover:text-white'
                }`}
              >
                Feed
                {activeFeedTab === 'feed' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                )}
              </button>
              {circles.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveFeedTab(c.id)}
                  className={`flex-shrink-0 px-5 py-2 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
                    activeFeedTab === c.id ? 'text-white' : 'text-rose-300/50 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {c.name}
                  {activeFeedTab === c.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto pb-20">
          {renderView()}
        </main>

        {/* Circle settings inline panel */}
        {showCircleSettings && activeCircle && (
          <CircleSettingsPanel
            circle={activeCircle}
            onClose={() => setShowCircleSettings(false)}
            onUpdate={loadCircles}
          />
        )}

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
                  currentView === view ? 'text-rose-400 bg-rose-500/10' : 'text-rose-300/60'
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

// ==================== Circle Settings Panel ====================
function CircleSettingsPanel({ circle, onClose, onUpdate }: { circle: any; onClose: () => void; onUpdate: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<any[]>([]);

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    setMembers(await getCircleMembers(circle.id));
  };

  useEffect(() => {
    if (searchQ.length < 2) { setSearchRes([]); return; }
    const t = setTimeout(async () => {
      setSearchRes(await searchUsers(searchQ));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  const addMember = async (userId: string) => {
    await addCircleMember(circle.id, userId);
    await loadMembers();
    setSearchQ('');
  };

  const removeMember = async (userId: string) => {
    await removeCircleMember(circle.id, userId);
    await loadMembers();
  };

  const leaveCircle = async () => {
    const user = await getCurrentUser();
    if (user) {
      await removeCircleMember(circle.id, user.id);
      onUpdate();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0020] rounded-2xl w-full max-w-sm border border-rose-800/25 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-rose-800/25">
          <h3 className="font-bold text-lg">{circle.name}</h3>
          <p className="text-xs text-rose-300/70 mt-0.5">ID: {circle.id.slice(0, 8)}...</p>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-purple-200/80">Membres ({members.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => (
              <span key={m.id} className="flex items-center gap-1 bg-rose-950/25 rounded-full px-2 py-1 text-xs border border-rose-800/25">
                <img src={m.profile_album_cover_url || `https://ui-avatars.com/api/?name=${m.username}&background=random`} className="w-4 h-4 rounded-full" alt="" />
                @{m.username}
                <button onClick={() => removeMember(m.id)} className="text-rose-300/50 hover:text-red-400 ml-0.5">&times;</button>
              </span>
            ))}
          </div>

          <input
            type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Ajouter un ami..."
            className="w-full px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-sm text-white placeholder-rose-300/50 focus:outline-none focus:border-purple-500"
          />
          {searchRes.filter(u => !members.find(m => m.id === u.id)).slice(0, 5).map(u => (
            <button key={u.id} onClick={() => addMember(u.id)} className="w-full flex items-center gap-2 p-2 hover:bg-rose-900/25 rounded-lg text-sm">
              <img src={u.profile_album_cover_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`} className="w-6 h-6 rounded-full" alt="" />
              @{u.username}
              <span className="ml-auto text-purple-400 text-xs">+ Ajouter</span>
            </button>
          ))}

          <button onClick={leaveCircle} className="w-full py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors">
            Quitter ce cercle
          </button>
        </div>
      </div>
    </div>
  );
}
