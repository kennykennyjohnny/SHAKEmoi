// 🎵 SPOTIFY WEB PLAYBACK SDK - SHAKEMOI
class SpotifyPlayer {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPremium = false;
  }

  async init(accessToken) {
    // Vérifier si Premium
    await this.checkPremiumStatus(accessToken);

    if (!this.isPremium) {
      console.warn('User not Premium - Web Playback disabled');
      return false;
    }

    return new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        this.player = new Spotify.Player({
          name: 'SHAKEmoi Player',
          getOAuthToken: cb => { cb(accessToken); },
          volume: 0.8
        });

        // Events listeners
        this.setupEventListeners();

        // Connect
        this.player.connect().then(success => {
          if (success) {
            console.log('✅ Spotify Player connected');
            resolve(true);
          } else {
            reject(new Error('Failed to connect'));
          }
        });
      };
    });
  }

  setupEventListeners() {
    // Ready
    this.player.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      this.deviceId = device_id;
      this.emit('player-ready', { deviceId: device_id });
    });

    // Player state changed
    this.player.addListener('player_state_changed', state => {
      if (!state) return;

      this.currentTrack = state.track_window.current_track;
      this.isPlaying = !state.paused;

      this.emit('track-changed', {
        track: this.currentTrack,
        isPlaying: this.isPlaying,
        position: state.position,
        duration: state.duration
      });
    });

    // Errors
    this.player.addListener('initialization_error', ({ message }) => {
      console.error('Init error:', message);
    });

    this.player.addListener('authentication_error', ({ message }) => {
      console.error('Auth error:', message);
    });
  }

  async checkPremiumStatus(accessToken) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      this.isPremium = data.product === 'premium';
      return this.isPremium;
    } catch (error) {
      console.error('Error checking premium:', error);
      return false;
    }
  }

  async play(spotifyUri) {
    if (!this.isPremium || !this.deviceId) {
      // Fallback : ouvrir dans Spotify
      window.open(spotifyUri, '_blank');
      return;
    }

    try {
      const accessToken = await this.getAccessToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [spotifyUri]
        })
      });
    } catch (error) {
      console.error('Play error:', error);
    }
  }

  togglePlay() {
    if (!this.player) return;
    this.player.togglePlay();
  }

  nextTrack() {
    if (!this.player) return;
    this.player.nextTrack();
  }

  previousTrack() {
    if (!this.player) return;
    this.player.previousTrack();
  }

  seek(positionMs) {
    if (!this.player) return;
    this.player.seek(positionMs);
  }

  // Event emitter simple
  emit(event, data) {
    const customEvent = new CustomEvent(event, { detail: data });
    document.dispatchEvent(customEvent);
  }

  async getAccessToken() {
    // Récupérer depuis Supabase/localStorage
    return localStorage.getItem('spotify_access_token');
  }
}

// Instance globale
window.spotifyPlayer = new SpotifyPlayer();
