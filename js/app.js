// Application principale - Orchestration et routing

class App {
  constructor() {
    this.currentSection = 'shake';
    this.isAuthenticated = false;
  }

  // Initialisation de l'application
  async init() {
    try {
      // Vérifier l'authentification
      this.isAuthenticated = await authManager.init();

      if (this.isAuthenticated) {
        this.showApp();
        await this.loadSection('shake');
        feedManager.subscribeToFeed();
      } else {
        this.showAuth();
      }

      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur initialisation app:', error);
      this.showAuth();
    }
  }

  // Afficher la page d'authentification
  showAuth() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('app-container').classList.remove('active');
  }

  // Afficher l'application
  showApp() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('app-container').classList.add('active');
  }

  // Configurer les event listeners
  setupEventListeners() {
    // Toggle auth (login/signup)
    document.getElementById('btn-show-login')?.addEventListener('click', () => {
      this.showLoginForm();
    });

    document.getElementById('btn-show-signup')?.addEventListener('click', () => {
      this.showSignupForm();
    });

    // Sélection de couleur signup
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        e.target.classList.add('selected');
      });
    });

    // Formulaires auth
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        this.loadSection(section);
      });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      this.handleLogout();
    });

    // Toggle recherche
    document.getElementById('search-toggle-people')?.addEventListener('click', () => {
      this.setSearchType('people');
    });

    document.getElementById('search-toggle-sounds')?.addEventListener('click', () => {
      this.setSearchType('sounds');
    });

    // Recherche input
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    // Toggle profil
    document.getElementById('profile-toggle-shakes')?.addEventListener('click', () => {
      this.setProfileView('shakes');
    });

    document.getElementById('profile-toggle-comments')?.addEventListener('click', () => {
      this.setProfileView('comments');
    });
  }

  // Afficher le formulaire de login
  showLoginForm() {
    document.getElementById('btn-show-login').classList.add('active');
    document.getElementById('btn-show-signup').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    document.getElementById('signup-form').classList.remove('active');
  }

  // Afficher le formulaire de signup
  showSignupForm() {
    document.getElementById('btn-show-login').classList.remove('active');
    document.getElementById('btn-show-signup').classList.add('active');
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('signup-form').classList.add('active');
  }

  // Gérer le login
  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.querySelector('#login-form .btn-primary');
    const errorDiv = document.getElementById('login-error');

    // Clear error
    errorDiv.classList.add('hidden');

    // Validation
    if (!email || !password) {
      errorDiv.textContent = 'Veuillez remplir tous les champs';
      errorDiv.classList.remove('hidden');
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      const result = await authManager.login(email, password);

      if (result.success) {
        this.isAuthenticated = true;
        this.showApp();
        await this.loadSection('shake');
        feedManager.subscribeToFeed();
      } else {
        errorDiv.textContent = result.error;
        errorDiv.classList.remove('hidden');
      }
    } catch (error) {
      errorDiv.textContent = 'Erreur de connexion';
      errorDiv.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }

  // Gérer le signup
  async handleSignup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const selectedColor = document.querySelector('.color-option.selected');
    const submitBtn = document.querySelector('#signup-form .btn-primary');
    const errorDiv = document.getElementById('signup-error');

    // Clear error
    errorDiv.classList.add('hidden');

    // Validation
    if (!username || !email || !password) {
      errorDiv.textContent = 'Veuillez remplir tous les champs';
      errorDiv.classList.remove('hidden');
      return;
    }

    if (!selectedColor) {
      errorDiv.textContent = 'Veuillez choisir une couleur';
      errorDiv.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
      errorDiv.classList.remove('hidden');
      return;
    }

    const color = selectedColor.dataset.color;

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Inscription...';

    try {
      const result = await authManager.signup(username, email, password, color);

      if (result.success) {
        this.isAuthenticated = true;
        this.showApp();
        await this.loadSection('shake');
        feedManager.subscribeToFeed();
      } else {
        errorDiv.textContent = result.error;
        errorDiv.classList.remove('hidden');
      }
    } catch (error) {
      errorDiv.textContent = 'Erreur lors de l\'inscription';
      errorDiv.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'S\'inscrire';
    }
  }

  // Gérer le logout
  async handleLogout() {
    const result = await authManager.logout();

    if (result.success) {
      feedManager.unsubscribeFromFeed();
      this.isAuthenticated = false;
      this.showAuth();
      // Reset forms
      document.getElementById('login-form').reset();
      document.getElementById('signup-form').reset();
    }
  }

  // Charger une section
  async loadSection(sectionName) {
    // Update current section
    this.currentSection = sectionName;

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.section === sectionName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hide all sections
    document.querySelectorAll('.app-section').forEach(section => {
      section.classList.remove('active');
    });

    // Show current section
    const currentSection = document.getElementById(`section-${sectionName}`);
    if (currentSection) {
      currentSection.classList.add('active');
    }

    // Load section data
    switch (sectionName) {
      case 'shake':
        await this.loadFeedSection();
        break;
      case 'top':
        await this.loadTopSection();
        break;
      case 'search':
        await this.loadSearchSection();
        break;
      case 'profile':
        await this.loadProfileSection();
        break;
    }
  }

  // Charger la section feed
  async loadFeedSection() {
    const container = document.getElementById('feed-container');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      await feedManager.loadFeed();
      this.renderFeed();
    } catch (error) {
      console.error('Erreur chargement feed:', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😔</div><div class="empty-state-text">Erreur de chargement</div></div>';
    }
  }

  // Render feed
  renderFeed() {
    const container = document.getElementById('feed-container');
    const posts = feedManager.getPosts();

    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎵</div><div class="empty-state-text">Aucun post pour le moment. Suivez des personnes pour voir leur contenu !</div></div>';
      return;
    }

    container.innerHTML = posts.map(post => this.renderPost(post)).join('');

    // Attach event listeners
    this.attachPostListeners();
  }

  // Render un post
  renderPost(post) {
    const profile = post.users_profile;
    const timeAgo = this.getTimeAgo(post.created_at);

    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <div class="user-note" style="background-color: ${profile.color};">🎵</div>
          <div class="post-user-info">
            <div class="post-username">${profile.username}</div>
            <div class="post-time">${timeAgo}</div>
          </div>
        </div>
        <div class="post-music">
          <div class="post-album-cover">
            <img src="${post.album_cover}" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Cover'">
          </div>
          <div class="post-track-info">
            <div class="post-track-title">${post.track_name}</div>
            <div class="post-track-artist">${post.artist_name}</div>
          </div>
        </div>
        ${post.text ? `<div class="post-text">${post.text}</div>` : ''}
        <div class="post-actions">
          <button class="action-btn btn-like" data-post-id="${post.id}">
            <span class="icon">♥</span>
            <span class="count">${post.likes_count || 0}</span>
          </button>
          <button class="action-btn btn-comment" data-post-id="${post.id}">
            <span class="icon">💬</span>
            <span class="count">${post.comments_count || 0}</span>
          </button>
        </div>
      </div>
    `;
  }

  // Attacher les event listeners aux posts
  async attachPostListeners() {
    document.querySelectorAll('.btn-like').forEach(btn => {
      const postId = btn.dataset.postId;

      // Check if liked
      feedManager.hasLiked(postId).then(liked => {
        if (liked) {
          btn.classList.add('liked');
        }
      });

      btn.addEventListener('click', async () => {
        const result = await feedManager.toggleLike(postId);
        if (result.success) {
          if (result.liked) {
            btn.classList.add('liked');
          } else {
            btn.classList.remove('liked');
          }
          // Reload feed to update counts
          await feedManager.loadFeed();
          this.renderFeed();
        }
      });
    });

    document.querySelectorAll('.btn-comment').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const text = prompt('Votre commentaire :');
        if (text) {
          feedManager.addComment(postId, text).then(async (result) => {
            if (result.success) {
              await feedManager.loadFeed();
              this.renderFeed();
            }
          });
        }
      });
    });
  }

  // Charger la section Top
  async loadTopSection() {
    const container = document.getElementById('top-container');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      await topManager.loadTop100();
      this.renderTop();
    } catch (error) {
      console.error('Erreur chargement top:', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😔</div><div class="empty-state-text">Erreur de chargement</div></div>';
    }
  }

  // Render top 100
  renderTop() {
    const container = document.getElementById('top-container');
    const tracks = topManager.getTopTracks();

    if (tracks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎵</div><div class="empty-state-text">Aucun morceau disponible</div></div>';
      return;
    }

    container.innerHTML = tracks.map(track => `
      <div class="top-item">
        <div class="top-rank">${track.rank}</div>
        <div class="top-cover">
          <img src="${track.image}" alt="${track.name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Cover'">
        </div>
        <div class="top-info">
          <div class="top-title">${track.name}</div>
          <div class="top-artist">${track.artist}</div>
        </div>
        <div class="top-actions">
          <button class="icon-btn btn-shake" data-track='${JSON.stringify(track)}'>♥</button>
          <button class="icon-btn btn-track-comment" data-track='${JSON.stringify(track)}'>💬</button>
          <button class="icon-btn btn-share" data-track='${JSON.stringify(track)}'>↗</button>
        </div>
      </div>
    `).join('');

    // Attach event listeners
    this.attachTopListeners();
  }

  // Attacher les event listeners au top
  attachTopListeners() {
    document.querySelectorAll('.btn-shake').forEach(btn => {
      btn.addEventListener('click', async () => {
        const track = JSON.parse(btn.dataset.track);
        const text = prompt(`Ajouter un commentaire pour ${track.name} :`);
        const result = await topManager.shakeTrack(track, text || '');
        if (result.success) {
          alert('Post créé !');
        } else {
          alert(result.error);
        }
      });
    });

    document.querySelectorAll('.btn-track-comment').forEach(btn => {
      btn.addEventListener('click', () => {
        const track = JSON.parse(btn.dataset.track);
        const text = prompt(`Commentaire sur ${track.name} :`);
        if (text) {
          topManager.shakeTrack(track, text);
        }
      });
    });

    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.addEventListener('click', async () => {
        const track = JSON.parse(btn.dataset.track);
        const result = await topManager.shareTrack(track);
        if (result.success && result.message) {
          alert(result.message);
        }
      });
    });
  }

  // Charger la section recherche
  async loadSearchSection() {
    // Reset
    document.getElementById('search-input').value = '';
    searchManager.setSearchType('people');
    this.setSearchType('people');
  }

  // Changer le type de recherche
  setSearchType(type) {
    searchManager.setSearchType(type);

    document.getElementById('search-toggle-people').classList.toggle('active', type === 'people');
    document.getElementById('search-toggle-sounds').classList.toggle('active', type === 'sounds');

    // Clear results
    document.getElementById('search-results').innerHTML = '';
  }

  // Gérer la recherche
  async handleSearch(query) {
    const container = document.getElementById('search-results');

    if (!query || query.trim().length < 2) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const type = searchManager.getSearchType();

      if (type === 'people') {
        await searchManager.searchUsers(query);
        this.renderSearchUsers();
      } else {
        await searchManager.searchTracks(query);
        this.renderSearchTracks();
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Erreur de recherche</div></div>';
    }
  }

  // Render résultats users
  renderSearchUsers() {
    const container = document.getElementById('search-results');
    const users = searchManager.getSearchResults();

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun utilisateur trouvé</div></div>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-result">
        <div class="user-avatar" style="background-color: ${user.color};">🎵</div>
        <div class="user-info">
          <div class="user-name">${user.username}</div>
          <div class="user-stats">${user.feelings_count || 0} followers</div>
        </div>
        <button class="btn-follow" data-user-id="${user.id}">Feel</button>
      </div>
    `).join('');

    // Check following status and attach listeners
    this.attachSearchUserListeners();
  }

  // Attacher les event listeners aux résultats users
  async attachSearchUserListeners() {
    document.querySelectorAll('.btn-follow').forEach(async btn => {
      const userId = btn.dataset.userId;
      const currentUserId = authManager.getUser()?.id;

      // Don't show follow button for self
      if (userId === currentUserId) {
        btn.textContent = 'Vous';
        btn.disabled = true;
        return;
      }

      // Check if already following
      const isFollowing = await searchManager.isFollowing(userId);
      if (isFollowing) {
        btn.textContent = 'Unfeel';
        btn.classList.add('following');
      }

      btn.addEventListener('click', async () => {
        const isFollowing = btn.classList.contains('following');

        if (isFollowing) {
          const result = await searchManager.unfollowUser(userId);
          if (result.success) {
            btn.textContent = 'Feel';
            btn.classList.remove('following');
          }
        } else {
          const result = await searchManager.followUser(userId);
          if (result.success) {
            btn.textContent = 'Unfeel';
            btn.classList.add('following');
          } else {
            alert(result.error);
          }
        }
      });
    });
  }

  // Render résultats tracks
  renderSearchTracks() {
    const container = document.getElementById('search-results');
    const tracks = searchManager.getSearchResults();

    if (tracks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun morceau trouvé</div></div>';
      return;
    }

    container.innerHTML = tracks.map(post => this.renderPost(post)).join('');
    this.attachPostListeners();
  }

  // Charger la section profil
  async loadProfileSection() {
    const container = document.getElementById('profile-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      // Load profile data
      const profile = authManager.getProfile();
      const stats = await profileManager.getUserStats();

      // Update profile header
      document.getElementById('profile-note').style.backgroundColor = profile.color;
      document.getElementById('profile-username').textContent = profile.username;
      document.getElementById('profile-feels').textContent = stats.feels;
      document.getElementById('profile-feelings').textContent = stats.feelings;

      // Load posts
      await this.setProfileView('shakes');
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Erreur de chargement</div></div>';
    }
  }

  // Changer la vue du profil
  async setProfileView(view) {
    profileManager.setViewMode(view);

    document.getElementById('profile-toggle-shakes').classList.toggle('active', view === 'shakes');
    document.getElementById('profile-toggle-comments').classList.toggle('active', view === 'comments');

    const container = document.getElementById('profile-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      if (view === 'shakes') {
        await profileManager.loadUserLikes();
      } else {
        await profileManager.loadUserComments();
      }

      this.renderProfile();
    } catch (error) {
      console.error('Erreur chargement vue profil:', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Erreur de chargement</div></div>';
    }
  }

  // Render profil
  renderProfile() {
    const container = document.getElementById('profile-content');
    const posts = profileManager.getCurrentViewPosts();

    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Aucun contenu pour le moment</div></div>';
      return;
    }

    container.innerHTML = `
      <div class="profile-grid">
        ${posts.map(post => `
          <div class="profile-post">
            <img src="${post.album_cover}" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Cover'">
            <div class="profile-post-overlay">
              <div class="profile-post-title">${post.track_name}</div>
              <div class="profile-post-stats">
                <span>♥ ${post.likes_count || 0}</span>
                <span>💬 ${post.comments_count || 0}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Calculer le temps écoulé
  getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = Math.floor((now - past) / 1000); // en secondes

    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
    return past.toLocaleDateString('fr-FR');
  }
}

// Initialiser l'app au chargement
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

// Rendre renderFeed accessible globalement pour les subscriptions
window.renderFeed = () => {
  if (window.app && window.app.currentSection === 'shake') {
    window.app.renderFeed();
  }
};
