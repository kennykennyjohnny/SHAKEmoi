// ===== APPLICATION PRINCIPALE SHAKEMOI =====

class ShakemoiApp {
  constructor() {
    this.currentView = 'feed';
    this.isLoading = true;
    this.user = null;
    this.friends = [];
    this.posts = [];
    
    // Récupération des utilitaires
    const utils = window.SHAKEMOI_UTILS;
    this.logger = utils.logger;
    this.DOM = utils.DOM;
    this.storage = utils.storage;
    this.animations = utils.animations;
    
    this.init();
  }
  
  // Initialisation de l'application
  async init() {
    this.logger.info('Initialisation de SHAKEMOI...');
    
    try {
      // Masquer le loading après un délai minimum
      setTimeout(() => this.hideLoading(), 1500);
      
      // Initialiser les composants
      this.setupNavigation();
      this.setupViewSwitcher();
      this.setupMoodSelector();
      this.setupEventListeners();
      
      // Charger les données utilisateur
      await this.loadUserData();
      
      // Charger les données de test
      this.loadMockData();
      
      // Rendre l'interface
      this.renderCurrentView();
      
      this.logger.info('SHAKEMOI initialisé avec succès');
      
    } catch (error) {
      this.logger.error('Erreur lors de l\'initialisation', error);
    }
  }
  
