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
      .from('users_profile')
      .select('profile_album_cover_url, profile_album_id, profile_album_name, profile_album_artist, profile_color')
      .eq('id', user.id)
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
    const albums = await spotify.searchAlbums(query);

    if (albums.length === 0) {
      resultsContainer.innerHTML = '<div class="album-results-empty">Aucun album trouvé</div>';
      return;
    }

    const albumsHtml = albums.slice(0, 8).map(album => `
      <div class="album-result-item" data-album-id="${album.id}" data-album-name="${escapeHtml(album.name)}" data-album-artist="${escapeHtml(album.artist)}" data-album-cover="${album.cover}">
        <img src="${album.coverSmall || album.cover || 'https://via.placeholder.com/50'}"
             class="album-result-cover"
             alt="${escapeHtml(album.name)}">
        <div class="album-result-info">
          <div class="album-result-name">${escapeHtml(album.name)}</div>
          <div class="album-result-artist">${escapeHtml(album.artist)}</div>
        </div>
      </div>
    `).join('');

    resultsContainer.innerHTML = albumsHtml;

    // Ajouter les event listeners après l'insertion du HTML
    resultsContainer.querySelectorAll('.album-result-item').forEach(item => {
      item.addEventListener('click', () => {
        selectAlbum(
          item.dataset.albumId,
          item.dataset.albumName,
          item.dataset.albumArtist,
          item.dataset.albumCover
        );
      });
    });
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
    const isSelected = item.dataset.albumId === id;
    item.classList.toggle('selected', isSelected);
  });

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
      .from('users_profile')
      .update({
        profile_album_cover_url: profileCustomization.selectedAlbum?.cover || null,
        profile_album_id: profileCustomization.selectedAlbum?.id || null,
        profile_album_name: profileCustomization.selectedAlbum?.name || null,
        profile_album_artist: profileCustomization.selectedAlbum?.artist || null,
        profile_color: profileCustomization.selectedColor
      })
      .eq('id', user.id);

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
