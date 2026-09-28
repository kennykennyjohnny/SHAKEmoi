// SHAKEMOI - Action d'un visiteur mise en attente de connexion.
// Ex. : sans compte, on tape « Suivre @x » → on propose de se connecter ou de
// créer son compte, puis l'abonnement se fait tout seul et on revient là où
// on était (la recherche en cours).

export type PendingAction =
  | { type: 'follow'; userId: string; username: string }
  | { type: 'shake' | 'send'; title: string };

const KEY = 'shakemoi_pending_action';

export function setPendingAction(action: PendingAction) {
  try { sessionStorage.setItem(KEY, JSON.stringify(action)); } catch { /* stockage indisponible */ }
}

/** Lit ET efface l'action en attente. */
export function takePendingAction(): PendingAction | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as PendingAction) : null;
  } catch {
    return null;
  }
}

/** Phrase affichée au-dessus de la connexion pour expliquer pourquoi. */
export function pendingActionReason(action: PendingAction): string {
  switch (action.type) {
    case 'follow': return `Crée ton compte ou connecte-toi pour suivre @${action.username}.`;
    case 'shake': return `Crée ton compte ou connecte-toi pour shaker « ${action.title} ».`;
    case 'send': return `Crée ton compte ou connecte-toi pour envoyer « ${action.title} » à un ami.`;
  }
}
