// 🎨 SHAKEMOI - PERSONNALISATION PROFIL

// État global pour la personnalisation
let profileCustomization = {
  selectedAlbum: null,
  selectedColor: '#F5D5E8' // Rose Tendre par défaut
};

// Ouvrir le modal de personnalisation
async function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  modal.classList.add('active');

  // Charger les données actuelles du profil
  await loadCurrentProfile();
}

// Charger les données actuelles du profil
async function loadCurrentProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_album_cover_url, profile_album_id, profile_album_name, profile_album_artist, profile_color')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      // Appliquer la pochette actuelle
      if (profile.profile_album_cover_url) {
        profileCustomization.selectedAlbum = {
          cover: profile.profile_album_cover_url,
          id: profile.profile_album_id,
          name: profile.profile_album_name,
          artist: profile.profile_album_artist
        };
        updatePreview();
      }

      // Appliquer la couleur actuelle
      if (profile.profile_color) {
        profileCustomization.selectedColor = profile.profile_color;

        // Sélectionner le bon bouton de couleur
        document.querySelectorAll('.color-option').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.color === profile.profile_color);
        });

        // Mettre à jour la prévisualisation
        document.getElementById('profile-pic-ring').style.borderColor = profile.profile_color;
      }
    }
  } catch (error) {
    console.error('Error loading current profile:', error);
  }
}

// Fermer le modal
document.getElementById('cancel-edit-profile')?.addEventListener('click', () => {
  document.getElementById('edit-profile-modal').classList.remove('active');
});

// Recherche d'albums Spotify
let albumSearchTimeout;
document.getElementById('album-search-input')?.addEventListener('input', (e) => {
  clearTimeout(albumSearchTimeout);
  const query = e.target.value.trim();

  if (query.length < 2) {
    document.getElementById('album-search-results').innerHTML = '';
    return;
  }

  albumSearchTimeout = setTimeout(async () => {
    await searchSpotifyAlbums(query);
  }, 500);
});

// Rechercher des albums sur Spotify
async function searchSpotifyAlbums(query) {
  const resultsContainer = document.getElementById('album-search-results');
  resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=8`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.albums.items.length === 0) {
      resultsContainer.innerHTML = '<div class="album-results-empty">Aucun album trouvé</div>';
      return;
    }

    const albumsHtml = data.albums.items.map(album => `
      <div class="album-result-item" onclick="selectAlbum('${album.id}', '${escapeHtml(album.name)}', '${escapeHtml(album.artists[0].name)}', '${album.images[0]?.url || ''}')">
        <img src="${album.images[2]?.url || album.images[0]?.url || 'https://via.placeholder.com/50'}"
             class="album-result-cover"
             alt="${escapeHtml(album.name)}">
        <div class="album-result-info">
          <div class="album-result-name">${escapeHtml(album.name)}</div>
          <div class="album-result-artist">${escapeHtml(album.artists[0].name)}</div>
        </div>
      </div>
    `).join('');

    resultsContainer.innerHTML = albumsHtml;
  } catch (error) {
    console.error('Error searching albums:', error);
    resultsContainer.innerHTML = '<div class="album-results-empty">Erreur de recherche</div>';
  }
}

// Sélectionner un album
function selectAlbum(id, name, artist, cover) {
  profileCustomization.selectedAlbum = { id, name, artist, cover };

  // Mettre à jour la sélection visuelle
  document.querySelectorAll('.album-result-item').forEach(item => {
    item.classList.remove('selected');
  });
  event.target.closest('.album-result-item').classList.add('selected');

  // Mettre à jour la prévisualisation
  updatePreview();
}

// Mettre à jour la prévisualisation
function updatePreview() {
  const previewImage = document.getElementById('preview-album-cover');
  const previewLabel = document.getElementById('preview-album-name');
  const defaultNote = document.querySelector('.default-note');

  if (profileCustomization.selectedAlbum) {
    previewImage.src = profileCustomization.selectedAlbum.cover;
    previewImage.style.display = 'block';
    if (defaultNote) defaultNote.style.display = 'none';
    previewLabel.textContent = `${profileCustomization.selectedAlbum.name} - ${profileCustomization.selectedAlbum.artist}`;
  } else {
    previewImage.style.display = 'none';
    if (defaultNote) defaultNote.style.display = 'flex';
    previewLabel.textContent = 'Choisis une pochette d\'album';
  }
}

// Sélecteur de couleurs
document.querySelectorAll('.color-option').forEach(button => {
  button.addEventListener('click', () => {
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('active'));

    // Ajouter la classe active au bouton cliqué
    button.classList.add('active');

    // Sauvegarder la couleur sélectionnée
    profileCustomization.selectedColor = button.dataset.color;

    // Mettre à jour la prévisualisation
    document.getElementById('profile-pic-ring').style.borderColor = profileCustomization.selectedColor;
  });
});

// Sauvegarder les modifications
document.getElementById('save-edit-profile')?.addEventListener('click', async () => {
  const saveBtn = document.getElementById('save-edit-profile');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Sauvegarde...';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Vous devez être connecté');
      return;
    }

    // Sauvegarder dans Supabase
    const { error } = await supabase
      .from('profiles')
      .update({
        profile_album_cover_url: profileCustomization.selectedAlbum?.cover || null,
        profile_album_id: profileCustomization.selectedAlbum?.id || null,
        profile_album_name: profileCustomization.selectedAlbum?.name || null,
        profile_album_artist: profileCustomization.selectedAlbum?.artist || null,
        profile_color: profileCustomization.selectedColor
      })
      .eq('user_id', user.id);

    if (error) throw error;

    // Fermer le modal
    document.getElementById('edit-profile-modal').classList.remove('active');

    // Recharger le profil pour afficher les changements
    if (window.loadUserProfile) {
      await window.loadUserProfile(user.id);
    }

    // Afficher un message de succès
    console.log('✅ Profil personnalisé avec succès !');

  } catch (error) {
    console.error('Error saving profile:', error);
    alert('Erreur lors de la sauvegarde');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Sauvegarder';
  }
});

// Helper pour échapper HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export des fonctions
window.openEditProfileModal = openEditProfileModal;
window.selectAlbum = selectAlbum;
