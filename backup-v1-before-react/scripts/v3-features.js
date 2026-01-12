// =====================================================
// SHAKEMOI V3 - NOUVELLES FONCTIONNALITÉS
// =====================================================

// =====================================================
// 1. COMPATIBILITÉ MUSICALE
// =====================================================

class MusicCompatibility {
  constructor() {
    this.edgeFunctionUrl = 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/calculate-compatibility';
  }

  async calculateCompatibility(userA, userB) {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ user_a: userA, user_b: userB })
      });

      if (!response.ok) {
        throw new Error('Failed to calculate compatibility');
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating compatibility:', error);
      return null;
    }
  }

  renderCompatibilityCard(score, commonArtists, commonGenres, message) {
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (score / 100) * circumference;

    return `
      <div class="compatibility-card fade-in">
        <div class="compatibility-circle">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="8"/>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#FF6B9D"
                    stroke-width="8" stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    style="transition: stroke-dashoffset 1s ease"/>
          </svg>
          <div class="score">${score}</div>
        </div>

        <div class="compatibility-details">
          <p class="label">${message}</p>
          <p class="desc">Vous avez <strong>${commonArtists} artistes</strong> en commun</p>
          <button class="see-common" onclick="musicCompatibility.showCommonTaste('${userA}', '${userB}')">
            Voir vos goûts communs
          </button>
        </div>
      </div>
    `;
  }

  async showCommonTaste(userA, userB) {
    // TODO: Implémenter la modal pour montrer les artistes en commun
    alert('Fonctionnalité à venir : voir les artistes en commun');
  }
}

const musicCompatibility = new MusicCompatibility();

// =====================================================
// 2. TIME CAPSULES
// =====================================================

