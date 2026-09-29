// Notifications de la cloche : textes (D2), réglages (D5) et notification
// sur le téléphone quand l'appli est ouverte (D4).

// La cloche = le social. Tout ce qui passe par les messages (message, son
// envoyé, like/réponse de story, message de cercle) n'y apparaît plus (A2) :
// seule la pastille Messages s'allume.
// Exception M10 : les likes de story vont aussi dans la cloche, groupés par story.
export const MESSAGE_LIKE_TYPES = ['message', 'song_share', 'story_comment', 'circle_post'];

export function notificationText(type: string): string {
  switch (type) {
    case 'like': return 'a aimé ton shake';
    case 'comment': return 'a commenté ton shake';
    case 'comment_like': return 'a aimé ton commentaire';
    case 'reshake': return 'a reshaké ton shake';
    case 'follow':
    case 'feel': return 's\'est abonné·e à toi';
    case 'circle_join': return 'a rejoint ton cercle';
    case 'circle_add': return 't\'a ajouté·e à un cercle';
    case 'circle_invite': return 't\'a invité·e dans un cercle';
    case 'message': return 't\'a envoyé un message';
    case 'song_share': return 't\'a envoyé un son';
    case 'story_like': return 'a aimé ta story';
    case 'story_comment': return 'a répondu à ton shake éphémère';
    default: return 'a interagi avec toi';
  }
}

// Réglages « Notifications » des paramètres (enregistrés sur l'appareil).
type Prefs = { likes: boolean; comments: boolean; reshakes: boolean; follows: boolean };
const PREF_OF_TYPE: Record<string, keyof Prefs> = {
  like: 'likes', comment_like: 'likes', story_like: 'likes',
  comment: 'comments',
  reshake: 'reshakes',
  follow: 'follows', feel: 'follows',
};

export function getNotifPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem('shakemoi_notif_prefs') || 'null');
    return { likes: true, comments: true, reshakes: true, follows: true, ...(saved || {}) };
  } catch {
    return { likes: true, comments: true, reshakes: true, follows: true };
  }
}

/** Faut-il montrer ce type de notification dans la cloche ? */
export function isNotifTypeShown(type: string, prefs = getNotifPrefs()): boolean {
  if (MESSAGE_LIKE_TYPES.includes(type)) return false;
  const pref = PREF_OF_TYPE[type];
  return pref ? prefs[pref] !== false : true;
}

/**
 * Notification sur le téléphone (appli ouverte). Chrome Android refuse
 * `new Notification()` : on passe par le service worker, qui marche partout.
 */
export async function showLocalNotification(body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (localStorage.getItem('shakemoi_push_enabled') !== 'true') return;
  const options: NotificationOptions = { body, icon: '/icon-192.png', badge: '/favicon-32.png', tag };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification('SHAKEmoi', options); return; }
  } catch { /* on essaie la méthode classique */ }
  try { new Notification('SHAKEmoi', options); } catch { /* navigateur qui refuse : tant pis */ }
}
