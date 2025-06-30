// ===== UTILITIES SHAKEMOI =====

// Configuration globale
const SHAKEMOI_CONFIG = {
  APP_NAME: 'SHAKEMOI',
  VERSION: '1.0.0',
  API_BASE: 'https://api.shakemoi.fr',
  SPOTIFY_CLIENT_ID: 'c26941b671a940ef93bd386d6f4c8c82', 
  DEBUG: true
};

// Utilitaires de logging
const logger = {
  info: (message, data = null) => {
    if (SHAKEMOI_CONFIG.DEBUG) {
      console.log(`[SHAKEMOI] ${message}`, data || '');
    }
  },
  error: (message, error = null) => {
    console.error(`[SHAKEMOI ERROR] ${message}`, error || '');
  },
  warn: (message, data = null) => {
    console.warn(`[SHAKEMOI WARN] ${message}`, data || '');
  }
};

// Utilitaires DOM
const DOM = {
  // Sélecteur simplifié
  $: (selector) => document.querySelector(selector),
  $$: (selector) => document.querySelectorAll(selector),
  
  // Création d'éléments
  create: (tag, className = '', innerHTML = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  },
  
  // Gestion des classes
  addClass: (element, className) => {
    if (element) element.classList.add(className);
  },
  
  removeClass: (element, className) => {
    if (element) element.classList.remove(className);
  },
  
  toggleClass: (element, className) => {
    if (element) element.classList.toggle(className);
  },
  
  hasClass: (element, className) => {
    return element ? element.classList.contains(className) : false;
  }
};

// Utilitaires de formatage
const formatUtils = {
  // Formater le temps (ex: "2h", "5min")
  timeAgo: (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}j`;
  },
  
  // Formater la durée de musique (ex: "3:45")
  formatDuration: (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },
  
  // Tronquer le texte
  truncate: (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
};

// Utilitaires de stockage local
const storage = {
  // Sauvegarder des données
  set: (key, data) => {
    try {
      localStorage.setItem(`shakemoi_${key}`, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Erreur storage.set', error);
      return false;
    }
  },
  
  // Récupérer des données
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(`shakemoi_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      logger.error('Erreur storage.get', error);
      return defaultValue;
    }
  },
  
  // Supprimer des données
  remove: (key) => {
    try {
      localStorage.removeItem(`shakemoi_${key}`);
      return true;
    } catch (error) {
      logger.error('Erreur storage.remove', error);
      return false;
    }
  },
  
  // Vider tout le storage SHAKEMOI
  clear: () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('shakemoi_'))
        .forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      logger.error('Erreur storage.clear', error);
      return false;
    }
  }
};

// Utilitaires d'animation
const animations = {
  // Faire apparaître un élément
  fadeIn: (element, duration = 300) => {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    const start = performance.now();
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  },
  
  // Faire disparaître un élément
  fadeOut: (element, duration = 300) => {
    const start = performance.now();
    const startOpacity = parseFloat(window.getComputedStyle(element).opacity);
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = startOpacity * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.display = 'none';
      }
    };
    
    requestAnimationFrame(animate);
  },
  
  // Animation de slide up
  slideUp: (element, duration = 300) => {
    element.style.transform = 'translateY(100%)';
    element.style.display = 'block';
    
    const start = performance.now();
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      element.style.transform = `translateY(${100 * (1 - easeOut)}%)`;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
};

// Utilitaires de validation
const validation = {
  // Valider une URL
  isValidUrl: (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },
  
  // Valider un email
  isValidEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  // Vérifier si c'est un lien Spotify
  isSpotifyUrl: (url) => {
    return url.includes('spotify.com') || url.includes('open.spotify.com');
  },
  
  // Vérifier si c'est un lien Apple Music
  isAppleMusicUrl: (url) => {
    return url.includes('music.apple.com');
  }
};

// Gestionnaire d'événements simplifié
const events = {
  // Écouter un événement
  on: (element, event, callback) => {
    if (element && typeof callback === 'function') {
      element.addEventListener(event, callback);
    }
  },
  
  // Supprimer un écouteur
  off: (element, event, callback) => {
    if (element && typeof callback === 'function') {
      element.removeEventListener(event, callback);
    }
  },
  
  // Déclencher un événement personnalisé
  trigger: (element, eventName, data = {}) => {
    const event = new CustomEvent(eventName, { detail: data });
    element.dispatchEvent(event);
  }
};

// Utilitaires de performance
const performance = {
  // Debounce pour limiter les appels
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Throttle pour limiter la fréquence
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Détection des capacités du navigateur
const capabilities = {
  // Vérifier le support des notifications
  hasNotifications: () => {
    return 'Notification' in window;
  },
  
  // Vérifier le support du service worker
  hasServiceWorker: () => {
    return 'serviceWorker' in navigator;
  },
  
  // Vérifier si on est en mode standalone (PWA)
  isStandalone: () => {
    return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  },
  
  // Détecter le type d'appareil
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  
  // Détecter iOS
  isIOS: () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },
  
  // Détecter Android
  isAndroid: () => {
    return /Android/.test(navigator.userAgent);
  }
};

// Export pour utilisation dans d'autres modules
window.SHAKEMOI_UTILS = {
  CONFIG: SHAKEMOI_CONFIG,
  logger,
  DOM,
  formatUtils,
  storage,
  animations,
  validation,
  events,
  performance,
  capabilities
};

logger.info('Utilitaires SHAKEMOI chargés');