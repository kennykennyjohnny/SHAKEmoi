// ===== SHAKEMOI APP.JS SIMPLE =====
// Version minimale qui affiche QUELQUE CHOSE

class ShakemoiApp {
  constructor() {
    this.currentView = 'feed';
    this.isLoading = true;
    
    console.log('🎵 SHAKEMOI - Initialisation...');
    this.init();
  }
  
  // Initialisation simple
  init() {
    try {
      console.log('🎵 SHAKEMOI - Démarrage de l\'app');
      
      // Masquer le loading après 2 secondes
      setTimeout(() => this.hideLoading(), 2000);
      
      // Setup navigation
      this.setupNavigation();
      
      // Afficher du contenu
      this.showWelcomeContent();
      
      console.log('✅ SHAKEMOI - App initialisée avec succès !');
      
    } catch (error) {
      console.error('❌ SHAKEMOI - Erreur:', error);
      this.showError();
    }
  }
  
  // Masquer le loading
  hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        console.log('✅ Loading masqué');
      }, 500);
    }
  }
  
  // Navigation simple
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) {
          this.switchView(view);
          console.log('📱 Navigation vers:', view);
        }
      });
    });
  }
  
  // Changer de vue
  switchView(newView) {
    console.log(`🔄 Changement de vue: ${this.currentView} → ${newView}`);
    
    // Mettre à jour la navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === newView) {
        item.classList.add('active');
      }
    });
    
    // Mettre à jour les vues
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${newView}-view`);
    if (targetView) {
      targetView.classList.add('active');
    }
    
    this.currentView = newView;
    this.updateViewContent(newView);
  }
  
  // Afficher contenu de bienvenue
  showWelcomeContent() {
    const feedContainer = document.querySelector('.feed-posts');
    if (!feedContainer) return;
    
    feedContainer.innerHTML = `
      <div class="welcome-card">
        <div class="welcome-icon">🎵</div>
        <h2>Bienvenue sur SHAKEMOI !</h2>
        <p>L'app musicale sociale nouvelle génération</p>
        <div class="features-list">
          <div class="feature-item">
            <span class="feature-icon">📱</span>
            <span>Feed musical temps réel</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎧</span>
            <span>Partage cross-platform</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">👥</span>
            <span>Découverte par tes amis</span>
          </div>
        </div>
        <button class="demo-btn" onclick="shakemoiApp.showDemo()">
          Voir la démo
        </button>
      </div>
    `;
    
    // Ajouter le style si pas déjà là
    this.addWelcomeStyles();
  }
  
  // Contenu selon la vue
  updateViewContent(view) {
    console.log('📄 Mise à jour contenu pour:', view);
    
    switch(view) {
      case 'feed':
        this.showFeedContent();
        break;
      case 'discover':
        this.showDiscoverContent();
        break;
      case 'share':
        this.showShareContent();
        break;
      case 'friends':
        this.showFriendsContent();
        break;
      case 'profile':
        this.showProfileContent();
        break;
    }
  }
  
  // Contenu Feed
  showFeedContent() {
    const container = document.querySelector('.feed-posts');
    if (!container) return;
    
    container.innerHTML = `
      <div class="demo-post">
        <div class="post-header">
          <div class="post-avatar">🎤</div>
          <div class="post-info">
            <h4>Demo User</h4>
            <span>Il y a 5 min</span>
          </div>
        </div>
        <div class="post-content">
          <p>En écoute maintenant 🔥</p>
          <div class="demo-music-card">
            <div class="music-cover">🎵</div>
            <div class="music-info">
              <h5>Track Démo</h5>
              <p>Artiste Démo</p>
            </div>
            <span class="platform">Spotify</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Contenu Discover
  showDiscoverContent() {
    const container = document.querySelector('.discover-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="demo-content">
        <h3>🔍 Découverte</h3>
        <p>Trouve de la nouvelle musique grâce à tes amis</p>
        <div class="demo-categories">
          <div class="demo-category">🔥 Tendances</div>
          <div class="demo-category">🎨 Par Genre</div>
          <div class="demo-category">😌 Par Mood</div>
        </div>
      </div>
    `;
  }
  
  // Contenu Share
  showShareContent() {
    const container = document.querySelector('.share-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="demo-content">
        <h3>➕ Partager</h3>
        <p>Partage ta musique avec tes amis</p>
        <div class="demo-share-options">
          <button class="demo-share-btn">🎵 Partage rapide</button>
          <button class="demo-share-btn">📱 Story musicale</button>
        </div>
      </div>
    `;
  }
  
  // Contenu Friends
  showFriendsContent() {
    const container = document.querySelector('.friends-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="demo-content">
        <h3>👥 Amis</h3>
        <p>Connecte-toi avec tes amis musicaux</p>
        <div class="demo-friends">
          <div class="demo-friend">🎧 Alex - En ligne</div>
          <div class="demo-friend">🎵 Sarah - Écoute PNL</div>
          <div class="demo-friend">🎤 Marcus - Hors ligne</div>
        </div>
      </div>
    `;
  }
  
  // Contenu Profile
  showProfileContent() {
    const container = document.querySelector('.profile-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="demo-content">
        <h3>👤 Mon Profil</h3>
        <div class="demo-profile">
          <div class="demo-avatar">🎵</div>
          <h4>Ton Nom</h4>
          <p>Connecté via Spotify</p>
          <div class="demo-stats">
            <div class="demo-stat">
              <span class="demo-number">12</span>
              <span class="demo-label">Partages</span>
            </div>
            <div class="demo-stat">
              <span class="demo-number">8</span>
              <span class="demo-label">Amis</span>
            </div>
            <div class="demo-stat">
              <span class="demo-number">45</span>
              <span class="demo-label">Découvertes</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Démo interactive
  showDemo() {
    console.log('🎬 Démo SHAKEMOI lancée !');
    alert('🎵 Démo SHAKEMOI\n\nNavigue entre les onglets pour découvrir les fonctionnalités !\n\n- Feed : Voir ce qu\'écoutent tes amis\n- Discover : Trouver de la nouvelle musique\n- Share : Partager tes découvertes\n- Friends : Gérer tes amis\n- Profile : Ton profil musical');
  }
  
  // Styles pour le contenu de démonstration
  addWelcomeStyles() {
    if (document.getElementById('demo-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'demo-styles';
    style.textContent = `
      .welcome-card {
        background: linear-gradient(135deg, #2D1B69, #8B5CF6);
        color: white;
        padding: 2rem;
        border-radius: 20px;
        text-align: center;
        margin: 1rem;
      }
      
      .welcome-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .features-list {
        margin: 1.5rem 0;
      }
      
      .feature-item {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin: 0.5rem 0;
        font-size: 0.9rem;
      }
      
      .demo-btn {
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        margin-top: 1rem;
      }
      
      .demo-content {
        padding: 2rem;
        text-align: center;
      }
      
      .demo-post, .demo-categories, .demo-friends, .demo-profile {
        background: #1A1A2E;
        border-radius: 15px;
        padding: 1rem;
        margin: 1rem 0;
      }
      
      .post-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      
      .post-avatar {
        width: 40px;
        height: 40px;
        background: #8B5CF6;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .demo-music-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: #374151;
        padding: 1rem;
        border-radius: 10px;
      }
      
      .demo-category, .demo-friend, .demo-share-btn {
        background: #374151;
        padding: 0.75rem;
        border-radius: 10px;
        margin: 0.5rem 0;
        cursor: pointer;
      }
      
      .demo-stats {
        display: flex;
        justify-content: space-around;
        margin-top: 1rem;
      }
      
      .demo-stat {
        text-align: center;
      }
      
      .demo-number {
        display: block;
        font-size: 1.5rem;
        font-weight: bold;
        color: #8B5CF6;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Gestion d'erreur
  showError() {
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: white; background: #1A1A2E; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1>🎵 SHAKEMOI</h1>
        <p>Erreur de chargement</p>
        <button onclick="location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem; background: #8B5CF6; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Recharger
        </button>
      </div>
    `;
  }
}

// Initialisation quand la page est chargée
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎵 SHAKEMOI - Page chargée, initialisation...');
  
  try {
    window.shakemoiApp = new ShakemoiApp();
  } catch (error) {
    console.error('❌ Erreur fatale SHAKEMOI:', error);
    
    // Fallback ultra simple
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #2D1B69, #8B5CF6); color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1 style="font-size: 3rem; margin-bottom: 1rem;">🎵 SHAKEMOI</h1>
        <p style="font-size: 1.2rem; margin-bottom: 2rem;">L'app musicale sociale nouvelle génération</p>
        <p>Version de démonstration</p>
        <small style="margin-top: 2rem; opacity: 0.8;">Erreur de chargement - Mode fallback activé</small>
      </div>
    `;
  }
});

// Backup si jamais rien ne marche
setTimeout(() => {
  if (!window.shakemoiApp) {
    console.log('🆘 SHAKEMOI - Fallback de secours activé');
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: #2D1B69; color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">
        <h1 style="font-size: 3rem; margin-bottom: 1rem;">🎵 SHAKEMOI</h1>
        <p style="font-size: 1.2rem;">L'app musicale sociale</p>
        <p style="margin-top: 2rem;">✨ Bientôt disponible ✨</p>
      </div>
    `;
  }
}, 5000);

console.log('🎵 SHAKEMOI - Script chargé !');