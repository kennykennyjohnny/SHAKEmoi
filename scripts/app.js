// SHAKEMOI - App Logic

// State
let currentUser = null;
let currentProfile = null;
let currentView = 'shake';
let searchMode = 'tracks';
let selectedTrackForShake = null;
let selectedPostForComment = null;

// SVG Icons pour les actions (Figma)
const ICONS = {
  heart: `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M41.6802 9.21975C40.6587 8.19775 39.4459 7.38704 38.1109 6.83391C36.776 6.28079 35.3452 5.99609 33.9002 5.99609C32.4553 5.99609 31.0244 6.28079 29.6895 6.83391C28.3546 7.38704 27.1418 8.19775 26.1202 9.21975L24.0002 11.3397L21.8802 9.21975C19.8169 7.15636 17.0183 5.99716 14.1002 5.99716C11.1822 5.99716 8.38362 7.15636 6.32024 9.21975C4.25685 11.2831 3.09766 14.0817 3.09766 16.9997C3.09766 19.9178 4.25685 22.7164 6.32024 24.7797L24.0002 42.4597L41.6802 24.7797C42.7022 23.7582 43.5129 22.5454 44.0661 21.2105C44.6192 19.8755 44.9039 18.4447 44.9039 16.9997C44.9039 15.5548 44.6192 14.124 44.0661 12.789C43.5129 11.4541 42.7022 10.2413 41.6802 9.21975Z" stroke="currentColor" fill="FILL_COLOR" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  comment: `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M42 30C42 31.0609 41.5786 32.0783 40.8284 32.8284C40.0783 33.5786 39.0609 34 38 34H14L6 42V10C6 8.93913 6.42143 7.92172 7.17157 7.17157C7.92172 6.42143 8.93913 6 10 6H38C39.0609 6 40.0783 6.42143 40.8284 7.17157C41.5786 7.92172 42 8.93913 42 10V30Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  reshake: `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34 2L42 10M42 10L34 18M42 10H14C11.8783 10 9.84344 10.8429 8.34315 12.3431C6.84285 13.8434 6 15.8783 6 18V22M14 46L6 38M6 38L14 30M6 38H34C36.1217 38 38.1566 37.1571 39.6569 35.6569C41.1571 34.1566 42 32.1217 42 30V26" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

// Helper : Générer bouton musique selon préférence utilisateur
function getMusicButtonHtml(post, buttonClass = 'spotify-post-btn') {
  // Retourne un bouton qui déléguera l'ouverture à openMusicForPost(postId)
  return `
    <button class="${buttonClass} post-music-btn" data-post-id="${post.id}" onclick="event.stopPropagation(); openMusicForPost('${post.id}')" title="Ouvrir la plateforme musicale">
      <span class="music-icon" aria-hidden="true">♪</span>
    </button>
  `;
}

// Ouvre le lien musical approprié pour le post selon préférence utilisateur
async function openMusicForPost(postId) {
  try {
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postElement) return;

    // Recuperer les données du post depuis le DOM par ID (post data stockée en dataset si nécessaire)
    // On récupère l'URL Spotify/Apple depuis l'objet post chargé initialement (re-fetch minimal)
    // Simple méthode: demander au serveur via getFeed et trouver le post
    const posts = await getFeed(50);
    const post = posts.find(p => String(p.id) === String(postId));
    if (!post) return;

    const platform = window.getPreferredMusicPlatform ? window.getPreferredMusicPlatform() : 'spotify';

    if (platform === 'apple') {
      // Si on a déjà un apple_music_url utilisable
      if (post.apple_music_url) {
        window.open(post.apple_music_url, '_blank');
        return;
      }
      // sinon, tenter de récupérer via l'API iTunes
      if (window.fetchAppleTrackLink) {
        const url = await window.fetchAppleTrackLink(post.track_name, post.artist);
        if (url) {
          window.open(url, '_blank');
          return;
        }
      }
      // Fallback search
      const searchUrl = `https://music.apple.com/fr/search?term=${encodeURIComponent(post.track_name + ' ' + post.artist)}`;
      window.open(searchUrl, '_blank');
    } else {
      // Spotify
      const spotifyUrl = post.spotify_url || (post.track_id ? `https://open.spotify.com/track/${post.track_id}` : null);
      if (spotifyUrl) {
        window.open(spotifyUrl, '_blank');
      } else {
        // Fallback to search
        const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(post.track_name + ' ' + post.artist)}`;
        window.open(searchUrl, '_blank');
      }
    }
  } catch (err) {
    console.error('Erreur openMusicForPost:', err);
  }
}

// Met à jour l'icône / couleur du bouton music selon préférence
function updateMusicButtons() {
  const platform = window.getPreferredMusicPlatform ? window.getPreferredMusicPlatform() : 'spotify';
  document.querySelectorAll('.post-music-btn').forEach(btn => {
    if (platform === 'apple') {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16.365 1.43c-.94.06-2.07.63-2.73 1.39-.6.67-1.12 1.73-.91 2.77 1.09.07 2.19-.6 2.75-1.37.53-.72.92-1.71.89-2.79zM20.5 7.5c-.44 0-1.01.2-1.39.44-.82.49-1.63 1.51-1.63 2.92 0 1.58.81 2.35 1.68 2.98.6.42 1.4.93 1.4 1.98 0 1.04-.9 1.67-1.78 1.67-.7 0-1.16-.27-1.79-.27-.68 0-1.12.27-1.78.27-.77 0-1.68-.68-1.68-2.02 0-1.03.7-1.5 1.35-1.98.48-.36 1.03-.79 1.03-1.6 0-.95-.83-1.51-1.66-1.51-.96 0-1.68.52-2.55.52-.69 0-1.5-.27-2.08-.82C9.14 9.67 8.6 8.56 8.6 7.36c0-1.58 1-2.84 2.46-3.41 1.21-.49 2.82-.4 3.77.24.33.22.58.47.9.47.34 0 .56-.21.9-.47C18.9 3.01 20.1 2.84 21 3.68c-1.1.72-1.6 1.86-1.6 3.12z"/></svg>`;
      btn.style.background = 'linear-gradient(135deg, #BF5BC6 0%, #D459C8 100%)';
      btn.style.borderColor = '#D459C8';
      btn.style.color = '#fff';
    } else {
      // Spotify
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="#1DB954"><path d="M12 0C5.37 0 0 5.37 0 12c0 6.63 5.37 12 12 12s12-5.37 12-12C24 5.37 18.63 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9C9.6 14.58 15 15.24 18.72 16.52c.36.18.54.78.3 1.02zM19.08 14.04c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.54.78.3 1.2z"/></svg>`;
      btn.style.background = '#000';
      btn.style.borderColor = 'rgba(29, 185, 84, 0.3)';
      btn.style.color = '#1DB954';
    }
  });
}

window.updateMusicButtons = updateMusicButtons;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthAndInit();
});

// Check auth and initialize
async function checkAuthAndInit() {
  try {
    console.log('🔍 Checking auth...');

    // Protection anti-boucle
    const redirectCount = parseInt(sessionStorage.getItem('authRedirectCount') || '0');
    console.log('📊 Redirect count:', redirectCount);

    if (redirectCount > 3) {
      console.error('⚠️ Trop de redirections détectées. Arrêt pour éviter la boucle.');
      alert('Erreur: Boucle de redirection détectée. Veuillez vous reconnecter.');
      sessionStorage.removeItem('authRedirectCount');
      await supabase.auth.signOut();
      window.location.href = 'index.html';
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw sessionError;
    }

    if (!session) {
      console.log('❌ No session found, redirecting to login...');
      sessionStorage.setItem('authRedirectCount', String(redirectCount + 1));
      window.location.href = 'index.html';
      return;
    }

    console.log('✅ Session found for user:', session.user.id);
    currentUser = session.user;

    console.log('🔍 Loading user profile...');
    currentProfile = await getUserProfile(currentUser.id);

    if (!currentProfile) {
      console.error('❌ Profile not found for user:', currentUser.id);

      // Clear everything and force logout
      sessionStorage.clear();
      localStorage.clear();
      await supabase.auth.signOut();

      alert('Erreur : Votre profil est corrompu ou manquant.\n\nVeuillez vous réinscrire.\n\nSi le problème persiste, contactez le support.');
      window.location.href = 'index.html';
      return;
    }

    console.log('✅ Profile loaded:', currentProfile.username);

    // Authentification réussie, réinitialiser le compteur
    sessionStorage.removeItem('authRedirectCount');

    // Setup app
    console.log('🔧 Setting up event listeners...');
    try {
      setupEventListeners();
      console.log('✅ Event listeners set up');
    } catch (err) {
      console.error('❌ Error setting up listeners:', err);
      throw new Error('Erreur setupEventListeners: ' + err.message);
    }

    console.log('📱 Loading view shake...');
    try {
      await loadView('shake');
      console.log('✅ View loaded');
    } catch (err) {
      console.error('❌ Error loading view:', err);
      throw new Error('Erreur loadView: ' + err.message);
    }

    // Initialiser les notifications
    console.log('🔔 Initializing notifications...');
    try {
      if (typeof notifManager !== 'undefined') {
        await notifManager.loadNotifications();
        notifManager.subscribeToNotifications();
        console.log('✅ Notifications initialized');
      } else {
        console.log('⚠️ notifManager not defined, skipping');
      }
    } catch (err) {
      console.error('❌ Error with notifications:', err);
      // Don't throw, notifications are optional
    }

    console.log('✅ App initialized successfully');

  } catch (error) {
    console.error('💥 Init error:', error);
    console.error('💥 Stack:', error.stack);
    alert('Erreur d\'initialisation: ' + error.message + '\n\nOuvre la console (F12) pour plus de détails.');
    sessionStorage.removeItem('authRedirectCount');
    // Don't sign out, just stay on the page to see logs
    // await supabase.auth.signOut();
    // window.location.href = 'index.html';
  }

  // Initialize settings UI and music buttons (ensure correct visuals from start)
  if (window.initSettingsMenu) window.initSettingsMenu();
  if (window.updateMusicButtons) window.updateMusicButtons();
}

// Setup all event listeners
function setupEventListeners() {
  // Logo cliquable - retour au feed
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => {
      loadView('shake');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Settings button (remplace logout)
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (window.initSettingsMenu) window.initSettingsMenu();
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsMenu) settingsMenu.style.display = 'block';
    });
  }

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
      const searchResults = document.getElementById('search-results');
      if (searchResults) {
        searchResults.innerHTML = '<div class="empty-state"><p>Tape quelque chose pour rechercher</p></div>';
      }
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        handleSearch(e.target.value);
      }, 300);
    });
  }

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

  // Close settings
  const settingsClose = document.getElementById('settings-close');
  if (settingsClose) {
    settingsClose.addEventListener('click', () => {
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsMenu) settingsMenu.style.display = 'none';
    });
  }

  // Modal events - with null checks
  const cancelComment = document.getElementById('cancel-comment');
  const submitCommentBtn = document.getElementById('submit-comment');
  const cancelShake = document.getElementById('cancel-shake');
  const submitShakeBtn = document.getElementById('submit-shake');

  if (cancelComment) cancelComment.addEventListener('click', closeCommentModal);
  if (submitCommentBtn) submitCommentBtn.addEventListener('click', submitComment);
  if (cancelShake) cancelShake.addEventListener('click', closeShakeModal);
  if (submitShakeBtn) submitShakeBtn.addEventListener('click', submitShake);
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

  // Gérer l'affichage du bouton "Modifier" dans le header
  const editBtn = document.getElementById('btn-edit-profile-header');
  if (editBtn) {
    if (viewName !== 'profile') {
      // Cacher le bouton sur les autres vues
      editBtn.style.display = 'none';
    }
    // Si c'est la vue profil, loadUserProfile() s'occupera de l'afficher si nécessaire
  }

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

  // Afficher skeleton loader
  container.innerHTML = renderSkeletonPosts(5);

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

    // Update music buttons visuals according to user preference
    if (window.updateMusicButtons) window.updateMusicButtons();

    // Appliquer les émojis après rendu
    if (window.updateEmojis) {
      window.updateEmojis();
    }

  } catch (error) {
    console.error('Error loading feed:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

// Render skeleton loader posts
function renderSkeletonPosts(count = 5) {
  return Array(count).fill(0).map(() => `
    <div class="skeleton-post">
      <div style="display: flex; gap: 12px;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
        <div style="flex: 1;">
          <div class="skeleton" style="width: 60%; height: 16px; margin-bottom: 8px;"></div>
          <div class="skeleton" style="width: 100%; height: 80px; border-radius: 12px;"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPost(post) {
  const timeAgo = getTimeAgo(post.created_at);
  const postId = post.id;
  const hasPreview = post.preview_url && post.preview_url !== 'null';

  // FIX RE-SHAKE : Ne plus afficher le reshake-header, juste compter
  const isReshake = post.is_reshake;
  // Toujours afficher l'auteur du post (même si c'est un reshake, on affiche le reshaker)
  const author = post.user;

  // Avatar de l'auteur
  const avatarStyle = author.profile_album_cover_url
    ? `background-image: url(${author.profile_album_cover_url}); background-size: cover; background-position: center; border: 3px solid ${author.profile_color || author.color};`
    : `background: ${author.profile_color || author.color};`;

  const avatarContent = author.profile_album_cover_url ? '' : '♪';

  return `
    <article class="post" data-post-id="${postId}">
      <div class="post-content">
        <!-- Avatar -->
        <div class="user-note" style="${avatarStyle} cursor: pointer;" onclick="openUserProfile('${author.id}')">${avatarContent}</div>

        <!-- Post info right -->
        <div class="post-info-right">
          <!-- Header -->
          <div class="post-header-inline">
            <span class="username-inline" onclick="openUserProfile('${author.id}')">@${author.username}</span>
            <span class="dot-separator">·</span>
            <span class="timestamp-inline">${timeAgo}</span>
          </div>

          <!-- Text si présent -->
          ${post.text ? `<p class="post-text">${makeUsernamesClickable(post.text)}</p>` : ''}

          <!-- Music card -->
          <div class="music-card">
            <div class="track-cover-container">
              <img src="${post.cover_url}"
                   class="track-cover"
                   id="cover-${postId}"
                   alt="${post.track_name}"
                   onerror="this.src='https://via.placeholder.com/100x100?text=No+Cover'"
                   loading="lazy">
              ${hasPreview ? `
                <div class="play-overlay" id="play-${postId}" onclick="togglePlayPreview('${post.preview_url}', '${postId}')">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              ` : ''}
            </div>
            <div class="track-info-compact">
              <h3 class="track-title">${escapeHtml(post.track_name)}</h3>
              <p class="track-artist">${escapeHtml(post.artist)}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="post-actions">
            <button class="action-btn like-btn" data-post-id="${postId}">
              ${ICONS.heart.replace('FILL_COLOR', 'none')}
              <span class="count">${post.likes_count || ''}</span>
            </button>
            <button class="action-btn comment-btn" data-post-id="${postId}">
              ${ICONS.comment}
              <span class="count">${post.comments_count || ''}</span>
            </button>
            <button class="action-btn reshake-btn ${isReshake ? 'active' : ''}" data-post-id="${postId}">
              ${ICONS.reshake}
              <span class="count">${post.reshakes_count || ''}</span>
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
        // Remplir le coeur si déjà liké
        const count = btn.querySelector('.count').textContent;
        btn.innerHTML = ICONS.heart.replace('FILL_COLOR', '#FF7668') + `<span class="count">${count}</span>`;
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
          // Mettre à jour le SVG pour vider le coeur
          btn.innerHTML = ICONS.heart.replace('FILL_COLOR', 'none') + `<span class="count">${Math.max(0, count - 1) || ''}</span>`;
        }
      } else {
        const result = await likePost(postId);
        if (result.success) {
          btn.classList.add('liked');
          const count = parseInt(btn.querySelector('.count').textContent);
          btn.querySelector('.count').textContent = count + 1;
          // Mettre à jour le SVG pour remplir le coeur
          btn.innerHTML = ICONS.heart.replace('FILL_COLOR', '#FF7668') + `<span class="count">${count + 1 || ''}</span>`;
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
          // Refresh feed to ensure we display original author correctly
          await loadFeed();
        } else {
          alert('Erreur: ' + result.error);
        }
      }
    });
  });
}

// ==================== TOP 100 ====================

// Variable pour stocker l'onglet actif du Top
let currentTopTab = 'france';

async function loadTop100() {
  // Charger l'onglet par défaut (Pour toi)
  await loadTopTab('reco');
  attachTopTabListeners();
}

function attachTopTabListeners() {
  document.querySelectorAll('.top-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.topTab;

      // Mettre à jour l'état actif
      document.querySelectorAll('.top-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Charger le contenu de l'onglet
      loadTopTab(tabName);
    });
  });
}

async function loadTopTab(tabName) {
  currentTopTab = tabName;
  const container = document.getElementById('top-container');

  switch(tabName) {
    case 'spotify':
      await loadTopSpotify(container);
      break;
    case 'shakemoi':
      await loadTopShakemoi(container);
      break;
    case 'reco':
      await loadTopReco(container);
      break;
  }
}

// Fonction loadTopFrance supprimée - non utilisée

async function loadTopSpotify(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement du Top Spotify...</p></div>';

  try {
    // Utiliser une playlist globale top 50 Spotify
    const tracks = await spotify.getGlobalTop50();

    if (tracks.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Impossible de charger le Top Spotify</p></div>';
      return;
    }

    container.innerHTML = tracks.map(track => renderTopTrack(track)).join('');
    attachTopTrackListeners();

  } catch (error) {
    console.error('Error loading Top Spotify:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

async function loadTopShakemoi(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement du Top Shakemoi...</p></div>';

  try {
    // Récupérer tous les posts triés par likes_count
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color)
      `)
      .order('likes_count', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucun son dans le Top Shakemoi pour le moment</p></div>';
      return;
    }

    // Transformer en format track
    const tracks = posts.map((post, index) => ({
      rank: index + 1,
      name: post.track_name,
      artist: post.artist,
      cover: post.cover_url,
      spotify_url: post.spotify_url,
      track_id: post.track_id,
      shakeCount: post.likes_count,
      preview_url: post.preview_url
    }));

    container.innerHTML = tracks.map(track => renderTopTrack(track, true)).join('');
    attachTopTrackListeners();

  } catch (error) {
    console.error('Error loading Top Shakemoi:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

async function loadTopReco(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement des recommandations...</p></div>';

  try {
    // Récupérer les posts likés par l'utilisateur pour analyser ses goûts
    const likedPosts = await getUserLikedPosts(currentUser.id);

    if (likedPosts.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Like des morceaux pour recevoir des recommandations personnalisées !</p></div>';
      return;
    }

    // Extraire les artistes des posts likés
    const likedArtists = likedPosts.map(post => post.artist).filter(Boolean);

    // Si on a des artistes, chercher des morceaux similaires via Spotify
    if (likedArtists.length > 0) {
      // Prendre un artiste aléatoire parmi les préférés
      const randomArtist = likedArtists[Math.floor(Math.random() * likedArtists.length)];

      // Chercher des morceaux similaires
      const recoTracks = await spotify.searchTracks(`artist:${randomArtist}`);

      if (recoTracks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Impossible de charger les recommandations</p></div>';
        return;
      }

      // Ajouter un rang aux tracks
      const tracksWithRank = recoTracks.slice(0, 30).map((track, index) => ({
        ...track,
        rank: index + 1
      }));

      container.innerHTML = tracksWithRank.map(track => renderTopTrack(track)).join('');
      attachTopTrackListeners();
    } else {
      // Fallback : afficher le Top Spotify
      await loadTopSpotify(container);
    }

  } catch (error) {
    console.error('Error loading recommendations:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}

function renderTopTrack(track, showShakeCount = false) {
  // Escape JSON pour éviter les problèmes avec les quotes
  const trackData = JSON.stringify(track).replace(/'/g, '&apos;');

  return `
    <div class="top-track" data-track='${trackData}'>
      <div class="track-rank">#${track.rank}</div>
      <img src="${track.cover}" class="track-cover" alt="${track.name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Cover'">
      <div class="track-info">
        <h3 class="track-title">${escapeHtml(track.name)}</h3>
        <p class="track-artist">${escapeHtml(track.artist)}${showShakeCount && track.shakeCount ? ` • ${track.shakeCount} shakes` : ''}</p>
      </div>
      <div class="track-actions">
        ${track.spotify_url || track.external_urls?.spotify ? `
          <button class="action-btn spotify-btn" title="Ouvrir dans Spotify" onclick="window.open('${track.spotify_url || track.external_urls?.spotify}', '_blank')">
            <span class="icon">🎵</span>
          </button>
        ` : ''}
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
        ${track.spotify_url || track.external_urls?.spotify ? `
          <button class="action-btn spotify-btn" title="Ouvrir dans Spotify" onclick="window.open('${track.spotify_url || track.external_urls?.spotify}', '_blank')">
            <span class="icon">🎵</span>
          </button>
        ` : ''}
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
  // Utiliser la photo de profil si disponible, sinon la note musicale
  const avatarStyle = user.profile_album_cover_url
    ? `background-image: url(${user.profile_album_cover_url}); background-size: cover; background-position: center; border: 3px solid ${user.profile_color || user.color};`
    : `background: ${user.profile_color || user.color};`;

  const avatarContent = user.profile_album_cover_url ? '' : '♪';

  return `
    <div class="user-result" data-user-id="${user.id}">
      <div class="user-avatar" style="${avatarStyle} cursor: pointer;" onclick="openUserProfile('${user.id}')">${avatarContent}</div>
      <div class="user-info" style="cursor: pointer;" onclick="openUserProfile('${user.id}')">
        <div class="user-name">@${escapeHtml(user.username)}</div>
        <div class="user-stats">${user.feels_count || 0} shakeurs</div>
      </div>
      <button class="btn-follow" data-user-id="${user.id}">Shake</button>
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
      btn.textContent = 'Unshake';
      btn.classList.add('following');
    }

    btn.addEventListener('click', async () => {
      const isFollowing = btn.classList.contains('following');

      if (isFollowing) {
        const result = await unfollowUser(userId);
        if (result.success) {
          btn.textContent = 'Shake';
          btn.classList.remove('following');
        }
      } else {
        const result = await followUser(userId);
        if (result.success) {
          btn.textContent = 'Unshake';
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
      .from('users_profile')
      .select('profile_album_cover_url, profile_album_id, profile_color')
      .eq('id', userId)
      .single();

    // Afficher bouton "Modifier" dans le header (seulement sur son propre profil)
    const editBtn = document.getElementById('btn-edit-profile-header');
    if (editBtn) {
      // Afficher seulement si c'est le profil de l'utilisateur connecté
      if (userId === currentUser.id) {
        editBtn.style.display = 'flex';
      } else {
        editBtn.style.display = 'none';
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

    // Appliquer la couleur uniquement sur la page profil (pas globalement)
    document.getElementById('user-username').textContent = `@${currentProfile.username}`;

    // Appliquer la couleur pastel aux notes décoratives
    const decorativeNotes = document.querySelectorAll('#decorative-notes .note');
    decorativeNotes.forEach(note => {
      note.style.color = profileColor;
    });

    const stats = await getUserStats(userId);
    const feelsElement = document.getElementById('feels-count');

    feelsElement.textContent = stats.feels;
    feelsElement.style.color = profileColor; // Accent de couleur sur le profil seulement

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
      // Charger les posts réellement partagés par l'utilisateur (pas les likes)
      const posts = await getUserPosts(currentUser.id);

      console.log('Posts partagés récupérés:', posts.length, posts);

      if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun shake pour le moment.<br><small>Partage des morceaux pour les voir ici !</small></p></div>';
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
                ${post.spotify_url || post.track_id ? `
                  <button class="spotify-profile-btn" onclick="window.open('${post.spotify_url || `https://open.spotify.com/track/${post.track_id}`}', '_blank')" title="Ouvrir dans Spotify">
                    🎵 Spotify
                  </button>
                ` : ''}
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
                ${post.spotify_url || post.track_id ? `
                  <button class="spotify-profile-btn" onclick="window.open('${post.spotify_url || `https://open.spotify.com/track/${post.track_id}`}', '_blank')" title="Ouvrir dans Spotify">
                    🎵 Spotify
                  </button>
                ` : ''}
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

// ==================== SHARE MODAL ====================

function openShareModal() {
  const modal = document.getElementById('share-modal');
  modal.style.display = 'flex';

  // Copier automatiquement le lien lors de l'ouverture
  copyShareLink();
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  modal.style.display = 'none';

  // Réinitialiser le texte du bouton
  const copyText = document.getElementById('copy-text');
  const copyBtn = document.getElementById('btn-copy-link');
  if (copyText && copyBtn) {
    copyText.textContent = 'Copier';
    copyBtn.classList.remove('copied');
  }
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  const copyText = document.getElementById('copy-text');
  const copyBtn = document.getElementById('btn-copy-link');

  if (!input || !copyText || !copyBtn) return;

  // Sélectionner et copier le texte
  input.select();
  input.setSelectionRange(0, 99999); // Pour mobile

  try {
    navigator.clipboard.writeText(input.value);

    // Feedback visuel
    copyText.textContent = '✓ Copié !';
    copyBtn.classList.add('copied');

    // Réinitialiser après 2 secondes
    setTimeout(() => {
      copyText.textContent = 'Copier';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Erreur lors de la copie:', err);
    copyText.textContent = 'Erreur';
  }
}

// ==================== COMMENTS ====================

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

    // Mise à jour du header avec photo de profil personnalisée
    const modalNote = document.getElementById('modal-user-note');
    const profileColor = userProfile.profile_color || userProfile.color;

    if (userProfile.profile_album_cover_url) {
      modalNote.style.backgroundImage = `url(${userProfile.profile_album_cover_url})`;
      modalNote.style.backgroundSize = 'cover';
      modalNote.style.backgroundPosition = 'center';
      modalNote.style.border = `6px solid ${profileColor}`;
      modalNote.textContent = '';
    } else {
      modalNote.style.background = profileColor;
      modalNote.style.backgroundImage = 'none';
      modalNote.style.border = `6px solid ${profileColor}`;
      modalNote.textContent = '♪';
    }

    document.getElementById('modal-user-username').textContent = `@${userProfile.username}`;

    // Appliquer la couleur pastel aux notes décoratives de la modal
    const modalDecorativeNotes = document.querySelectorAll('#modal-decorative-notes .note');
    modalDecorativeNotes.forEach(note => {
      note.style.color = profileColor;
    });

    const stats = await getUserStats(userId);
    const modalFeelsCount = document.getElementById('modal-feels-count');
    modalFeelsCount.textContent = stats.feels;
    modalFeelsCount.style.color = profileColor;

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
        followBtn.textContent = 'Unshake';
        followBtn.classList.add('following');
      } else {
        followBtn.textContent = 'Shake';
        followBtn.classList.remove('following');
      }

      followBtn.onclick = async () => {
        const isFollowing = followBtn.classList.contains('following');
        if (isFollowing) {
          const result = await unfollowUser(userId);
          if (result.success) {
            followBtn.textContent = 'Shake';
            followBtn.classList.remove('following');
          }
        } else {
          const result = await followUser(userId);
          if (result.success) {
            followBtn.textContent = 'Unshake';
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
              ${post.spotify_url || post.track_id ? `
                <button class="spotify-profile-btn" onclick="window.open('${post.spotify_url || `https://open.spotify.com/track/${post.track_id}`}', '_blank')" title="Ouvrir dans Spotify">
                  🎵 Spotify
                </button>
              ` : ''}
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
