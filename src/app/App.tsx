import { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, Bell, User, TrendingUp, Headphones, Share2, Settings } from 'lucide-react';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { CreateShakeDialog } from './components/CreateShakeDialog';
import { PlayerBar } from './components/PlayerBar';
import { TrendingBar } from './components/TrendingBar';
import { OnboardingDialog } from './components/OnboardingDialog';
import { ShareDialog } from './components/ShareDialog';
import { AuthDialog } from './components/AuthDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { Logo } from './components/Logo';
import { LogoShowcase } from './components/LogoShowcase';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getUserProfile } from '../lib/database';

type View = 'feed' | 'top' | 'profile' | 'notifications';

export default function App() {
  // CHANGE THIS TO false WHEN YOU'VE CHOSEN YOUR LOGO
  const [showLogoShowcase, setShowLogoShowcase] = useState(false);
  
  const [currentView, setCurrentView] = useState<View>('feed');
  const [showCreateShake, setShowCreateShake] = useState(false);
  const [showShakeTabs, setShowShakeTabs] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(0);

  // Logo showcase mode
  if (showLogoShowcase) {
    return (
      <div className="relative">
        <LogoShowcase />
        <button
          onClick={() => setShowLogoShowcase(false)}
          className="fixed top-4 right-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-white hover:opacity-90 transition-opacity shadow-xl z-50"
        >
          Retour à l'app
        </button>
      </div>
    );
  }

  useEffect(() => {
    // Check if user is authenticated with Supabase
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is logged in, fetch profile
        const profile = await getUserProfile(session.user.id);
        if (profile) {
          setCurrentUser(profile);

          // Check onboarding
          const hasCompletedOnboarding = localStorage.getItem('shakemoi_onboarding');
          if (!hasCompletedOnboarding) {
            setShowOnboarding(true);
          }
        } else {
          // No profile found, show auth dialog
          setShowAuth(true);
        }
      } else {
        // No session, show auth dialog
        setShowAuth(true);
      }
    };

    checkAuth();
  }, []);

  const handleAuthComplete = (user: any) => {
    // Transform user to match ProfileView expectations
    const profileUser = {
      ...user,
      avatar: user.profile_album_cover_url || user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=random`,
      displayName: user.username,
      bio: user.bio || ''
    };
    setCurrentUser(profileUser);
    setShowAuth(false);
    
    // Check if needs onboarding
    const hasCompletedOnboarding = localStorage.getItem('shakemoi_onboarding');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  };

  const loadUserData = async (preferences: any) => {
    try {
      const user = await getCurrentUser();
      if (user) {
        const profile = await getUserProfile(user.id);
        if (profile) {
          // Update with onboarding preferences if they exist
          if (preferences.musicService) {
            // Update music service preference in profile
            await supabase
              .from('users_profile')
              .update({ music_service: preferences.musicService })
              .eq('id', user.id);
          }
          // Transform to match ProfileView expectations
          const profileUser = {
            ...profile,
            avatar: profile.profile_album_cover_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`,
            displayName: profile.username,
            bio: ''
          };
          setCurrentUser(profileUser);
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const handleOnboardingComplete = async (preferences: { musicService: 'spotify' | 'apple' }) => {
    localStorage.setItem('shakemoi_onboarding', JSON.stringify(preferences));
    setShowOnboarding(false);
    await loadUserData(preferences);
  };

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (showAuth) {
    return <AuthDialog onComplete={handleAuthComplete} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return <FeedView currentUser={currentUser} onPlayTrack={setCurrentTrack} refreshFeed={refreshFeed} />;
      case 'top':
        return (
          <div className="h-full overflow-y-auto">
            <TrendingBar onPlayTrack={setCurrentTrack} />
          </div>
        );
      case 'profile':
        return <ProfileView user={currentUser} onPlayTrack={setCurrentTrack} onUpdateUser={setCurrentUser} />;
      case 'notifications':
        return <NotificationsView currentUser={currentUser} />;
      default:
        return <FeedView currentUser={currentUser} onPlayTrack={setCurrentTrack} refreshFeed={refreshFeed} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden flex">
      {/* Sidebar gauche - Trending */}
      <aside className="hidden lg:block w-80 border-r border-zinc-800 overflow-y-auto">
        <TrendingBar onPlayTrack={setCurrentTrack} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-zinc-800 backdrop-blur-lg bg-black/50 sticky top-0 z-40">
          <div className="px-4 py-2 flex items-center justify-between">
            <Logo size="md" animated={true} />
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareDialog(true)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors group"
                title="Partager Shakemoi"
              >
                <Share2 className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </button>

              <button
                onClick={() => setShowCreateShake(true)}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Shake
              </button>
              
              <button 
                onClick={() => setCurrentView('profile')}
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all"
              >
                <img src={currentUser?.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto pb-32 lg:pb-20">
          {renderView()}
        </main>

        {/* Bottom Navigation Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-zinc-800 backdrop-blur-lg bg-black/95 z-50">
          <div className="px-2 py-2 flex items-center justify-around max-w-md mx-auto">
            <button
              onClick={() => setCurrentView('feed')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                currentView === 'feed' ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-xs font-medium">Feed</span>
            </button>
            
            <button
              onClick={() => setCurrentView('top')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                currentView === 'top' ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-medium">TOP</span>
            </button>
            
            <button
              onClick={() => setShowShakeTabs(true)}
              className="relative -mt-6 p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg"
            >
              <PlusCircle className="w-6 h-6" />
            </button>
            
            <button
              onClick={() => setCurrentView('notifications')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                currentView === 'notifications' ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span className="text-xs font-medium">Notifs</span>
            </button>
            
            <button
              onClick={() => setCurrentView('profile')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                currentView === 'profile' ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">Profil</span>
            </button>
          </div>
        </nav>

        {/* Player Bar - Fixed above bottom nav */}
        {currentTrack && (
          <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-40">
            <PlayerBar 
              track={currentTrack} 
              onClose={() => setCurrentTrack(null)}
              musicService={currentUser?.musicService}
            />
          </div>
        )}
      </div>

      {/* Sidebar droite - Desktop Navigation */}
      <aside className="hidden xl:block w-64 border-l border-zinc-800 p-4 overflow-y-auto">
        <nav className="space-y-2">
          <button
            onClick={() => setCurrentView('feed')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              currentView === 'feed' ? 'bg-purple-500/10 text-purple-500' : 'text-gray-400 hover:bg-zinc-800'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Feed</span>
          </button>
          
          <button
            onClick={() => setCurrentView('top')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              currentView === 'top' ? 'bg-purple-500/10 text-purple-500' : 'text-gray-400 hover:bg-zinc-800'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">TOP</span>
          </button>
          
          <button
            onClick={() => setCurrentView('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              currentView === 'notifications' ? 'bg-purple-500/10 text-purple-500' : 'text-gray-400 hover:bg-zinc-800'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">Notifications</span>
          </button>
          
          <button
            onClick={() => setCurrentView('profile')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              currentView === 'profile' ? 'bg-purple-500/10 text-purple-500' : 'text-gray-400 hover:bg-zinc-800'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="font-medium">Profil</span>
          </button>

          <div className="border-t border-zinc-800 my-4 pt-4">
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-zinc-800 transition-colors">
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">Tendances</span>
            </button>
            
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-zinc-800 transition-colors">
              <Headphones className="w-5 h-5" />
              <span className="font-medium">Playlists</span>
            </button>
          </div>
        </nav>

        {/* User card */}
        {currentUser && (
          <div className="mt-auto pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
              <img src={currentUser.avatar} alt={currentUser.displayName} className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{currentUser.displayName}</p>
                <p className="text-xs text-gray-400 truncate">@{currentUser.username}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Shake Tabs Dialog */}
      {showShakeTabs && (
        <ShakeTabsDialog onClose={() => setShowShakeTabs(false)} />
      )}

      {/* Create Shake Dialog */}
      {showCreateShake && (
        <CreateShakeDialog
          currentUser={currentUser}
          onClose={() => {
            setShowCreateShake(false);
            // Refresh feed after creating a shake
            setRefreshFeed(prev => prev + 1);
          }}
        />
      )}

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog onClose={() => setShowShareDialog(false)} />
      )}

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog 
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onSave={(settings) => {
            const updatedUser = { ...currentUser, musicService: settings.musicService };
            setCurrentUser(updatedUser);
            localStorage.setItem('shakemoi_user', JSON.stringify(updatedUser));
          }}
          onLogout={() => {
            setCurrentUser(null);
            setShowAuth(true);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}