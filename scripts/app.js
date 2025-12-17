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
  // Logo cliquable - retour au feed
  document.querySelector('.logo').addEventListener('click', () => {
    loadView('shake');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

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

// Fonction pour afficher les commentaires (initialement cachés)
async function renderComments(postId, commentsCount) {
  if (!commentsCount || commentsCount === 0) {
    return '';
  }

  // Charger les 3 premiers commentaires
  const comments = await getPostComments(postId);

  if (!comments || comments.length === 0) {
    return '';
  }

  const previewComments = comments.slice(0, 3);
  const hasMore = comments.length > 3;

  return `
    <div class="comments-section" id="comments-${postId}" style="display: none;">
      <div class="comments-list">
        ${previewComments.map(comment => `
          <div class="comment-item">
            <div class="comment-avatar" style="background: ${comment.user.color}">♪</div>
            <div class="comment-content">
              <span class="comment-username" onclick="openUserProfile('${comment.user.id}')">@${comment.user.username}</span>
              <p class="comment-text">${makeUsernamesClickable(comment.text)}</p>
            </div>
          </div>
        `).join('')}
      </div>
      ${hasMore ? `
        <button class="show-more-comments" onclick="showAllComments('${postId}')">
          Voir les ${comments.length - 3} autres commentaires
        </button>
      ` : ''}
    </div>
  `;
}

// Fonction pour afficher les commentaires avec input (style Instagram)
async function renderCommentsWithInput(postId, comments) {
  const commentsList = comments && comments.length > 0 ? comments.map(comment => `
    <div class="comment-item">
      <div class="comment-avatar" style="background: ${comment.user.color}">♪</div>
      <div class="comment-content">
        <span class="comment-username" onclick="openUserProfile('${comment.user.id}')">@${comment.user.username}</span>
        <p class="comment-text">${makeUsernamesClickable(comment.text)}</p>
      </div>
    </div>
  `).join('') : '<p class="no-comments">Aucun commentaire</p>';

  return `
    <div class="comments-section" id="comments-${postId}">
      <div class="comments-list">
        ${commentsList}
      </div>
      <div class="comment-input-container">
        <input type="text"
               class="comment-input"
               id="comment-input-${postId}"
               placeholder="Ajoute un commentaire...">
        <button class="comment-submit-btn" data-post-id="${postId}">Publier</button>
      </div>
    </div>
  `;
}

// Fonction pour attacher le listener à l'input de commentaire
function attachCommentInputListener(postId) {
  const submitBtn = document.querySelector(`.comment-submit-btn[data-post-id="${postId}"]`);
  const input = document.getElementById(`comment-input-${postId}`);

  if (submitBtn && input) {
    submitBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;

      const result = await addComment(postId, text);
      if (result.success) {
        input.value = '';
        // Recharger les commentaires
        const comments = await getPostComments(postId);
        const commentsList = document.querySelector(`#comments-${postId} .comments-list`);
        commentsList.innerHTML = comments.map(comment => `
          <div class="comment-item">
            <div class="comment-avatar" style="background: ${comment.user.color}">♪</div>
            <div class="comment-content">
              <span class="comment-username" onclick="openUserProfile('${comment.user.id}')">@${comment.user.username}</span>
              <p class="comment-text">${makeUsernamesClickable(comment.text)}</p>
            </div>
          </div>
        `).join('');
        // Mettre à jour le compteur
        const btn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
        if (btn) {
          const count = parseInt(btn.querySelector('.count').textContent);
          btn.querySelector('.count').textContent = count + 1;
        }
      }
    });

    // Submit on Enter
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  }
}

