// User preferences (localStorage)
const MUSIC_PREF_KEY = 'preferred_music_platform';

function getPreferredMusicPlatform() {
  try {
    const v = localStorage.getItem(MUSIC_PREF_KEY);
    return v || 'spotify';
  } catch (e) {
    return 'spotify';
  }
}

function setPreferredMusicPlatform(platform) {
  try {
    if (platform !== 'spotify' && platform !== 'apple') return;
    localStorage.setItem(MUSIC_PREF_KEY, platform);
    // Update UI toggles state if present
    document.querySelectorAll('.platform-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platform === platform);
    });
    // Visual tweak: add small color indicator
    document.querySelectorAll('.platform-toggle').forEach(btn => {
      if (btn.dataset.platform === 'spotify') {
        btn.style.background = platform === 'spotify' ? '#1DB954' : '';
        btn.style.color = platform === 'spotify' ? '#fff' : '';
      }
      if (btn.dataset.platform === 'apple') {
        btn.style.background = platform === 'apple' ? '#D459C8' : '';
        btn.style.color = platform === 'apple' ? '#fff' : '';
      }
    });
    // Update music buttons visuals if available
    if (window.updateMusicButtons) window.updateMusicButtons();
    return true;
  } catch (e) {
    return false;
  }
}

// Init settings menu toggles (bind listeners)
function initSettingsMenu() {
  // Ensure default
  if (!localStorage.getItem(MUSIC_PREF_KEY)) {
    setPreferredMusicPlatform('spotify');
  }

  // Set initial UI
  const current = getPreferredMusicPlatform();
  document.querySelectorAll('.platform-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.platform === current);
  });
  setPreferredMusicPlatform(current);

  // Bind clicks
  document.querySelectorAll('.platform-toggle').forEach(btn => {
    btn.removeEventListener('click', platformToggleHandler);
    btn.addEventListener('click', platformToggleHandler);
  });

  // Logout inside settings
  const settingsLogout = document.getElementById('settings-logout');
  if (settingsLogout) {
    settingsLogout.removeEventListener('click', settingsLogoutHandler);
    settingsLogout.addEventListener('click', settingsLogoutHandler);
  }
}

function platformToggleHandler(e) {
  const p = e.currentTarget.dataset.platform;
  if (!p) return;
  setPreferredMusicPlatform(p);
  // Close menu slightly after selection for UX
  setTimeout(() => {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.style.display = 'none';
  }, 180);
}

function settingsLogoutHandler() {
  // Use app's handleLogout if available
  if (typeof handleLogout === 'function') {
    handleLogout();
  } else {
    // fallback: trigger supabase signOut
    if (window.supabase && supabase.auth) {
      supabase.auth.signOut();
      window.location.href = 'index.html';
    }
  }
}

// Expose to global
window.getPreferredMusicPlatform = getPreferredMusicPlatform;
window.setPreferredMusicPlatform = setPreferredMusicPlatform;
window.initSettingsMenu = initSettingsMenu;
// ==================== USER PREFERENCES ====================
// Gestion des préférences utilisateur (localStorage)

const PREFERENCES_KEY = 'shakemoi_user_preferences';

// Valeurs par défaut
const DEFAULT_PREFERENCES = {
  musicPlatform: 'spotify' // 'spotify' | 'apple'
};

// Récupérer les préférences
function getUserPreferences() {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

// Sauvegarder les préférences
function saveUserPreferences(preferences) {
  try {
    const current = getUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return null;
  }
}

// Obtenir la plateforme musicale préférée
function getPreferredMusicPlatform() {
  const prefs = getUserPreferences();
  return prefs.musicPlatform || 'spotify';
}

// Définir la plateforme musicale préférée
function setPreferredMusicPlatform(platform) {
  if (platform !== 'spotify' && platform !== 'apple') {
    console.error('Invalid platform:', platform);
    return false;
  }
  return saveUserPreferences({ musicPlatform: platform });
}

// Exporter les fonctions
window.getUserPreferences = getUserPreferences;
window.saveUserPreferences = saveUserPreferences;
window.getPreferredMusicPlatform = getPreferredMusicPlatform;
window.setPreferredMusicPlatform = setPreferredMusicPlatform;
