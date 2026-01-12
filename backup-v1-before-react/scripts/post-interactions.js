// 🎵 POST INTERACTIONS - SHAKEMOI

// Toggle menu hamburger
function togglePostMenu(button) {
  const menu = button.nextElementSibling;
  const isActive = menu.classList.contains('active');

  // Fermer tous les menus
  document.querySelectorAll('.menu-dropdown').forEach(m => {
    m.classList.remove('active');
  });

  if (!isActive) {
    menu.classList.add('active');
  }
}

// Fermer menus au clic extérieur
document.addEventListener('click', (e) => {
  if (!e.target.closest('.post-menu')) {
    document.querySelectorAll('.menu-dropdown').forEach(m => {
      m.classList.remove('active');
    });
  }
});

// Ouvrir dans Spotify
function openInSpotify(trackUri) {
  // Web player URL
  const trackId = trackUri.split(':').pop();
  const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
  window.open(spotifyUrl, '_blank');
}

// Toggle play/pause - SIMPLIFIÉ : ouvre juste dans Spotify
async function togglePlay(coverElement) {
  const post = coverElement.closest('.post');
  const trackUri = post.dataset.trackUri;

  // Ouvrir directement dans Spotify
  openInSpotify(trackUri);
}

// Générer et animer waveform
function animateWaveform(waveformElement) {
  // Générer 30 barres si pas déjà fait
  if (waveformElement.children.length === 0) {
    for (let i = 0; i < 30; i++) {
      const bar = document.createElement('div');
      bar.className = 'wave-bar';
      const randomHeight = Math.random() * 100;
      bar.style.height = `${randomHeight}%`;
      waveformElement.appendChild(bar);
    }
  }

  // Animation continue
  const bars = waveformElement.querySelectorAll('.wave-bar');
  let currentBar = 0;

  const animate = () => {
    // Reset previous
    bars.forEach(b => b.classList.remove('active'));

    // Activate current
    bars[currentBar].classList.add('active');

    // Random height pour effet vivant
    bars.forEach(bar => {
      const newHeight = Math.random() * 100;
      bar.style.height = `${newHeight}%`;
    });

    currentBar = (currentBar + 1) % bars.length;
  };

  // Interval
  const interval = setInterval(animate, 100);

  // Sauvegarder interval pour pouvoir stop
  waveformElement.dataset.interval = interval;
}

// Seek dans timeline - DÉSACTIVÉ pour le moment
function seek(event, timelineBar) {
  // Fonctionnalité désactivée - sera réactivée avec Spotify Premium
  console.log('Seek désactivé pour le moment');
}

// Toggle description
function toggleDescription(button) {
  const description = button.previousElementSibling;
  const isExpanded = description.classList.contains('expanded');

  description.classList.toggle('expanded');
  button.textContent = isExpanded ? 'Voir plus' : 'Voir moins';
}

// Toggle comments
function toggleComments(button) {
  const post = button.closest('.post');
  const comments = post.querySelector('.post-comments');
  if (!comments) return;

  const isVisible = comments.style.display !== 'none';

  comments.style.display = isVisible ? 'none' : 'block';
}

// Toggle like
function toggleLike(button) {
  button.classList.toggle('active');
  button.classList.toggle('liked');
  const count = button.querySelector('span');
  if (!count) return;

  const current = parseInt(count.textContent);
  count.textContent = button.classList.contains('active') ? current + 1 : current - 1;

  // Emoji change
  const emoji = button.classList.contains('active')
    ? (window.SHAKEMOI_EMOJIS?.liked || '♥')
    : (window.SHAKEMOI_EMOJIS?.like || '♡');
  button.innerHTML = `${emoji} <span>${count.textContent}</span>`;
}

// Re-shake
async function reShake(button) {
  const post = button.closest('.post');
  const postId = post.dataset.postId;

  // Animation
  button.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    button.style.transform = 'rotate(0deg)';
  }, 300);

  // API call
  try {
    const response = await fetch(`/api/posts/${postId}/reshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const count = button.querySelector('span');
      if (count) {
        count.textContent = parseInt(count.textContent) + 1;
      }
    }
  } catch (error) {
    console.error('ReShake error:', error);
  }
}

// Share post
function sharePost(postId) {
  const url = `${window.location.origin}/post/${postId}`;

  if (navigator.share) {
    navigator.share({
      title: 'SHAKEmoi',
      text: 'Regarde ce morceau !',
      url: url
    });
  } else {
    // Copier dans clipboard
    navigator.clipboard.writeText(url);
    alert('Lien copié !');
  }
}

// Report post
function reportPost(postId) {
  if (confirm('Signaler ce post ?')) {
    // API call
    fetch(`/api/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(() => {
      alert('Post signalé');
    });
  }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎵 SHAKEmoi interactions chargées');
  // Spotify Player désactivé pour le moment
});

// Export global
window.togglePostMenu = togglePostMenu;
window.openInSpotify = openInSpotify;
window.togglePlay = togglePlay;
window.seek = seek;
window.toggleDescription = toggleDescription;
window.toggleComments = toggleComments;
window.toggleLike = toggleLike;
window.reShake = reShake;
window.sharePost = sharePost;
window.reportPost = reportPost;