async function loadFeed() {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement du feed...</p></div>';

  try {
    const posts = await getFeed();

    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Ton feed est vide ! Commence par "feel" des personnes dans l\'onglet Recherche.</p></div>';
      return;
    }

    // Render posts with comments
    const postsHtml = await Promise.all(posts.map(async post => {
      const postHtml = renderPost(post);
      const commentsHtml = await renderComments(post.id, post.comments_count);
      return postHtml.replace('</article>', `${commentsHtml}</article>`);
    }));

    container.innerHTML = postsHtml.join('');
    attachPostListeners();

    // Appliquer les émojis après rendu
    if (window.updateEmojis) {
      window.updateEmojis();
    }

  } catch (error) {
    console.error('Error loading feed:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

function renderPost(post) {
  const timeAgo = getTimeAgo(post.created_at);
  const postId = post.id;
  const hasPreview = post.preview_url && post.preview_url !== 'null';

  // Si c'est un reshake, utiliser l'auteur original pour le corps du post
  const originalAuthor = post.is_reshake && post.original_post?.user ? post.original_post.user : post.user;

  // Si c'est un reshake, afficher l'info avec l'utilisateur qui a reshake
  const reshakeHeader = post.is_reshake ? `
    <div class="reshake-header">
      <span class="reshake-icon">↻</span>
      <span class="reshake-text">
        <span class="username" style="cursor: pointer;" onclick="openUserProfile('${post.user.id}')">@${post.user.username}</span> a reshake
      </span>
    </div>
  ` : '';

  return `
    <article class="post post-with-comments" data-post-id="${postId}">
      ${reshakeHeader}

      <div class="post-content">
        <!-- Pochette à gauche avec play button -->
        <div class="track-cover-container">
          <img src="${post.cover_url}"
               class="track-cover"
               id="cover-${postId}"
               alt="${post.track_name}"
               onerror="this.src='https://via.placeholder.com/100x100?text=No+Cover'">
          ${hasPreview ? `
            <div class="play-overlay" id="play-${postId}" onclick="togglePlayPreview('${post.preview_url}', '${postId}')">
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          ` : ''}
        </div>

        <!-- Infos à droite -->
        <div class="post-info-right">
          <!-- User + timestamp (auteur original si reshake) -->
          <div class="post-header-inline">
            <div class="user-note" style="background: ${originalAuthor.color}; cursor: pointer;" onclick="openUserProfile('${originalAuthor.id}')">♪</div>
            <span class="username-inline" onclick="openUserProfile('${originalAuthor.id}')">@${originalAuthor.username}</span>
            <span class="timestamp-inline">${timeAgo}</span>
          </div>

          <!-- Track info -->
          <div class="track-info-compact">
            <h3 class="track-title">${escapeHtml(post.track_name)}</h3>
            <p class="track-artist">${escapeHtml(post.artist)}</p>
          </div>

          ${post.text ? `<p class="post-text">${makeUsernamesClickable(post.text)}</p>` : ''}

          <!-- Actions -->
          <div class="post-actions">
            <button class="action-btn like-btn" data-post-id="${postId}">
              <span class="icon">♥</span>
              <span class="count">${post.likes_count || 0}</span>
            </button>
            <button class="action-btn comment-btn" data-post-id="${postId}">
              <span class="icon">💭</span>
              <span class="count">${post.comments_count || 0}</span>
            </button>
            <button class="action-btn reshake-btn" data-post-id="${postId}">
              <span class="icon">↻</span>
            </button>
          </div>
        </div>
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

  // Comment buttons - Toggle comments visibility (style Instagram)
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;
      const postElement = document.querySelector(`[data-post-id="${postId}"]`);
      let commentsSection = postElement.querySelector('.comments-section');

      // Toggle visibility des commentaires
      if (commentsSection) {
        const isHidden = commentsSection.style.display === 'none';
        commentsSection.style.display = isHidden ? 'block' : 'none';
      } else {
        // Créer et afficher la section commentaires si elle n'existe pas
        const comments = await getPostComments(postId);
        const commentsHtml = await renderCommentsWithInput(postId, comments);
        postElement.insertAdjacentHTML('beforeend', commentsHtml);
        attachCommentInputListener(postId);
      }
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
          <span class="icon">♥</span>
        </button>
        ${track.preview_url ? `
          <button class="action-btn preview-btn" title="Écouter 30s" onclick="playPreview('${track.preview_url}', this)">
            <span class="icon">▶</span>
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
          <span class="icon">♥</span>
        </button>
        ${track.preview_url ? `
          <button class="action-btn preview-btn" title="Écouter 30s" onclick="playPreview('${track.preview_url}', this)">
            <span class="icon">▶</span>
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
        <div class="user-stats">${user.feels_count || 0} shakeurs</div>
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
  await loadUserProfile(currentUser.id);
}

async function loadUserProfile(userId) {
  try {
    // Charger les données de personnalisation du profil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('profile_album_cover_url, profile_album_id, profile_color')
      .eq('user_id', userId)
      .single();

    // Afficher bouton "Modifier" (seulement sur son propre profil)
    const editBtn = document.getElementById('btn-edit-profile');
    if (editBtn) {
      // Afficher seulement si c'est le profil de l'utilisateur connecté
      if (userId === currentUser.id) {
        editBtn.classList.add('visible');
      } else {
        editBtn.classList.remove('visible');
      }
    }

    // Update header avec pochette personnalisée ou note musicale
    const userNote = document.getElementById('user-note');
    const profileColor = profileData?.profile_color || currentProfile.color;

    if (profileData?.profile_album_cover_url) {
      // Utiliser la pochette d'album comme photo de profil
      userNote.style.backgroundImage = `url(${profileData.profile_album_cover_url})`;
      userNote.style.backgroundSize = 'cover';
      userNote.style.backgroundPosition = 'center';
      userNote.style.border = `6px solid ${profileColor}`;
      userNote.textContent = ''; // Retirer la note musicale
    } else {
      // Utiliser la note musicale par défaut
      userNote.style.background = profileColor;
      userNote.style.backgroundImage = 'none';
      userNote.style.border = `6px solid ${profileColor}`;
      userNote.textContent = '♪';
    }

    // Appliquer la couleur comme accent
    document.documentElement.style.setProperty('--profile-accent', profileColor);

    document.getElementById('user-username').textContent = `@${currentProfile.username}`;

    const stats = await getUserStats(userId);
    const feelsElement = document.getElementById('feels-count');

    feelsElement.textContent = stats.feels;
    feelsElement.style.color = profileColor; // Accent de couleur

    // Make stats clickable - only shows people who follow you (Shakeurs)
    feelsElement.style.cursor = 'pointer';
    feelsElement.onclick = () => showFollowersList('shakeurs');

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
                  <span>♥ ${post.likes_count || 0}</span>
                  <span>💭 ${post.comments_count || 0}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } else if (tab === 'reshakes') {
      // Charger les reshakes de l'utilisateur
      const { data: reshakes, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:users_profile!posts_user_id_fkey(id, username, color)
        `)
        .eq('user_id', currentUser.id)
        .eq('is_reshake', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading reshakes:', error);
        container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
        return;
      }

      if (!reshakes || reshakes.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun re-shake pour le moment.<br><small>Reshake des posts pour les voir ici !</small></p></div>';
        return;
      }

      container.innerHTML = `
        <div class="profile-grid">
          ${reshakes.map(post => `
            <div class="profile-post">
              <img src="${post.cover_url}" alt="${post.track_name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Cover'">
              <div class="profile-post-overlay">
                <div class="profile-post-title">${escapeHtml(post.track_name)}</div>
                <div class="profile-post-stats">
                  <span>♥ ${post.likes_count || 0}</span>
                  <span>💭 ${post.comments_count || 0}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
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

// Fonction pour rendre les @username cliquables
function makeUsernamesClickable(text) {
  if (!text) return '';

  // Escape HTML d'abord
  const escaped = escapeHtml(text);

  // Remplacer @username par un span cliquable
  return escaped.replace(/@(\w+)/g, (match, username) => {
    return `<span class="mention" onclick="searchAndOpenProfile('${username}')">@${username}</span>`;
  });
}

// Fonction pour rechercher et ouvrir un profil par username
window.searchAndOpenProfile = async function(username) {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !data) {
      alert(`Utilisateur @${username} introuvable`);
      return;
    }

    openUserProfile(data.id);
  } catch (error) {
    console.error('Error finding user:', error);
    alert(`Erreur lors de la recherche de @${username}`);
  }
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

// ==================== AUDIO PREVIEW AVEC ANIMATIONS ====================

let currentAudio = null;
let currentPostId = null;

// Fonction GLOBALE pour le player
window.togglePlayPreview = function(previewUrl, postId) {
  console.log('🎵 Play clicked:', postId, previewUrl);

  if (!previewUrl || previewUrl === 'null') {
    alert('Pas de preview disponible pour ce morceau 😢');
    return;
  }

  const coverElement = document.getElementById(`cover-${postId}`);
  const playOverlay = document.getElementById(`play-${postId}`);

  if (!coverElement || !playOverlay) {
    console.error('❌ Elements not found for post', postId);
    return;
  }

  // Si on clique sur le même post
  if (currentAudio && currentPostId === postId) {
    if (currentAudio.paused) {
      // Reprendre
      currentAudio.play();
      coverElement.classList.add('playing');
      playOverlay.classList.add('playing');
      playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
    } else {
      // Pause
      currentAudio.pause();
      coverElement.classList.remove('playing');
      playOverlay.classList.remove('playing');
      playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    }
    return;
  }

  // Arrêter l'audio précédent
  if (currentAudio) {
    currentAudio.pause();
    if (currentPostId) {
      const oldCover = document.getElementById(`cover-${currentPostId}`);
      const oldOverlay = document.getElementById(`play-${currentPostId}`);
      if (oldCover) oldCover.classList.remove('playing');
      if (oldOverlay) {
        oldOverlay.classList.remove('playing');
        oldOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
      }
    }
  }

  // Créer et jouer le nouveau son
  currentAudio = new Audio(previewUrl);
  currentPostId = postId;

  console.log('▶️ Playing audio...');

  currentAudio.play().then(() => {
    console.log('✅ Audio playing!');
    coverElement.classList.add('playing');
    playOverlay.classList.add('playing');
    playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
  }).catch(error => {
    console.error('❌ Error playing audio:', error);
    alert('Impossible de lire ce morceau (preview Spotify non disponible)');
  });

  // Quand le son se termine
  currentAudio.onended = () => {
    console.log('⏹️ Audio ended');
    coverElement.classList.remove('playing');
    playOverlay.classList.remove('playing');
    playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    currentAudio = null;
    currentPostId = null;
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

// Show all comments for a post
window.showAllComments = async function(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  if (!commentsSection) return;

  const allComments = await getPostComments(postId);
  if (!allComments || allComments.length === 0) return;

  commentsSection.querySelector('.comments-list').innerHTML = allComments.map(comment => `
    <div class="comment-item">
      <div class="comment-avatar" style="background: ${comment.user.color}">♪</div>
      <div class="comment-content">
        <span class="comment-username" onclick="openUserProfile('${comment.user.id}')">@${comment.user.username}</span>
        <p class="comment-text">${makeUsernamesClickable(comment.text)}</p>
      </div>
    </div>
  `).join('');

  // Remove "show more" button
  const showMoreBtn = commentsSection.querySelector('.show-more-comments');
  if (showMoreBtn) showMoreBtn.remove();
}

// Make Shakeurs clickable - Show followers list
window.showFollowersList = async function(type) {
  if (!currentUser) return;

  const users = await getUserFollowers(currentUser.id);

  if (users.length === 0) {
    alert('Personne ne te shake pour le moment 🎵');
    return;
  }

  showUsersListModal('Tes Shakeurs', users);
}

// Show modal with users list
function showUsersListModal(title, users) {
  const modal = document.getElementById('user-profile-modal');
  const content = modal.querySelector('.modal-content');

  // Sauvegarder le contenu original
  const originalContent = content.innerHTML;

  content.innerHTML = `
    <button class="modal-close" onclick="closeUsersListModal()">✕</button>
    <div class="profile-header">
      <h2 style="margin: 1rem 0;">${title}</h2>
    </div>
    <div class="users-list-container" style="padding: 1rem; max-height: 60vh; overflow-y: auto;">
      ${users.map(user => `
        <div class="user-result" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <div class="user-avatar" style="background: ${user.color}; cursor: pointer;" onclick="closeUsersListModal(); openUserProfile('${user.id}')">♪</div>
          <div class="user-info" style="flex: 1; cursor: pointer;" onclick="closeUsersListModal(); openUserProfile('${user.id}')">
            <div class="user-name">@${escapeHtml(user.username)}</div>
            <div class="user-stats" style="font-size: 0.875rem; color: var(--text-secondary);">${user.feels_count || 0} shakeurs</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  modal.classList.add('active');

  // Restaurer le contenu original quand on ferme
  modal.dataset.originalContent = originalContent;
}

function closeUsersListModal() {
  const modal = document.getElementById('user-profile-modal');
  const content = modal.querySelector('.modal-content');

  if (modal.dataset.originalContent) {
    content.innerHTML = modal.dataset.originalContent;
    delete modal.dataset.originalContent;
  }

  modal.classList.remove('active');
}

// Export pour profile-customization.js
window.loadUserProfile = loadUserProfile;
