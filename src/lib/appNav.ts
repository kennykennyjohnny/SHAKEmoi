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
