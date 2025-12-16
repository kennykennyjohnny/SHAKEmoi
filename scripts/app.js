// SHAKEMOI - App Logic

// State
let currentUser = null;
let currentProfile = null;
let currentView = 'shake';
let searchMode = 'tracks';
let selectedTrackForShake = null;
let selectedPostForComment = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthAndInit();
});

// Check auth and initialize
async function checkAuthAndInit() {
  try {
    // Protection anti-boucle
    const redirectCount = parseInt(sessionStorage.getItem('authRedirectCount') || '0');
    if (redirectCount > 3) {
      console.error('⚠️ Trop de redirections détectées. Arrêt pour éviter la boucle.');
      sessionStorage.removeItem('authRedirectCount');
      await supabase.auth.signOut();
      window.location.href = 'index.html';
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Not logged in, redirect to login page
      sessionStorage.setItem('authRedirectCount', String(redirectCount + 1));
      window.location.href = 'index.html';
      return;
    }

    currentUser = session.user;
    currentProfile = await getUserProfile(currentUser.id);

    if (!currentProfile) {
      alert('Erreur de chargement du profil');
      await supabase.auth.signOut();
      sessionStorage.removeItem('authRedirectCount');
      window.location.href = 'index.html';
      return;
    }

    // Authentification réussie, réinitialiser le compteur
    sessionStorage.removeItem('authRedirectCount');

    // Setup app
    setupEventListeners();
    await loadView('shake');

    // Initialiser les notifications
    if (typeof notifManager !== 'undefined') {
      await notifManager.loadNotifications();
      notifManager.subscribeToNotifications();
    }

  } catch (error) {
    console.error('Init error:', error);
    sessionStorage.removeItem('authRedirectCount');
    window.location.href = 'index.html';
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      loadView(view);
    });
  });

  // Search toggle
  document.querySelectorAll('#search-view .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      searchMode = btn.dataset.mode;
      document.querySelectorAll('#search-view .toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === searchMode);
      });
      document.getElementById('search-results').innerHTML = '<div class="empty-state"><p>Tape quelque chose pour rechercher</p></div>';
    });
  });

  // Search input
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch(e.target.value);
    }, 300);
  });

  // Profile tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      loadProfileTab(tab);
    });
  });

  // Modal events
  document.getElementById('cancel-comment').addEventListener('click', closeCommentModal);
  document.getElementById('submit-comment').addEventListener('click', submitComment);
  document.getElementById('cancel-shake').addEventListener('click', closeShakeModal);
  document.getElementById('submit-shake').addEventListener('click', submitShake);
}

// Logout
async function handleLogout() {
  if (confirm('Se déconnecter ?')) {
    await supabase.auth.signOut();
    sessionStorage.removeItem('authRedirectCount');
    window.location.href = 'index.html';
  }
}

// Load a view
async function loadView(viewName) {
  currentView = viewName;

  // Update nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Show current view
  document.getElementById(`${viewName}-view`).classList.add('active');

  // Load view data
  switch (viewName) {
    case 'shake':
      await loadFeed();
      break;
    case 'top':
      await loadTop100();
      break;
    case 'search':
      document.getElementById('search-input').value = '';
      document.getElementById('search-results').innerHTML = '<div class="empty-state"><p>Tape quelque chose pour rechercher</p></div>';
      break;
    case 'profile':
      await loadProfile();
      break;
  }
}

// ==================== SHAKE (FEED) ====================