class TimeCapsules {
  async createCapsule(title, description, unlockDate, isGroup = false, moodAtCreation = null) {
    try {
      const { data, error } = await supabase
        .from('time_capsules')
        .insert({
          creator_id: currentUser.id,
          title,
          description,
          unlock_date: unlockDate,
          is_group: isGroup,
          mood_at_creation: moodAtCreation
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, capsule: data };
    } catch (error) {
      console.error('Error creating capsule:', error);
      return { success: false, error: error.message };
    }
  }

  async addTrackToCapsule(capsuleId, track, personalNote = '') {
    try {
      const { data, error } = await supabase
        .from('time_capsule_tracks')
        .insert({
          capsule_id: capsuleId,
          track_id: track.id,
          track_name: track.name,
          artist_name: track.artist,
          album_cover: track.cover,
          preview_url: track.preview_url,
          added_by: currentUser.id,
          personal_note: personalNote
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error adding track to capsule:', error);
      return { success: false, error: error.message };
    }
  }

  async getMyCapsules() {
    try {
      const { data, error } = await supabase
        .from('time_capsules')
        .select(`
          *,
          tracks:time_capsule_tracks(count)
        `)
        .eq('creator_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching capsules:', error);
      return [];
    }
  }

  async getUnlockableCapsules() {
    try {
      const { data, error } = await supabase.rpc('get_unlockable_capsules');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching unlockable capsules:', error);
      return [];
    }
  }

  async openCapsule(capsuleId) {
    try {
      // Marquer comme ouvert
      const { error: updateError } = await supabase
        .from('time_capsules')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', capsuleId);

      if (updateError) throw updateError;

      // Récupérer les tracks
      const { data: tracks, error: tracksError } = await supabase
        .from('time_capsule_tracks')
        .select('*')
        .eq('capsule_id', capsuleId);

      if (tracksError) throw tracksError;

      return { success: true, tracks };
    } catch (error) {
      console.error('Error opening capsule:', error);
      return { success: false, error: error.message };
    }
  }

  renderLockedCapsule(capsule, tracksCount) {
    const now = new Date();
    const unlockDate = new Date(capsule.unlock_date);
    const diff = unlockDate - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const countdownText = days > 0
      ? `${days} jours ${hours}h ${minutes}min`
      : `${hours}h ${minutes}min`;

    const createdDate = new Date(capsule.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return `
      <div class="capsule-locked fade-in">
        <div class="capsule-icon">📦🔒</div>
        <h3>${capsule.title}</h3>
        <p class="unlock-countdown">
          S'ouvre dans <strong>${countdownText}</strong>
        </p>
        <p class="created-date">Créée le ${createdDate}</p>
        ${capsule.mood_at_creation ? `<div class="mood-badge">Mood : ${capsule.mood_at_creation}</div>` : ''}
        <p class="mystery">🎁 ${tracksCount} sons mystères à l'intérieur</p>
      </div>
    `;
  }
}

const timeCapsules = new TimeCapsules();

// =====================================================
// 3. SHAKE MOMENTS
// =====================================================

class ShakeMoments {
  async createShakeMoment(track, moodEmoji = null, isAuthentic = true) {
    try {
      const { data, error } = await supabase
        .from('shake_moments')
        .insert({
          user_id: currentUser.id,
          track_id: track.id,
          track_name: track.name,
          artist_name: track.artist,
          album_cover: track.cover,
          preview_url: track.preview_url,
          spotify_url: track.spotify_url,
          is_authentic: isAuthentic,
          mood_emoji: moodEmoji,
          notification_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Tu as déjà posté ton ShakeMoment aujourd\'hui !' };
        }
        throw error;
      }

      return { success: true, shakeMoment: data };
    } catch (error) {
      console.error('Error creating ShakeMoment:', error);
      return { success: false, error: error.message };
    }
  }

  async getTodayShakeMoments() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('shake_moments')
        .select(`
          *,
          user:users_profile(username, color)
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching ShakeMoments:', error);
      return [];
    }
  }

  async getMyShakeMoments() {
    try {
      const { data, error } = await supabase
        .from('shake_moments')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching my ShakeMoments:', error);
      return [];
    }
  }

  renderShakeMoment(shakeMoment) {
    const badge = shakeMoment.is_authentic
      ? '<span class="badge badge-shakemoment">🎲 ShakeMoment</span>'
      : '<span class="badge badge-late">⏰ Late</span>';

    const mood = shakeMoment.mood_emoji
      ? `<span class="badge badge-mood">${shakeMoment.mood_emoji}</span>`
      : '';

    return `
      <article class="post shake-moment fade-in" data-post-id="${shakeMoment.id}">
        <div class="post-header">
          <div class="user-note" style="background: ${shakeMoment.user.color}">♪</div>
          <div class="post-info">
            <span class="username">@${shakeMoment.user.username}</span>
            ${badge}
            ${mood}
          </div>
        </div>
        <div class="post-content">
          <div style="position: relative;">
            <img src="${shakeMoment.album_cover}" class="track-cover" alt="${shakeMoment.track_name}">
            ${shakeMoment.preview_url ? `
              <div class="play-overlay" onclick="playPreview('${shakeMoment.preview_url}', this)">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            ` : ''}
          </div>
          <div class="track-info">
            <h3 class="track-title">${shakeMoment.track_name}</h3>
            <p class="track-artist">${shakeMoment.artist_name}</p>
          </div>
        </div>
      </article>
    `;
  }
}

const shakeMoments = new ShakeMoments();

// =====================================================
// 4. STREAKS
// =====================================================

class StreakManager {
  async getCurrentStreak() {
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('current_streak, longest_streak, streak_shields, last_post_date')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching streak:', error);
      return { current_streak: 0, longest_streak: 0, streak_shields: 0 };
    }
  }

  async getStreakRewards() {
    try {
      const { data, error } = await supabase
        .from('streak_rewards')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('claimed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching streak rewards:', error);
      return [];
    }
  }

  renderStreakBadge(currentStreak, longestStreak, shields) {
    // Calculer les jours jusqu'au prochain shield (paliers: 7, 30, 100, 365)
    const milestones = [7, 30, 100, 365];
    const nextMilestone = milestones.find(m => m > currentStreak) || 365;
    const daysUntilNext = nextMilestone - currentStreak;
    const progress = ((currentStreak % nextMilestone) / nextMilestone) * 100;

    return `
      <div class="streak-badge fade-in">
        <div class="fire-icon">🔥</div>
        <div class="streak-info">
          <span class="current-streak">${currentStreak} jours</span>
          <span class="longest-streak">Record : ${longestStreak} jours</span>
        </div>
        <div class="shields">
          ${'🛡️'.repeat(shields)}
        </div>
      </div>
      <div class="streak-progress fade-in">
        <p>Prochain shield dans <strong>${daysUntilNext} jour${daysUntilNext > 1 ? 's' : ''}</strong></p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }
}

const streakManager = new StreakManager();

// =====================================================
// 5. TIMED COMMENTS
// =====================================================

class TimedComments {
  async addTimedComment(postId, text, timestamp) {
    try {
      // D'abord créer l'interaction
      const { data: interaction, error: interactionError } = await supabase
        .from('interactions')
        .insert({
          user_id: currentUser.id,
          post_id: postId,
          type: 'comment'
        })
        .select()
        .single();

      if (interactionError) throw interactionError;

      // Puis ajouter le commentaire avec le timestamp
      const { data, error } = await supabase
        .from('comments')
        .insert({
          interaction_id: interaction.id,
          text: text,
          timestamp_seconds: timestamp,
          is_timed: true
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, comment: data };
    } catch (error) {
      console.error('Error adding timed comment:', error);
      return { success: false, error: error.message };
    }
  }

  async getTimedComments(postId) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          interaction:interactions(user_id, users_profile(username, color))
        `)
        .eq('post_id', postId)
        .eq('is_timed', true)
        .order('timestamp_seconds', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching timed comments:', error);
      return [];
    }
  }

  renderTimeline(comments, duration = 30) {
    if (!comments || comments.length === 0) return '';

    const markers = comments.map(comment => {
      const position = (comment.timestamp_seconds / duration) * 100;
      const user = comment.interaction.users_profile;

      return `
        <div class="comment-marker" style="left: ${position}%" data-timestamp="${comment.timestamp_seconds}">
          <span class="marker-dot">💬</span>
          <div class="marker-preview">
            <div class="avatar" style="background: ${user.color}"></div>
            <span>@${user.username}: "${comment.text}"</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="timeline">
        <div class="progress-bar">
          <div class="progress-fill" id="audio-progress" style="width: 0%"></div>
        </div>
        ${markers}
      </div>
    `;
  }
}

const timedComments = new TimedComments();

// =====================================================
// 6. MOOD SELECTOR
// =====================================================

const moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😭', label: 'Sad' },
  { emoji: '⚡', label: 'Energetic' },
  { emoji: '😌', label: 'Chill' },
  { emoji: '🥰', label: 'In Love' },
  { emoji: '🌅', label: 'Nostalgic' }
];

function renderMoodSelector(onSelect) {
  const html = `
    <div class="mood-selector fade-in">
      <p>Comment te sens-tu ?</p>
      <div class="mood-grid">
        ${moods.map(mood => `
          <button class="mood-option" data-mood="${mood.label}" data-emoji="${mood.emoji}">
            <span class="emoji">${mood.emoji}</span>
            <span class="label">${mood.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Ajouter les event listeners après insertion
  setTimeout(() => {
    document.querySelectorAll('.mood-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (onSelect) {
          onSelect(btn.dataset.emoji, btn.dataset.mood);
        }
      });
    });
  }, 100);

  return html;
}

// =====================================================
// 7. LECTEUR AUDIO AMÉLIORÉ
// =====================================================

let currentAudioV3 = null;
let currentCoverElement = null;

function playPreviewV3(previewUrl, coverElement) {
  // Si on clique sur le même élément, toggle
  if (currentAudioV3 && currentCoverElement === coverElement) {
    if (currentAudioV3.paused) {
      currentAudioV3.play();
      coverElement.classList.add('playing');
    } else {
      currentAudioV3.pause();
      coverElement.classList.remove('playing');
    }
    return;
  }

  // Arrêter l'audio précédent
  if (currentAudioV3) {
    currentAudioV3.pause();
    if (currentCoverElement) {
      currentCoverElement.classList.remove('playing');
    }
  }

  // Créer et jouer le nouveau son
  currentAudioV3 = new Audio(previewUrl);
  currentCoverElement = coverElement;

  currentAudioV3.play().then(() => {
    coverElement.classList.add('playing');
  }).catch(error => {
    console.error('Error playing audio:', error);
  });

  // Quand le son se termine
  currentAudioV3.onended = () => {
    coverElement.classList.remove('playing');
  };

  // Mettre à jour la progress bar si elle existe (pour timed comments)
  currentAudioV3.ontimeupdate = () => {
    const progressBar = document.getElementById('audio-progress');
    if (progressBar) {
      const progress = (currentAudioV3.currentTime / currentAudioV3.duration) * 100;
      progressBar.style.width = `${progress}%`;
    }

    // Afficher les commentaires au bon moment
    const currentTime = Math.floor(currentAudioV3.currentTime);
    const commentsAtTime = document.querySelectorAll(`[data-timestamp="${currentTime}"]`);
    commentsAtTime.forEach(marker => {
      marker.classList.add('pulse-animation');
      setTimeout(() => marker.classList.remove('pulse-animation'), 500);
    });
  };
}

console.log('🎵 SHAKEMOI V3 Features initialized!');
