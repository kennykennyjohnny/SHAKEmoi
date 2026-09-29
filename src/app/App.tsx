import { useState, useEffect } from 'react';
import { Home, Search, PlusCircle, User, TrendingUp, Share2, MessageCircle, Sun, Bell, X } from 'lucide-react';
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
import { SongLanding } from './components/SongLanding';
import { PrivacyPage } from './components/PrivacyPage';
import { ProfileLanding } from './components/ProfileLanding';
import { takePendingAction, pendingActionReason } from '../lib/pendingAction';

import { CircleInviteView } from './components/CircleInviteView';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { NotificationsView } from './components/NotificationsView';
import { ProfilePreviewDialog } from './components/ProfilePreviewDialog';
import { PostDetailModal } from './components/PostDetailModal';
import { supabase } from '../lib/supabase';
import { getCurrentUser, getUserProfile, getUserNotifications, hasShakeToday, followUser, getUnreadMessagesCount, getCurrentShakeWeekStart } from '../lib/database';
import { useBackHandler } from '../lib/navigation';
import { parseRoute, type Route } from '../lib/links';
import { Slogan } from './components/Slogan';
import { InstallAppButton } from './components/InstallAppButton';

import { defaultAvatar, thumb } from '../lib/media';
import { isNotifTypeShown, notificationText, showLocalNotification } from '../lib/notify';
type View = 'feed' | 'search' | 'top' | 'profile' | 'messages' | 'notifications';