async function loadFeed() {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement du feed...</p></div>';

  try {
    const posts = await getFeed();

    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Ton feed est vide ! Commence par "feel" des personnes dans l\'onglet Recherche.</p></div>';
      return;
    }

    container.innerHTML = posts.map(post => renderPost(post)).join('');
    attachPostListeners();

  } catch (error) {
    console.error('Error loading feed:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

function renderPost(post) {
  const timeAgo = getTimeAgo(post.created_at);

  return `
    <article class="post" data-post-id="${post.id}">
      <div class="post-header">
        <div class="user-note" style="background: ${post.user.color}; cursor: pointer;" onclick="openUserProfile('${post.user.id}')">♪</div>
        <div class="post-info">
          <span class="username" style="cursor: pointer;" onclick="openUserProfile('${post.user.id}')">@${post.user.username}</span>
          <span class="timestamp">${timeAgo}</span>
        </div>
      </div>
      <div class="post-content">
        <div style="position: relative;">
          <img src="${post.cover_url}" class="track-cover" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Cover'">
          ${post.preview_url ? `
            <button class="preview-play-btn" onclick="playPreview('${post.preview_url}', this)" title="Écouter 30s">
              <span class="icon">▶️</span>
            </button>
          ` : ''}
        </div>
        <div class="track-info">
          <h3 class="track-title">${escapeHtml(post.track_name)}</h3>
          <p class="track-artist">${escapeHtml(post.artist)}</p>
        </div>
        ${post.text ? `<p class="post-text">${escapeHtml(post.text)}</p>` : ''}
      </div>
      <div class="post-actions">
        <button class="action-btn like-btn" data-post-id="${post.id}">
          <span class="icon">❤️</span>
          <span class="count">${post.likes_count || 0}</span>
        </button>
        <button class="action-btn comment-btn" data-post-id="${post.id}">
          <span class="icon">💬</span>
          <span class="count">${post.comments_count || 0}</span>
        </button>
        <button class="action-btn reshake-btn" data-post-id="${post.id}">
          <span class="icon">🔄</span>
        </button>
      </div>
    </article>
  `;
}

function attachPostListeners() {
  // Like buttons
  document.querySelectorAll('.like-btn').forEach(btn => {
    const postId = btn.dataset.postId;

    // Check if already liked
    hasLikedPost(postId).then(liked => {
      if (liked) {
        btn.classList.add('liked');
      }
    });

    btn.addEventListener('click', async () => {
      const isLiked = btn.classList.contains('liked');

      if (isLiked) {
        const result = await unlikePost(postId);
        if (result.success) {
          btn.classList.remove('liked');
          const count = parseInt(btn.querySelector('.count').textContent);
          btn.querySelector('.count').textContent = Math.max(0, count - 1);
        }
      } else {
        const result = await likePost(postId);
        if (result.success) {
          btn.classList.add('liked');
          const count = parseInt(btn.querySelector('.count').textContent);
          btn.querySelector('.count').textContent = count + 1;
        }
      }
    });
  });

  // Comment buttons
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPostForComment = btn.dataset.postId;
      openCommentModal();
    });
  });

  // Re-shake buttons
  document.querySelectorAll('.reshake-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Re-shake ce post ?')) {
        const result = await reshakePost(btn.dataset.postId);
        if (result.success) {
          alert('Re-shake publié ! 🔄');
          await loadFeed();
        } else {
          alert('Erreur: ' + result.error);
        }
      }
    });
  });
}

// ==================== TOP 100 ====================

