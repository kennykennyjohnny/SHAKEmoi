// Navigation globale dans l'appli connectée : n'importe quel écran peut ouvrir
// un profil, une conversation, un cercle, un post ou un Shake éphémère, sans
// passer de fonctions de composant en composant. App écoute et ouvre (même
// chemin que les notifications push, D1).
export type OpenTarget = `${'post' | 'dm' | 'circle' | 'profile' | 'story' | 'notifications'}:${string}`;

export function openTarget(target: OpenTarget) {
  window.dispatchEvent(new CustomEvent('shakemoi:open', { detail: target }));
}

export const openProfile = (userId: string) => openTarget(`profile:${userId}`);
export const openConversation = (userId: string) => openTarget(`dm:${userId}`);
export const openCircle = (circleId: string) => openTarget(`circle:${circleId}`);
export const openPost = (postId: string) => openTarget(`post:${postId}`);

/** Feuilles globales de modération (P15 / P17), ouvertes depuis n'importe quel écran. */
export function openReport(kind: 'user' | 'post' | 'comment' | 'message' | 'circle_message' | 'story', id: string) {
  window.dispatchEvent(new CustomEvent('shakemoi:report', { detail: { kind, id } }));
}
export const openBugReport = () => window.dispatchEvent(new Event('shakemoi:bug'));
export const openBlockedUsers = () => window.dispatchEvent(new Event('shakemoi:blocked'));
export const openAdmin = () => window.dispatchEvent(new Event('shakemoi:admin'));
