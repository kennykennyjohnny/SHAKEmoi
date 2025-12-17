// 🎵 SHAKEMOI - EMOJIS SIMPLIFIÉS ET MUSICAUX

const SHAKEMOI_EMOJIS = {
  // Actions principales
  like: '♡',           // Coeur simple
  liked: '♥',          // Coeur rempli
  comment: '💬',       // Bulle
  reshake: '🔄',       // Refresh

  // Musique
  playing: '▶',        // Play
  paused: '⏸',        // Pause
  note: '♪',          // Note simple
  notes: '♫',         // Notes doubles
  speaker: '🔊',       // Son
  headphones: '🎧',    // Casque

  // Genres/moods
  chill: '☁️',        // Nuage
  party: '🎊',        // Fête simple
  sad: '🌧',          // Pluie
  energy: '⚡',       // Éclair
  night: '🌙',        // Lune
  day: '☀️',          // Soleil

  // Social
  feel: '🤝',         // Main
  top: '📈',          // Graphique montant
  fire: '🔥',         // Flamme
  new: '✨',          // Étoile

  // Navigation
  home: '🏠',         // Maison
  search: '🔍',       // Loupe
  profile: '👤',      // Silhouette
  settings: '⚙️',     // Engrenage

  // Autres
  verified: '✓',      // Check
  premium: '⭐',      // Étoile
  time: '🕐',         // Horloge
  share: '↗',         // Flèche
  menu: '⋮',          // Trois points
};

// Fonction pour appliquer les emojis partout dans l'app
function updateEmojis() {
  // Like buttons
  document.querySelectorAll('.action-button.like, .like-btn').forEach(btn => {
    const countSpan = btn.querySelector('span.count');
    const countText = countSpan ? countSpan.textContent : '';
    const isActive = btn.classList.contains('active') || btn.classList.contains('liked');

    btn.innerHTML = isActive
      ? `${SHAKEMOI_EMOJIS.liked} ${countSpan ? `<span class="count">${countText}</span>` : ''}`
      : `${SHAKEMOI_EMOJIS.like} ${countSpan ? `<span class="count">${countText}</span>` : ''}`;
  });

  // Comments
  document.querySelectorAll('.action-button.comment, .comment-btn').forEach(btn => {
    const countSpan = btn.querySelector('span.count');
    const countText = countSpan ? countSpan.textContent : '';
    btn.innerHTML = `${SHAKEMOI_EMOJIS.comment} ${countSpan ? `<span class="count">${countText}</span>` : ''}`;
  });

  // ReShakes
  document.querySelectorAll('.action-button.reshake, .reshake-btn').forEach(btn => {
    const countSpan = btn.querySelector('span.count');
    const countText = countSpan ? countSpan.textContent : '';
    btn.innerHTML = `${SHAKEMOI_EMOJIS.reshake} ${countSpan ? `<span class="count">${countText}</span>` : ''}`;
  });

  // Menu buttons
  document.querySelectorAll('.menu-button').forEach(btn => {
    if (!btn.innerHTML.includes(SHAKEMOI_EMOJIS.menu)) {
      btn.innerHTML = SHAKEMOI_EMOJIS.menu;
    }
  });

  // Play buttons
  document.querySelectorAll('.play-button').forEach(btn => {
    if (!btn.classList.contains('playing')) {
      btn.innerHTML = SHAKEMOI_EMOJIS.playing;
    } else {
      btn.innerHTML = SHAKEMOI_EMOJIS.paused;
    }
  });
}

// Appliquer au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateEmojis);
} else {
  updateEmojis();
}

// Export pour utilisation ailleurs
window.SHAKEMOI_EMOJIS = SHAKEMOI_EMOJIS;
window.updateEmojis = updateEmojis;

// Appliquer après chargement initial
setTimeout(updateEmojis, 100);