async function loadTop100() {
  const container = document.getElementById('top-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement du Top 100 France...</p></div>';

  try {
    // Utiliser Spotify au lieu de Last.fm
    const tracks = await spotify.getTop100France();

    if (tracks.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Impossible de charger le Top 100</p></div>';
      return;
    }

    container.innerHTML = tracks.map(track => renderTopTrack(track)).join('');
    attachTopTrackListeners();

  } catch (error) {
    console.error('Error loading Top 100:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

function renderTopTrack(track) {
  // Escape JSON pour éviter les problèmes avec les quotes
  const trackData = JSON.stringify(track).replace(/'/g, '&apos;');

  return `
    <div class="top-track" data-track='${trackData}'>
      <div class="track-rank">#${track.rank}</div>
      <img src="${track.cover}" class="track-cover" alt="${track.name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Cover'">
      <div class="track-info">
        <h3 class="track-title">${escapeHtml(track.name)}</h3>
        <p class="track-artist">${escapeHtml(track.artist)}</p>
      </div>
      <div class="track-actions">
        <button class="action-btn shake-btn" title="Shake ce morceau">
          <span class="icon">❤️</span>
        </button>
        ${track.preview_url ? `
          <button class="action-btn preview-btn" title="Écouter 30s" onclick="playPreview('${track.preview_url}', this)">
            <span class="icon">▶️</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function attachTopTrackListeners() {
  document.querySelectorAll('.shake-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackElement = btn.closest('.top-track');
      const track = JSON.parse(trackElement.dataset.track);
      selectedTrackForShake = track;
      openShakeModal(track);
    });
  });
}

// ==================== SEARCH ====================

async function handleSearch(query) {
  const container = document.getElementById('search-results');

  if (!query || query.trim().length < 2) {
    container.innerHTML = '<div class="empty-state"><p>Tape au moins 2 caractères</p></div>';
    return;
  }

  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Recherche...</p></div>';

  try {
    if (searchMode === 'tracks') {
      // Utiliser Spotify au lieu de Last.fm
      const tracks = await spotify.searchTracks(query);

      if (tracks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun morceau trouvé</p></div>';
        return;
      }

      container.innerHTML = tracks.map(track => renderSearchTrack(track)).join('');
      attachSearchTrackListeners();

    } else {
      const users = await searchUsers(query);

      if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun utilisateur trouvé</p></div>';
        return;
      }

      container.innerHTML = users.map(user => renderSearchUser(user)).join('');
      attachSearchUserListeners();
    }
  } catch (error) {
    console.error('Search error:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de recherche</p></div>';
  }
}

function renderSearchTrack(track) {
  // Escape JSON pour éviter les problèmes avec les quotes
  const trackData = JSON.stringify(track).replace(/'/g, '&apos;');

  return `
    <div class="top-track" data-track='${trackData}'>
      <img src="${track.cover}" class="track-cover" alt="${track.name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Cover'">
      <div class="track-info">
        <h3 class="track-title">${escapeHtml(track.name)}</h3>
        <p class="track-artist">${escapeHtml(track.artist)}</p>
      </div>
      <div class="track-actions">
        <button class="action-btn shake-btn" title="Shake ce morceau">
          <span class="icon">❤️</span>
        </button>
        ${track.preview_url ? `
          <button class="action-btn preview-btn" title="Écouter 30s" onclick="playPreview('${track.preview_url}', this)">
            <span class="icon">▶️</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSearchUser(user) {
  return `
    <div class="user-result" data-user-id="${user.id}">
      <div class="user-avatar" style="background: ${user.color}; cursor: pointer;" onclick="openUserProfile('${user.id}')">♪</div>
      <div class="user-info" style="cursor: pointer;" onclick="openUserProfile('${user.id}')">
        <div class="user-name">@${escapeHtml(user.username)}</div>
        <div class="user-stats">${user.feelings_count || 0} feelings</div>
      </div>
      <button class="btn-follow" data-user-id="${user.id}">Feel</button>
    </div>
  `;
}

function attachSearchTrackListeners() {
  document.querySelectorAll('.shake-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackElement = btn.closest('.top-track');
      const track = JSON.parse(trackElement.dataset.track);
      selectedTrackForShake = track;
      openShakeModal(track);
    });
  });
}

function attachSearchUserListeners() {
  document.querySelectorAll('.btn-follow').forEach(async btn => {
    const userId = btn.dataset.userId;

    // Don't show follow button for self
    if (userId === currentUser.id) {
      btn.textContent = 'Toi';
      btn.disabled = true;
      return;
    }

    // Check if already following
    const following = await isFollowing(userId);
    if (following) {
      btn.textContent = 'Unfeel';
      btn.classList.add('following');
    }

    btn.addEventListener('click', async () => {
      const isFollowing = btn.classList.contains('following');

      if (isFollowing) {
        const result = await unfollowUser(userId);
        if (result.success) {
          btn.textContent = 'Feel';
          btn.classList.remove('following');
        }
      } else {
        const result = await followUser(userId);
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

// ==================== PROFILE ====================

async function loadProfile() {
  try {
    // Update header
    document.getElementById('user-note').style.background = currentProfile.color;
    document.getElementById('user-username').textContent = `@${currentProfile.username}`;

    const stats = await getUserStats(currentUser.id);
    document.getElementById('feels-count').textContent = stats.feels;
    document.getElementById('feelings-count').textContent = stats.feelings;

    // Load posts
    await loadProfileTab('shakes');

  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

async function loadProfileTab(tab) {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

  try {
    if (tab === 'shakes') {
      const posts = await getUserLikedPosts(currentUser.id);

      console.log('Posts likés récupérés:', posts.length, posts);

      if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun shake pour le moment.<br><small>Like des posts pour les voir ici !</small></p></div>';
        return;
      }

      // Filtrer les posts null ou invalides
      const validPosts = posts.filter(post => post && post.cover_url && post.track_name);

      if (validPosts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Erreur de chargement des posts</p></div>';
        return;
      }

      container.innerHTML = `
        <div class="profile-grid">
          ${validPosts.map(post => `
            <div class="profile-post">
              <img src="${post.cover_url}" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Cover'">
              <div class="profile-post-overlay">
                <div class="profile-post-title">${escapeHtml(post.track_name)}</div>
                <div class="profile-post-stats">
                  <span>❤️ ${post.likes_count || 0}</span>
                  <span>💬 ${post.comments_count || 0}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } else {
      const comments = await getUserComments(currentUser.id);

      if (comments.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun commentaire pour le moment</p></div>';
        return;
      }

      container.innerHTML = comments.map(comment => `
        <div class="post" style="margin-bottom: 1rem;">
          <div class="post-text">${escapeHtml(comment.text)}</div>
          <small style="color: var(--text-secondary)">Sur: ${escapeHtml(comment.post.track_name)}</small>
        </div>
      `).join('');
    }

  } catch (error) {
    console.error('Error loading profile tab:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

// ==================== MODALS ====================

function openShakeModal(track) {
  const modal = document.getElementById('shake-modal');
  const trackInfo = document.getElementById('shake-track-info');

  trackInfo.innerHTML = `
    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
      <img src="${track.cover}" style="width: 60px; height: 60px; border-radius: 8px;" alt="${track.name}">
      <div>
        <div style="font-weight: 600;">${escapeHtml(track.name)}</div>
        <div style="color: var(--text-secondary); font-size: 0.875rem;">${escapeHtml(track.artist)}</div>
      </div>
    </div>
  `;

  document.getElementById('shake-text').value = '';
  modal.classList.add('active');
}

function closeShakeModal() {
  document.getElementById('shake-modal').classList.remove('active');
  selectedTrackForShake = null;
}

async function submitShake() {
  if (!selectedTrackForShake) return;

  const text = document.getElementById('shake-text').value.trim();
  const submitBtn = document.getElementById('submit-shake');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publication...';

  try {
    const result = await createPost(
      selectedTrackForShake.name,
      selectedTrackForShake.artist,
      selectedTrackForShake.cover,
      text,
      selectedTrackForShake.preview_url || null
    );

    if (result.success) {
      alert('Shake publié ! 🎵');
      closeShakeModal();
      if (currentView === 'shake') {
        await loadFeed();
      }
    } else {
      alert('Erreur: ' + result.error);
    }
  } catch (error) {
    alert('Erreur lors de la publication');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Shake !';
  }
}

function openCommentModal() {
  const modal = document.getElementById('comment-modal');
  document.getElementById('comment-text').value = '';
  modal.classList.add('active');
}

function closeCommentModal() {
  document.getElementById('comment-modal').classList.remove('active');
  selectedPostForComment = null;
}

async function submitComment() {
  if (!selectedPostForComment) return;

  const text = document.getElementById('comment-text').value.trim();

  if (!text) {
    alert('Écris quelque chose !');
    return;
  }

  const submitBtn = document.getElementById('submit-comment');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publication...';

  try {
    const result = await addComment(selectedPostForComment, text);

    if (result.success) {
      alert('Commentaire publié ! 💬');
      closeCommentModal();
      if (currentView === 'shake') {
        await loadFeed();
      }
    } else {
      alert('Erreur: ' + result.error);
    }
  } catch (error) {
    alert('Erreur lors de la publication');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publier';
  }
}

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// ==================== UTILITIES ====================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'À l\'instant';
  if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;

  return past.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });
}

// ==================== AUDIO PREVIEW ====================

let currentAudio = null;
let currentPlayButton = null;

function playPreview(previewUrl, button) {
  // Si on clique sur le même bouton, arrêter la lecture
  if (currentAudio && currentPlayButton === button) {
    currentAudio.pause();
    currentAudio = null;
    button.querySelector('.icon').textContent = '▶️';
    currentPlayButton = null;
    return;
  }

  // Arrêter l'audio précédent s'il existe
  if (currentAudio) {
    currentAudio.pause();
    if (currentPlayButton) {
      currentPlayButton.querySelector('.icon').textContent = '▶️';
    }
  }

  // Jouer le nouveau preview
  currentAudio = new Audio(previewUrl);
  currentPlayButton = button;
  button.querySelector('.icon').textContent = '⏸️';

  currentAudio.play().catch(error => {
    console.error('Error playing preview:', error);
    button.querySelector('.icon').textContent = '▶️';
  });

  // Quand l'audio se termine
  currentAudio.onended = () => {
    button.querySelector('.icon').textContent = '▶️';
    currentAudio = null;
    currentPlayButton = null;
  };
}

// ==================== USER PROFILE MODAL ====================

let selectedUserId = null;

async function openUserProfile(userId) {
  selectedUserId = userId;
  const modal = document.getElementById('user-profile-modal');
  const container = document.getElementById('modal-profile-content');

  // Afficher modal avec loading
  modal.classList.add('active');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

  try {
    // Récupérer le profil de l'utilisateur
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      container.innerHTML = '<div class="empty-state"><p>Utilisateur introuvable</p></div>';
      return;
    }

    // Mise à jour du header
    document.getElementById('modal-user-note').style.background = userProfile.color;
    document.getElementById('modal-user-username').textContent = `@${userProfile.username}`;

    const stats = await getUserStats(userId);
    document.getElementById('modal-feels-count').textContent = stats.feels;
    document.getElementById('modal-feelings-count').textContent = stats.feelings;

    // Gérer le bouton follow
    const followBtn = document.getElementById('modal-follow-btn');

    if (userId === currentUser.id) {
      followBtn.textContent = 'Toi';
      followBtn.disabled = true;
      followBtn.style.opacity = '0.5';
    } else {
      followBtn.disabled = false;
      followBtn.style.opacity = '1';

      const following = await isFollowing(userId);
      if (following) {
        followBtn.textContent = 'Unfeel';
        followBtn.classList.add('following');
      } else {
        followBtn.textContent = 'Feel';
        followBtn.classList.remove('following');
      }

      followBtn.onclick = async () => {
        const isFollowing = followBtn.classList.contains('following');
        if (isFollowing) {
          const result = await unfollowUser(userId);
          if (result.success) {
            followBtn.textContent = 'Feel';
            followBtn.classList.remove('following');
          }
        } else {
          const result = await followUser(userId);
          if (result.success) {
            followBtn.textContent = 'Unfeel';
            followBtn.classList.add('following');
          } else {
            alert(result.error);
          }
        }
      };
    }

    // Charger les posts de l'utilisateur
    const posts = await getUserPosts(userId);

    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucun shake pour le moment</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="profile-grid">
        ${posts.map(post => `
          <div class="profile-post">
            <img src="${post.cover_url}" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Cover'">
            <div class="profile-post-overlay">
              <div class="profile-post-title">${escapeHtml(post.track_name)}</div>
              <div class="profile-post-stats">
                <span>❤️ ${post.likes_count || 0}</span>
                <span>💬 ${post.comments_count || 0}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

  } catch (error) {
    console.error('Error loading user profile:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

function closeUserProfile() {
  document.getElementById('user-profile-modal').classList.remove('active');
  selectedUserId = null;
}
