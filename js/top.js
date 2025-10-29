// Module Top 100 - Intégration Last.fm API

const LASTFM_API_KEY = '43448d565b80bc04d2d458c4c41b8e3c';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

class TopManager {
  constructor() {
    this.topTracks = [];
  }

  // Charger le Top 100 depuis Last.fm
  async loadTop100() {
    try {
      const response = await fetch(
        `${LASTFM_API_URL}?method=chart.gettoptracks&limit=100&api_key=${LASTFM_API_KEY}&format=json`
      );

      if (!response.ok) {
        throw new Error('Erreur API Last.fm');
      }

      const data = await response.json();

      if (!data.tracks || !data.tracks.track) {
        throw new Error('Format de réponse invalide');
      }

      this.topTracks = data.tracks.track.map((track, index) => ({
        rank: index + 1,
        name: track.name,
        artist: track.artist.name,
        image: this.getBestImage(track.image),
        mbid: track.mbid,
        url: track.url
      }));

      return this.topTracks;
    } catch (error) {
      console.error('Erreur chargement Top 100:', error);
      return [];
    }
  }

  // Obtenir la meilleure qualité d'image
  getBestImage(images) {
    if (!images || images.length === 0) {
      return 'https://via.placeholder.com/300x300?text=No+Cover';
    }

    // Préférer extralarge > large > medium > small
    const priorities = ['extralarge', 'large', 'medium', 'small'];

    for (const size of priorities) {
      const img = images.find(i => i.size === size);
      if (img && img['#text']) {
        return img['#text'];
      }
    }

    return images[0]['#text'] || 'https://via.placeholder.com/300x300?text=No+Cover';
  }

  // Shake (like) un track du Top 100 = créer un post
  async shakeTrack(track, userText = '') {
    try {
      const result = await feedManager.createPost(
        track.name,
        track.artist,
        track.image,
        userText || `J'adore ce morceau ! 🎵`
      );

      return result;
    } catch (error) {
      console.error('Erreur shake track:', error);
      return {
        success: false,
        error: 'Erreur lors du shake'
      };
    }
  }

  // Partager un track
  async shareTrack(track) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: track.name,
          text: `Écoute ${track.name} par ${track.artist} sur SHAKEMOI`,
          url: track.url
        });
        return { success: true };
      } else {
        // Fallback : copier dans le presse-papier
        await navigator.clipboard.writeText(track.url);
        return { success: true, message: 'Lien copié !' };
      }
    } catch (error) {
      console.error('Erreur partage:', error);
      return {
        success: false,
        error: 'Erreur lors du partage'
      };
    }
  }

  // Obtenir les tracks
  getTopTracks() {
    return this.topTracks;
  }
}

// Initialisation du top manager
window.topManager = new TopManager();