// Cercle à rejoindre après inscription (lien d'invitation ouvert sans compte).
const PENDING_CIRCLE_KEY = 'shakemoi_pending_circle';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('feed');
  const [showCreateShake, setShowCreateShake] = useState(false);
  const [showEphemeralShake, setShowEphemeralShake] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [refreshFeed, setRefreshFeed] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showShakeDuJour, setShowShakeDuJour] = useState(false);
  const [hasPostedToday, setHasPostedToday] = useState(true);
  const [viewOptions, setViewOptions] = useState<any>({});
  const [profilePreview, setProfilePreview] = useState<{ userId: string; username: string } | null>(null);
  const [notifPostId, setNotifPostId] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  // Session vérifiée (connecté ou non) : évite de traiter un membre en visiteur.
  const [authReady, setAuthReady] = useState(false);
  // Lien d'arrivée (/s, /p, /u, /i, /c, /m ou ancien format), voir lib/links.
  const [route, setRoute] = useState<Route | null>(() =>
    parseRoute(window.location.pathname, window.location.search, window.location.hash)
  );
  // Pourquoi on demande de se connecter (ex. « pour suivre @x »), affiché
  // au-dessus du formulaire dans la popup des visiteurs.
  const [authReason, setAuthReason] = useState<string | null>(null);

  // Page publique /confidentialite (politique de confidentialité).
  const [showPrivacy, setShowPrivacy] = useState(() => /^\/confidentialite\/?$/.test(window.location.pathname));
  const leaveRoute = () => {
    window.history.replaceState({}, document.title, '/');
    setRoute(null);
  };

  // G6 : le Shake de la semaine passe après la présentation et le profil.
  const [sdjPending, setSdjPending] = useState(false);
  useEffect(() => {
    if (!sdjPending || showOnboarding || showCompleteProfile) return;
    setSdjPending(false);
    localStorage.setItem('shakemoi_sdj_shown', getCurrentShakeWeekStart());
    setShowShakeDuJour(true);
  }, [sdjPending, showOnboarding, showCompleteProfile]);

  // Retour système : depuis un autre onglet, on revient au feed avant de
  // pouvoir quitter le site (les vues empilées se ferment en premier).
  useBackHandler(currentView !== 'feed', () => setCurrentView('feed'));

  const buildUserObject = (profile: any) => ({
    ...profile,
    avatar: profile.profile_album_cover_url || profile.avatar || defaultAvatar(profile.username),
    displayName: profile.display_name || profile.displayName || profile.username,
    bio: profile.bio || '',
    musicService: profile.preferred_platform || profile.musicService || 'spotify',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const storedRef = localStorage.getItem('shakemoi_referrer');
      if (storedRef) setReferrer(storedRef);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await getUserProfile(session.user.id);
        if (profile) {
          setCurrentUser(buildUserObject(profile));
          const needsOnboarding = !localStorage.getItem('shakemoi_onboarding');
          if (needsOnboarding) setShowOnboarding(true);
          const profileCompleted = localStorage.getItem('shakemoi_profile_completed');
          const needsProfile = !profileCompleted && (!profile.display_name || !profile.profile_album_cover_url);
          if (needsProfile) setShowCompleteProfile(true);
          const postedThisWeek = await hasShakeToday();
          setHasPostedToday(postedThisWeek);
          // Shake de la semaine : la popup s'ouvre une fois par SEMAINE (remise à
          // zéro le mardi à 9 h UTC), comme la règle, plus chaque jour (K1).
          const weekKey = getCurrentShakeWeekStart();
          if (!postedThisWeek && localStorage.getItem('shakemoi_sdj_shown') !== weekKey) {
            // G6 : jamais par-dessus la présentation ou « Compléter ton profil » :
            // elle attend que ces fenêtres soient fermées.
            if (needsOnboarding || needsProfile) setSdjPending(true);
            else { localStorage.setItem('shakemoi_sdj_shown', weekKey); setShowShakeDuJour(true); }
          }
        }
      }
      // Pas de session : on n'impose plus le mur d'inscription, le visiteur
      // atterrit sur la recherche/partage de son (voir plus bas). Un lien de
      // profil ou d'invitation affiche la page de la personne (ProfileLanding),
      // qui devient son parrain : il la suivra à l'inscription.
      else if (route?.type === 'profile' || route?.type === 'invite') {
        localStorage.setItem('shakemoi_referrer', route.id);
        setReferrer(route.id);
      }
      setAuthReady(true);
    };
    checkAuth();
  }, []);

  // Liens qui ouvrent quelque chose DANS l'app une fois connecté.
  useEffect(() => {
    // On attend de savoir si la personne est connectée : sinon un membre
    // connecté serait traité comme un visiteur le temps de charger sa session.
    if (!route || !authReady) return;
    if (route.type === 'conversation') {
      leaveRoute();
      if (currentUser) { setViewOptions({ initialTab: 'dms' }); setCurrentView('messages'); }
      else setShowAuth(true);
      return;
    }
    if (!currentUser) return;
    if (route.type === 'profile' || route.type === 'invite') {
      const username = route.id;
      leaveRoute();
      supabase.from('users_profile').select('id').eq('username', username).maybeSingle()
        .then(({ data }) => { if (data?.id) setProfilePreview({ userId: data.id, username }); });
    }
  }, [route, currentUser, authReady]);

  // Notifications: realtime + initial load
  useEffect(() => {
    if (!currentUser) return;

    const fetchCounts = async () => {
      try {
        const [notifs, msgCount] = await Promise.all([
          getUserNotifications(currentUser.id),
          getUnreadMessagesCount(),
        ]);
        setUnreadNotifs(notifs.filter((n: any) => !n.is_read).length);
        setUnreadMessages(msgCount);
      } catch {}
    };

    fetchCounts();

    // Realtime: new notification → update badge + push if enabled
    const notifChannel = supabase
      .channel(`app-notifs-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, async (payload: any) => {
        const type = payload.new?.type || '';
        // Réglages « Notifications » respectés (D5), messages hors cloche (A2).
        if (!isNotifTypeShown(type)) return;
        setUnreadNotifs(prev => prev + 1);
        let who = 'Quelqu\'un';
        try {
          const { data } = await supabase.from('users_profile').select('username').eq('id', payload.new?.from_user_id).maybeSingle();
          if (data?.username) who = `@${data.username}`;
        } catch {}
        showLocalNotification(`${who} ${notificationText(type)}`, `notif-${type}`);
      })
      .subscribe();

    // Pastille Messages = nombre de CONVERSATIONS non lues, recalculé en base
    // (A3) : à chaque message reçu, et quand une conversation est lue.
    let recount: ReturnType<typeof setTimeout> | null = null;
    const refreshUnreadMessages = () => {
      if (recount) clearTimeout(recount);
      recount = setTimeout(() => { getUnreadMessagesCount().then(setUnreadMessages).catch(() => {}); }, 600);
    };
    const msgChannel = supabase
      .channel(`app-messages-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${currentUser.id}`
      }, () => {
        refreshUnreadMessages();
        // Appli en arrière-plan : petite notif sur le téléphone.
        if (document.hidden) showLocalNotification('Tu as un nouveau message', 'message');
      })
      .subscribe();
    window.addEventListener('shakemoi:messages-read', refreshUnreadMessages);

    return () => {
      if (recount) clearTimeout(recount);
      window.removeEventListener('shakemoi:messages-read', refreshUnreadMessages);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [currentUser]);

  const handleAuthComplete = async (user: any) => {
    setCurrentUser(buildUserObject(user));
    setShowAuth(false);
    // Inscription lancée depuis une invitation de cercle : on y revient.
    const pendingCircle = localStorage.getItem(PENDING_CIRCLE_KEY);
    if (pendingCircle) {
      localStorage.removeItem(PENDING_CIRCLE_KEY);
      window.history.replaceState({}, document.title, `/c/${pendingCircle}`);
      setRoute({ type: 'circle', id: pendingCircle });
    }
    if (!localStorage.getItem('shakemoi_onboarding')) setShowOnboarding(true);
    setAuthReason(null);

    // Action lancée sans compte (suivre, shaker, envoyer) : on la termine et
    // on revient sur la recherche en cours, pas sur l'accueil.
    const pending = takePendingAction();
    if (pending) {
      if (pending.type === 'follow' && pending.userId && pending.userId !== user.id) {
        try { await followUser(pending.userId); } catch (err) { console.error('Suivi après connexion :', err); }
      }
      setCurrentView('search');
    }

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

  if (showPrivacy) {
    return <PrivacyPage onBack={() => { window.history.replaceState({}, document.title, '/'); setShowPrivacy(false); }} />;
  }

  // Profil partagé / invitation, pour un visiteur : la page de la personne
  // s'affiche tout de suite (plus besoin de cliquer sur « S'inscrire »).
  if ((route?.type === 'profile' || route?.type === 'invite') && !currentUser) {
    if (!authReady) {
      return (
        <div className="min-h-[100dvh] bg-[#1E1440] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500/40 border-t-purple-400 rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <ProfileLanding
        username={route.id}
        onSignUp={() => { leaveRoute(); setShowAuth(true); }}
        onLogin={() => { leaveRoute(); setShowAuth(true); }}
        onExplore={leaveRoute}
      />
    );
  }

  // Invitation dans un cercle.
  if (route?.type === 'circle') {
    return (
      <CircleInviteView
        circleId={route.id}
        currentUser={currentUser}
        onJoin={() => {
          leaveRoute();
          setViewOptions({ initialTab: 'circles' });
          setCurrentView('messages');
        }}
        onSignUp={() => {
          localStorage.setItem(PENDING_CIRCLE_KEY, route.id);
          leaveRoute();
          setShowAuth(true);
        }}
      />
    );
  }

  // Son ou post partagé : UNE seule page publique, identique pour tout le
  // monde (connecté ou non). Seul le bloc « compte » change.
  if (route?.type === 'song' || route?.type === 'post') {
    return (
      <SongLanding
        source={route.type === 'song' ? { type: 'song', slug: route.id } : { type: 'post', id: route.id }}
        currentUser={currentUser}
        onSignUp={() => { leaveRoute(); setShowAuth(true); }}
        onLogin={() => { leaveRoute(); setShowAuth(true); }}
        onOpenApp={() => { leaveRoute(); setCurrentView('feed'); }}
        onSearch={() => { leaveRoute(); setCurrentView('search'); }}
        onSharer={(username) => {
          // Visiteur : la personne qui partage devient son parrain, suivie
          // automatiquement à l'inscription (handleAuthComplete).
          if (currentUser) return;
          localStorage.setItem('shakemoi_referrer', username);
          setReferrer(username);
        }}
      />
    );
  }
  if (showOnboarding) return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  // Connecté (ou déconnexion en cours) : l'auth prend tout l'écran.
  // Pour un visiteur, elle s'ouvre en popup par-dessus la recherche (plus bas).
  if (showAuth && currentUser) return <AuthDialog onComplete={handleAuthComplete} referrer={referrer} />;

  // Visiteur sans compte : il peut chercher et partager un son librement.
  // Le compte n'est demandé que pour entrer dans la boucle sociale (shaker,
  // envoyer, liker) — la découverte, elle, reste ouverte.
  if (!currentUser) {
    return (
      <div className="h-[100dvh] w-screen bg-[#1E1440] text-white overflow-hidden flex flex-col">
        <header className="border-b border-violet-900/30 backdrop-blur-lg bg-[#1E1440]/80 sticky top-0 z-40 flex-shrink-0">
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-6 min-w-0 flex-shrink object-contain object-left" draggable={false} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAuth(true)}
                className="px-2.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap text-purple-200/80 hover:text-white hover:bg-violet-900/30 transition-colors"
              >
                Se connecter
              </button>
              <button
                onClick={() => setShowAuth(true)}
                className="px-3.5 py-1.5 whitespace-nowrap bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-bold hover:opacity-90 transition-opacity"
              >
                S'inscrire
              </button>
            </div>
          </div>
        </header>

        <InstallAppButton variant="banner" className="flex-shrink-0 lg:hidden" />

        <div className="px-4 pt-4 flex-shrink-0 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
            <Slogan />
          </p>
          <h1 className="text-lg font-bold">Cherche un son, partage-le à qui tu veux 🎧</h1>
          <p className="text-xs text-purple-300/60 mt-1">
            Pas besoin de compte. Crée-en un pour shaker et répondre à tes potes.
          </p>
        </div>

        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <SearchView
            currentUser={null}
            onRequireAuth={(action) => { setAuthReason(action ? pendingActionReason(action) : null); setShowAuth(true); }}
          />
        </main>

        {/* Connexion en popup : on revient à la recherche d'un seul geste,
            sans perdre ce qu'on était en train de faire. */}
        <AnimatePresence>
          {showAuth && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm overflow-y-auto"
              onClick={() => { setShowAuth(false); setAuthReason(null); takePendingAction(); }}
            >
              <button
                onClick={() => { setShowAuth(false); setAuthReason(null); takePendingAction(); }}
                aria-label="Fermer"
                className="fixed top-4 right-4 z-[80] p-2.5 rounded-full bg-black/50 hover:bg-white/15 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div onClick={(e) => e.stopPropagation()}>
                <AuthDialog onComplete={handleAuthComplete} referrer={referrer} reason={authReason} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return (
          <FeedView
            currentUser={currentUser}
            refreshFeed={refreshFeed}
            onShowEphemeralShake={() => setShowEphemeralShake(true)}
          />
        );
      case 'search':
        return <SearchView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'top':
        return <TopFriendsView currentUser={currentUser} onRefreshFeed={() => setRefreshFeed(p => p + 1)} />;
      case 'messages':
        return <MessagesView currentUser={currentUser} viewOptions={viewOptions} />;
      case 'notifications':
        return (
          <NotificationsView
            currentUser={currentUser}
            onNavigateToPost={(postId) => setNotifPostId(postId)}
            onNavigateToProfile={(userId) => setProfilePreview({ userId, username: '' })}
            onOpenConversation={(userId) => { setViewOptions({ initialTab: 'dms', openPartnerId: userId }); setCurrentView('messages'); }}
            onOpenCircle={(circleId) => { setViewOptions({ initialTab: 'circles', openCircleId: circleId }); setCurrentView('messages'); }}
          />
        );
      case 'profile':
        return <ProfileView user={currentUser} onUpdateUser={setCurrentUser} />;
      default:
        return <FeedView 
          currentUser={currentUser} 
          refreshFeed={refreshFeed}
          onShowEphemeralShake={() => setShowEphemeralShake(true)}
        />;
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#1E1440] text-white overflow-hidden flex">
      {/* Sidebar gauche - Trending */}
      <aside className="hidden xl:block w-80 border-r border-violet-900/30 overflow-y-auto">
        <TrendingBar />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-violet-900/30 backdrop-blur-lg bg-[#1E1440]/80 sticky top-0 z-40">
          <div className="px-4 py-2 flex items-center justify-between">
            <button onClick={() => { setCurrentView('feed'); }} className="focus:outline-none">
              <img src="/shakemoi-logo.png" alt="SHAKEmoi" className="h-6 object-contain" draggable={false} />
            </button>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowShareDialog(true)} className="p-2 hover:bg-violet-900/25 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-purple-300/60" />
              </button>

              {currentUser && (
                <button
                  onClick={async () => {
                    if (currentView === 'notifications') { setCurrentView('feed'); return; }
                    setCurrentView('notifications');
                    setUnreadNotifs(0);
                    try {
                      await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
                    } catch (err) { console.error('mark notifs read failed', err); }
                  }}
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

        {/* A5 : proposer d'installer l'appli, en haut de l'accueil */}
        {currentView === 'feed' && <InstallAppButton variant="banner" className="flex-shrink-0 lg:hidden" />}

        {/* Content */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              className="flex-1 flex flex-col min-h-0"
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
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-violet-900/30 backdrop-blur-lg bg-[#1E1440]/95 z-40">
          <div className="px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-around max-w-lg mx-auto">
            {([
              { view: 'feed' as View, icon: Home, label: 'Accueil' },
              { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
              { view: 'search' as View, icon: Search, label: 'Recherche' },
              { view: 'messages' as View, icon: MessageCircle, label: 'DMs' },
              { view: 'profile' as View, icon: User, label: 'Profil' },
            ]).map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => {
                  // L'onglet Messages s'ouvre toujours sur les messages privés.
                  if (view === 'messages') { setViewOptions({}); }
                  setCurrentView(view);
                }}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all active:scale-90 relative ${
                  currentView === view ? 'text-fuchsia-400 bg-fuchsia-500/15 shadow-lg shadow-fuchsia-500/10' : 'text-purple-300/60 hover:text-purple-200'
                }`}
              >
                <Icon className={`w-6 h-6 ${currentView === view ? 'drop-shadow-[0_0_6px_rgba(217,70,239,0.5)]' : ''}`} />
                {view === 'messages' && unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-pink-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Sidebar droite - Desktop */}
      <aside className="hidden lg:block w-64 border-l border-violet-900/30 p-4 overflow-y-auto">
        <nav className="space-y-2">
          {([
            { view: 'feed' as View, icon: Home, label: 'Accueil' },
            { view: 'top' as View, icon: TrendingUp, label: 'TOP' },
            // H3 : la Recherche manquait sur ordinateur.
            { view: 'search' as View, icon: Search, label: 'Recherche' },
            { view: 'messages' as View, icon: MessageCircle, label: 'Messages' },
            { view: 'profile' as View, icon: User, label: 'Profil' },
          ]).map(({ view, icon: Icon, label }) => (
            <button
              key={view}
              onClick={() => { if (view === 'messages') { setViewOptions({}); } setCurrentView(view); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors relative ${
                currentView === view ? 'bg-purple-500/10 text-purple-400' : 'text-purple-300/60 hover:bg-violet-900/25'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
              {view === 'messages' && unreadMessages > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-pink-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          ))}

          {!hasPostedToday && (
            <button
              onClick={() => setShowShakeDuJour(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition-colors animate-pulse"
            >
              <Sun className="w-5 h-5" />
              <span className="font-medium">Shake de la semaine</span>
            </button>
          )}
        </nav>

        {currentUser && (
          <div className="mt-auto pt-4 border-t border-purple-500/25">
            <button
              onClick={() => setCurrentView('profile')}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-violet-900/25 transition-colors"
            >
              <img loading="lazy" src={thumb(currentUser.avatar)} alt="" className="w-10 h-10 rounded-full object-cover" />
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
          initialComposerType="shake"
        />
      )}
      {showEphemeralShake && (
        <UnifiedComposerDialog
          open={showEphemeralShake}
          onClose={() => {
            setShowEphemeralShake(false);
            setRefreshFeed((p) => p + 1);
          }}
          onCreated={() => setRefreshFeed((p) => p + 1)}
          currentUser={currentUser}
          initialComposerType="story"
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

