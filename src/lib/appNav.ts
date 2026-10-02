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

// Q2 : un post ouvert depuis une liste (TOP…) connaît la liste, pour passer au
// suivant / précédent dans le même ordre.
let pendingList: { id: string; list: string[] } | null = null;
export function openPostInList(postId: string, list: string[]) {
  pendingList = { id: postId, list };
  openPost(postId);
}
export function takePostList(postId: string): string[] | undefined {
  const l = pendingList && pendingList.id === postId ? pendingList.list : undefined;
  pendingList = null;
  return l;
}

/** Feuilles globales de modération (P15 / P17), ouvertes depuis n'importe quel écran. */
export function openReport(kind: 'user' | 'post' | 'comment' | 'message' | 'circle_message' | 'story', id: string) {
  window.dispatchEvent(new CustomEvent('shakemoi:report', { detail: { kind, id } }));
}
export const openBugReport = () => window.dispatchEvent(new Event('shakemoi:bug'));
export const openBlockedUsers = () => window.dispatchEvent(new Event('shakemoi:blocked'));
export const openAdmin = () => window.dispatchEvent(new Event('shakemoi:admin'));
