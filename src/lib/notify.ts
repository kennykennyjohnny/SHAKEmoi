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
    case 'music_reaction': return 'a répondu en musique à ton shake';
    case 'reshake': return 'a reshaké ton shake';
    case 'follow':
    case 'feel': return 's\'est abonné·e à toi';
    case 'circle_join': return 'a rejoint ton cercle';
    case 'circle_add': return 't\'a ajouté·e à un cercle';
    case 'circle_invite': return 't\'a invité·e dans un cercle';
    case 'message': return 't\'a envoyé un message';
    case 'song_share': return 't\'a envoyé un son';
    case 'story_like': return 'a aimé ton Shake éphémère';
    case 'invite_joined': return 'a rejoint SHAKEmoi grâce à toi 🎉 Vous vous suivez';
    case 'story_comment': return 'a répondu à ton shake éphémère';
    default: return 'a interagi avec toi';
  }
}

// Réglages « Notifications » : enregistrés en base (user_settings, respectés
// par le serveur pour les notifs push) avec une copie sur l'appareil pour
// filtrer la cloche sans attendre le réseau.
export type NotifPrefs = { likes: boolean; comments: boolean; reshakes: boolean; follows: boolean; circles: boolean; messages: boolean; streak: boolean };
type Prefs = NotifPrefs;
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { likes: true, comments: true, reshakes: true, follows: true, circles: true, messages: true, streak: true };
const PREF_OF_TYPE: Record<string, keyof Prefs> = {
  like: 'likes', comment_like: 'likes', story_like: 'likes',
  comment: 'comments', music_reaction: 'comments',
  reshake: 'reshakes',
  follow: 'follows', feel: 'follows', invite_joined: 'follows',
  circle_join: 'circles', circle_add: 'circles', circle_invite: 'circles',
};
const PREFS_KEY = 'shakemoi_notif_prefs';

export function getNotifPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    return { ...DEFAULT_NOTIF_PREFS, ...(saved || {}) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

/** Relit les réglages en base (au démarrage) ; renvoie ceux à appliquer. */
export async function loadNotifPrefs(): Promise<Prefs> {
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getNotifPrefs();
    const { data } = await supabase.from('user_settings').select('notif_prefs').eq('user_id', session.user.id).maybeSingle();
    if (data?.notif_prefs) {
      const merged = { ...DEFAULT_NOTIF_PREFS, ...data.notif_prefs };
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      return merged;
    }
    // Premier passage : on envoie en base les réglages faits sur ce téléphone.
    const local = getNotifPrefs();
    await supabase.from('user_settings').upsert({ user_id: session.user.id, notif_prefs: local, updated_at: new Date().toISOString() });
    return local;
  } catch {
    return getNotifPrefs();
  }
}

export async function saveNotifPrefs(prefs: Prefs): Promise<boolean> {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* pas grave */ }
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { error } = await supabase.from('user_settings').upsert({ user_id: session.user.id, notif_prefs: prefs, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
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
  const options: NotificationOptions = { body, badge: '/badge-96.png', tag }; // Q10 : logo une seule fois
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification('SHAKEmoi', options); return; }
  } catch { /* on essaie la méthode classique */ }
  try { new Notification('SHAKEmoi', options); } catch { /* navigateur qui refuse : tant pis */ }
}