  // Masquer l'écran de chargement
  hideLoading() {
    const loadingScreen = this.DOM.$('#loading-screen');
    if (loadingScreen) {
      this.DOM.addClass(loadingScreen, 'hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 400);
    }
  }
  
  // Configuration de la navigation
  setupNavigation() {
    const navItems = this.DOM.$$('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) {
          this.switchView(view);
        }
      });
    });
  }
  
  // Système de changement de vues
  setupViewSwitcher() {
    this.views = {
      feed: this.DOM.$('#feed-view'),
      discover: this.DOM.$('#discover-view'),
      share: this.DOM.$('#share-view'),
      friends: this.DOM.$('#friends-view'),
      profile: this.DOM.$('#profile-view')
    };
  }
  
  // Changer de vue
  switchView(newView) {
    if (this.currentView === newView) return;
    
    this.logger.info(`Changement de vue: ${this.currentView} → ${newView}`);
    
    // Mettre à jour la navigation
    const navItems = this.DOM.$$('.nav-item');
    navItems.forEach(item => {
      this.DOM.removeClass(item, 'active');
      if (item.dataset.view === newView) {
        this.DOM.addClass(item, 'active');
      }
    });
    
    // Mettre à jour les vues
    Object.values(this.views).forEach(view => {
      this.DOM.removeClass(view, 'active');
      this.DOM.removeClass(view, 'prev');
    });
    
    // Ajouter la classe prev à la vue actuelle
    if (this.views[this.currentView]) {
      this.DOM.addClass(this.views[this.currentView], 'prev');
    }
    
    // Activer la nouvelle vue
    if (this.views[newView]) {
      this.DOM.addClass(this.views[newView], 'active');
    }
    
    this.currentView = newView;
    this.renderCurrentView();
    
    // Trigger événement personnalisé
    document.dispatchEvent(new CustomEvent('viewChanged', {
      detail: { newView, timestamp: Date.now() }
    }));
  }
  
  // Configuration du sélecteur de mood
  setupMoodSelector() {
    const moodButtons = this.DOM.$$('.mood-btn');
    
    moodButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Retirer active de tous les boutons
        moodButtons.forEach(btn => this.DOM.removeClass(btn, 'active'));
        // Ajouter active au bouton cliqué
        this.DOM.addClass(button, 'active');
        
        const mood = button.dataset.mood;
        this.filterByMood(mood);
      });
    });
  }
  
  // Filtrer par mood
  filterByMood(mood) {
    this.logger.info(`Filtre par mood: ${mood}`);
    // Ici on filtrerait les posts selon le mood
    // Pour le moment, on log juste
  }
  
  // Configuration des écouteurs d'événements
  setupEventListeners() {
    // Gestion du bouton retour (Android)
    window.addEventListener('popstate', (e) => {
      this.handleBackButton();
    });
    
    // Gestion de la recherche
    const searchInput = this.DOM.$('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', this.handleSearch.bind(this));
    }
    
    // Gestion du online/offline
    window.addEventListener('online', () => {
      this.logger.info('Connexion rétablie');
      this.handleOnlineStatus(true);
    });
    
    window.addEventListener('offline', () => {
      this.logger.warn('Connexion perdue');
      this.handleOnlineStatus(false);
    });
  }
  
  // Gestion du bouton retour
  handleBackButton() {
    if (this.currentView !== 'feed') {
      this.switchView('feed');
    }
  }
  
  // Gestion de la recherche
  handleSearch(e) {
    const query = e.target.value.trim();
    this.logger.info(`Recherche: "${query}"`);
    
    if (query.length > 2) {
      // Effectuer la recherche
      this.performSearch(query);
    }
  }
  
  // Effectuer une recherche
  performSearch(query) {
    // TODO: Implémenter la recherche réelle
    this.logger.info(`Recherche pour: ${query}`);
  }
  
  // Gestion du statut online/offline
  handleOnlineStatus(isOnline) {
    if (isOnline) {
      // Synchroniser les données
      this.syncData();
    } else {
      // Passer en mode offline
      this.enableOfflineMode();
    }
  }
  
  // Charger les données utilisateur
  async loadUserData() {
    try {
      const userData = this.storage.get('user');
      if (userData) {
        this.user = userData;
        this.logger.info('Données utilisateur chargées depuis le cache');
      } else {
        // Données par défaut
        this.user = {
          id: 'user_' + Date.now(),
          name: 'Ton Nom',
          avatar: 'assets/images/default-avatar.jpg',
          platform: 'spotify',
          stats: {
            shares: 0,
            friends: 0,
            discoveries: 0
          }
        };
        this.storage.set('user', this.user);
      }
    } catch (error) {
      this.logger.error('Erreur lors du chargement des données utilisateur', error);
    }
  }
  
  // Charger les données de test
  loadMockData() {
    // Données de test pour le développement
    this.friends = [
      {
        id: 'friend_1',
        name: 'Alex',
        avatar: 'https://i.pravatar.cc/100?img=1',
        isOnline: true,
        status: 'Écoute PNL',
        platform: 'spotify'
      },
      {
        id: 'friend_2',
        name: 'Sarah',
        avatar: 'https://i.pravatar.cc/100?img=2',
        isOnline: true,
        status: 'Dans ses playlists',
        platform: 'apple'
      },
      {
        id: 'friend_3',
        name: 'Marcus',
        avatar: 'https://i.pravatar.cc/100?img=3',
        isOnline: false,
        status: 'Dernière connexion: 2h',
        platform: 'spotify'
      }
    ];
    
    this.posts = [
      {
        id: 'post_1',
        user: this.friends[0],
        timestamp: Date.now() - 300000, // 5 min ago
        text: 'Cette track me donne des frissons à chaque fois 🔥',
        music: {
          title: 'Au DD',
          artist: 'PNL',
          album: 'Deux frères',
          cover: 'https://i.scdn.co/image/ab67616d0000b273ec82d0c6b6658cb3e75de0c0',
          platform: 'spotify',
          url: 'https://open.spotify.com/track/example'
        },
        mood: 'hype',
        likes: 3,
        comments: 1
      },
      {
        id: 'post_2',
        user: this.friends[1],
        timestamp: Date.now() - 900000, // 15 min ago
        text: 'Découverte du jour, je recommande grave',
        music: {
          title: 'Bande organisée',
          artist: 'Jul, SCH, Naps, Kofs, Elams, Solda, Houari, Soso Maness',
          album: 'Bande organisée',
          cover: 'https://i.scdn.co/image/ab67616d0000b273d063e468d3ac55a369653fd4',
          platform: 'apple',
          url: 'https://music.apple.com/track/example'
        },
        mood: 'chill',
        likes: 7,
        comments: 2
      }
    ];
    
    this.logger.info('Données de test chargées');
  }
  
  // Rendu de la vue actuelle
  renderCurrentView() {
    switch (this.currentView) {
      case 'feed':
        this.renderFeedView();
        break;
      case 'discover':
        this.renderDiscoverView();
        break;
      case 'share':
        this.renderShareView();
        break;
      case 'friends':
        this.renderFriendsView();
        break;
      case 'profile':
        this.renderProfileView();
        break;
    }
  }
  
  // Rendu de la vue Feed
  renderFeedView() {
    const feedContainer = this.DOM.$('.feed-posts');
    if (!feedContainer) return;
    
    // Générer les stories
    this.renderStories();
    
    // Générer les posts
    feedContainer.innerHTML = '';
    
    this.posts.forEach(post => {
      const postElement = this.createPostElement(post);
      feedContainer.appendChild(postElement);
    });
  }
  
  // Rendu des stories
  renderStories() {
    const storyBar = this.DOM.$('.story-bar');
    if (!storyBar) return;
    
    // Garder le bouton "Partager"
    const addStory = storyBar.querySelector('.add-story');
    storyBar.innerHTML = '';
    if (addStory) {
      storyBar.appendChild(addStory);
    }
    
    // Ajouter les stories des amis
    this.friends.filter(friend => friend.isOnline).forEach(friend => {
      const storyElement = this.createStoryElement(friend);
      storyBar.appendChild(storyElement);
    });
  }
  
  // Créer un élément story
  createStoryElement(friend) {
    const storyItem = this.DOM.create('div', 'story-item');
    
    storyItem.innerHTML = `
      <div class="story-avatar ${friend.isOnline ? 'live' : ''}">
        <img src="${friend.avatar}" alt="${friend.name}">
      </div>
      <span>${friend.name}</span>
    `;
    
    storyItem.addEventListener('click', () => {
      this.openFriendStory(friend);
    });
    
    return storyItem;
  }
  
  // Créer un élément post
  createPostElement(post) {
    const postCard = this.DOM.create('article', 'post-card fade-in');
    
    postCard.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">
          <img src="${post.user.avatar}" alt="${post.user.name}">
        </div>
        <div class="post-user-info">
          <h4>${post.user.name}</h4>
          <span class="post-time">${window.SHAKEMOI_UTILS.formatUtils.timeAgo(post.timestamp)}</span>
        </div>
      </div>
      
      <div class="post-content">
        <p class="post-text">${post.text}</p>
        
        <div class="music-card" data-url="${post.music.url}">
          <div class="music-artwork">
            <img src="${post.music.cover}" alt="${post.music.title}">
            <div class="play-button">
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="white"/>
              </svg>
            </div>
          </div>
          
          <div class="music-info">
            <h5>${post.music.title}</h5>
            <p class="music-artist">${post.music.artist}</p>
          </div>
          
          <div class="music-platform">
            <img src="assets/images/${post.music.platform}-icon.png" alt="${post.music.platform}" class="platform-icon">
            ${post.music.platform}
          </div>
        </div>
      </div>
      
      <div class="post-actions">
        <button class="action-btn like-btn" data-post="${post.id}">
          <svg viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span>${post.likes}</span>
        </button>
        
        <button class="action-btn comment-btn" data-post="${post.id}">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${post.comments}</span>
        </button>
        
        <button class="action-btn share-btn" data-post="${post.id}">
          <svg viewBox="0 0 24 24">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
          <span>Partager</span>
        </button>
      </div>
    `;
    
    // Ajouter les événements
    this.setupPostEvents(postCard, post);
    
    return postCard;
  }
  
  // Configuration des événements des posts
  setupPostEvents(postElement, post) {
    // Clic sur la carte musique
    const musicCard = postElement.querySelector('.music-card');
    musicCard.addEventListener('click', () => {
      this.openMusicLink(post.music.url, post.music.platform);
    });
    
    // Bouton like
    const likeBtn = postElement.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => {
      this.toggleLike(post.id);
    });
    
    // Bouton commentaire
    const commentBtn = postElement.querySelector('.comment-btn');
    commentBtn.addEventListener('click', () => {
      this.openComments(post.id);
    });
    
    // Bouton partage
    const shareBtn = postElement.querySelector('.share-btn');
    shareBtn.addEventListener('click', () => {
      this.sharePost(post.id);
    });
  }
  
  // Ouvrir un lien musical
  openMusicLink(url, platform) {
    this.logger.info(`Ouverture du lien ${platform}: ${url}`);
    
    // Détecter la plateforme de l'utilisateur et rediriger intelligemment
    if (this.user.platform === platform) {
      // Même plateforme, ouvrir directement
      window.open(url, '_blank');
    } else {
      // Plateforme différente, proposer des alternatives
      this.showPlatformOptions(url, platform);
    }
  }
  
  // Afficher les options de plateforme
  showPlatformOptions(url, originalPlatform) {
    // TODO: Implémenter la modal de choix de plateforme
    this.logger.info(`Options de plateforme pour ${originalPlatform}`);
    
    // Pour le moment, ouvrir directement
    window.open(url, '_blank');
  }
  
  // Rendu des autres vues (à implémenter)
  renderDiscoverView() {
    this.logger.info('Rendu de la vue Discover');
    // TODO: Implémenter le rendu de la vue découverte
  }
  
  renderShareView() {
    this.logger.info('Rendu de la vue Share');
    // TODO: Implémenter le rendu de la vue partage
  }
  
  renderFriendsView() {
    this.logger.info('Rendu de la vue Friends');
    
    const onlineFriends = this.DOM.$('.friends-list.online');
    const allFriends = this.DOM.$('.friends-list.all');
    
    if (onlineFriends) {
      onlineFriends.innerHTML = '';
      this.friends.filter(f => f.isOnline).forEach(friend => {
        onlineFriends.appendChild(this.createFriendElement(friend));
      });
    }
    
    if (allFriends) {
      allFriends.innerHTML = '';
      this.friends.forEach(friend => {
        allFriends.appendChild(this.createFriendElement(friend));
      });
    }
  }
  
  renderProfileView() {
    this.logger.info('Rendu de la vue Profile');
    
    // Mettre à jour les informations utilisateur
    const userAvatar = this.DOM.$('#user-avatar');
    const userName = this.DOM.$('#user-name');
    const userPlatform = this.DOM.$('#user-platform');
    
    if (userAvatar) userAvatar.src = this.user.avatar;
    if (userName) userName.textContent = this.user.name;
    if (userPlatform) userPlatform.textContent = `Connecté via ${this.user.platform}`;
    
    // Mettre à jour les statistiques
    const sharesCount = this.DOM.$('#shares-count');
    const friendsCount = this.DOM.$('#friends-count');
    const discoveriesCount = this.DOM.$('#discoveries-count');
    
    if (sharesCount) sharesCount.textContent = this.user.stats.shares;
    if (friendsCount) friendsCount.textContent = this.user.stats.friends;
    if (discoveriesCount) discoveriesCount.textContent = this.user.stats.discoveries;
  }
  
  // Créer un élément ami
  createFriendElement(friend) {
    const friendItem = this.DOM.create('div', 'friend-item');
    
    friendItem.innerHTML = `
      <div class="friend-avatar ${friend.isOnline ? 'online' : ''}">
        <img src="${friend.avatar}" alt="${friend.name}">
      </div>
      <div class="friend-info">
        <div class="friend-name">${friend.name}</div>
        <div class="friend-status">
          ${friend.isOnline ? '<span class="status-dot"></span>' : ''}
          ${friend.status}
        </div>
      </div>
    `;
    
    friendItem.addEventListener('click', () => {
      this.openFriendProfile(friend);
    });
    
    return friendItem;
  }
  
  // Actions sur les posts
  toggleLike(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.likes += 1;
      this.logger.info(`Like ajouté au post ${postId}`);
      // Mettre à jour l'affichage
      this.renderCurrentView();
    }
  }
  
  openComments(postId) {
    this.logger.info(`Ouverture des commentaires pour ${postId}`);
    // TODO: Implémenter la modal de commentaires
  }
  
  sharePost(postId) {
    this.logger.info(`Partage du post ${postId}`);
    // TODO: Implémenter le partage de post
  }
  
  openFriendStory(friend) {
    this.logger.info(`Ouverture de la story de ${friend.name}`);
    // TODO: Implémenter la vue story
  }
  
  openFriendProfile(friend) {
    this.logger.info(`Ouverture du profil de ${friend.name}`);
    // TODO: Implémenter la vue profil d'ami
  }
  
  // Synchronisation des données
  syncData() {
    this.logger.info('Synchronisation des données...');
    // TODO: Implémenter la synchronisation avec l'API
  }
  
  // Mode offline
  enableOfflineMode() {
    this.logger.warn('Mode offline activé');
    // TODO: Implémenter le mode offline
  }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
  window.shakemoiApp = new ShakemoiApp();
});

// Export pour debug
---

## Intégration Spotify API

### Configuration Spotify

**Copier dans `scripts/spotify.js`** :

```javascript
// ===== INTÉGRATION SPOTIFY API =====

class SpotifyAPI {
  constructor() {
    this.clientId = SHAKEMOI_CONFIG.SPOTIFY_CLIENT_ID;
    this.redirectUri = window.location.origin;
    this.scope = 'user-read-private user-read-email user-read-currently-playing user-read-recently-played user-modify-playback-state streaming';
    this.accessToken = null;
    this.refreshToken = null;
    this.isConnected = false;
    
    this.logger = window.SHAKEMOI_UTILS.logger;
    this.storage = window.SHAKEMOI_UTILS.storage;
    
    this.init();
  }
  
  init() {
    // Vérifier si on a un token sauvegardé
    this.loadTokenFromStorage();
    
    // Vérifier si on revient d'une auth Spotify
    this.handleAuthCallback();
  }
  
  // Charger le token depuis le stockage
  loadTokenFromStorage() {
    const tokenData = this.storage.get('spotify_token');
    if (tokenData && tokenData.expiresAt > Date.now()) {
      this.accessToken = tokenData.accessToken;
      this.refreshToken = tokenData.refreshToken;
      this.isConnected = true;
      this.logger.info('Token Spotify chargé depuis le cache');
    }
  }
  
  // Gérer le callback d'authentification
  handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      this.logger.error('Erreur d\'authentification Spotify:', error);
      return;
    }
    
    if (code) {
      this.exchangeCodeForToken(code);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  
  // Connexion à Spotify
  connect() {
    const authUrl = this.buildAuthUrl();
    window.location.href = authUrl;
  }
  
  // Construire l'URL d'authentification
  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.scope,
      show_dialog: true
    });
    
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }
  
  // Échanger le code contre un token
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          // Note: En production, le client_secret doit être géré côté serveur
        })
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.isConnected = true;
        
        // Sauvegarder le token
        this.saveTokenToStorage(data);
        
        this.logger.info('Connexion Spotify réussie');
        
        // Charger les données utilisateur
        await this.loadUserProfile();
        
      } else {
        throw new Error('Token non reçu');
      }
      
    } catch (error) {
      this.logger.error('Erreur lors de l\'échange du code:', error);
    }
  }
  
  // Sauvegarder le token
  saveTokenToStorage(tokenData) {
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    this.storage.set('spotify_token', {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: expiresAt
    });
  }
  
  // Charger le profil utilisateur
  async loadUserProfile() {
    try {
      const profile = await this.makeRequest('/me');
      
      if (profile) {
        // Mettre à jour les données utilisateur dans l'app
        const userData = {
          id: profile.id,
          name: profile.display_name || profile.id,
          email: profile.email,
          avatar: profile.images?.[0]?.url || 'assets/images/default-avatar.jpg',
          platform: 'spotify',
          country: profile.country,
          followers: profile.followers?.total || 0
        };
        
        // Sauvegarder dans l'app
        if (window.shakemoiApp) {
          window.shakemoiApp.user = { ...window.shakemoiApp.user, ...userData };
          window.shakemoiApp.storage.set('user', window.shakemoiApp.user);
        }
        
        this.logger.info('Profil utilisateur Spotify chargé');
      }
      
    } catch (error) {
      this.logger.error('Erreur lors du chargement du profil:', error);
    }
  }
  
  // Effectuer une requête API Spotify
  async makeRequest(endpoint, options = {}) {
    if (!this.isConnected) {
      throw new Error('Non connecté à Spotify');
    }
    
    const url = `https://api.spotify.com/v1${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (response.status === 401) {
        // Token expiré, essayer de le renouveler
        await this.refreshAccessToken();
        // Retry la requête
        return this.makeRequest(endpoint, options);
      }
      
      if (!response.ok) {
        throw new Error(`Erreur API Spotify: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      this.logger.error('Erreur requête Spotify:', error);
      throw error;
    }
  }
  
  // Renouveler le token d'accès
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('Pas de refresh token disponible');
    }
    
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
        })
      });
      
      const data = await response.json();
      
      if (data.access_token) {
        this.accessToken = data.access_token;
        if (data.refresh_token) {
          this.refreshToken = data.refresh_token;
        }
        
        // Sauvegarder le nouveau token
        this.saveTokenToStorage(data);
        
        this.logger.info('Token Spotify renouvelé');
      }
      
    } catch (error) {
      this.logger.error('Erreur lors du renouvellement du token:', error);
      this.disconnect();
    }
  }
  
  // Obtenir la musique en cours de lecture
  async getCurrentlyPlaying() {
    try {
      const data = await this.makeRequest('/me/player/currently-playing');
      
      if (data && data.item) {
        return {
          title: data.item.name,
          artist: data.item.artists.map(a => a.name).join(', '),
          album: data.item.album.name,
          cover: data.item.album.images[0]?.url,
          url: data.item.external_urls.spotify,
          isPlaying: data.is_playing,
          progress: data.progress_ms,
          duration: data.item.duration_ms
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Erreur getCurrentlyPlaying:', error);
      return null;
    }
  }
  
  // Obtenir les musiques récemment écoutées
  async getRecentlyPlayed(limit = 20) {
    try {
      const data = await this.makeRequest(`/me/player/recently-played?limit=${limit}`);
      
      if (data && data.items) {
        return data.items.map(item => ({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          album: item.track.album.name,
          cover: item.track.album.images[0]?.url,
          url: item.track.external_urls.spotify,
          playedAt: new Date(item.played_at).getTime()
        }));
      }
      
      return [];
      
    } catch (error) {
      this.logger.error('Erreur getRecentlyPlayed:', error);
      return [];
    }
  }
  
  // Rechercher de la musique
  async search(query, type = 'track', limit = 20) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const data = await this.makeRequest(`/search?q=${encodedQuery}&type=${type}&limit=${limit}`);
      
      if (data && data.tracks) {
        return data.tracks.items.map(track => ({
          id: track.id,
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          cover: track.album.images[0]?.url,
          url: track.external_urls.spotify,
          preview: track.preview_url,
          duration: track.duration_ms
        }));
      }
      
      return [];
      
    } catch (error) {
      this.logger.error('Erreur search:', error);
      return [];
    }
  }
  
  // Déconnexion
  disconnect() {
    this.accessToken = null;
    this.refreshToken = null;
    this.isConnected = false;
    
    // Supprimer du stockage
    this.storage.remove('spotify_token');
    
    this.logger.info('Déconnexion Spotify');
  }
  
  // Vérifier la connexion
  isTokenValid() {
    const tokenData = this.storage.get('spotify_token');
    return tokenData && tokenData.expiresAt > Date.now();
  }
}

// Initialisation de l'API Spotify
window.spotifyAPI = new SpotifyAPI();

// Export
window.SHAKEMOI_SPOTIFY = {
  SpotifyAPI,
  instance: window.spotifyAPI
};