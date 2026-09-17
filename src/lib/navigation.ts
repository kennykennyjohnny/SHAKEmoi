// SHAKEMOI - Bouton/geste "retour" du téléphone.
// Sans ça, un retour depuis une conversation ou une story quitte carrément le
// site. Chaque vue empilée (conversation, cercle, story…) enregistre ici un
// handler : le retour ferme la vue courante, puis ramène au feed, et ce n'est
// qu'ensuite qu'il peut réellement sortir.

import { useEffect, useRef } from 'react';

interface Handler {
  id: number;
  fn: () => void;
}

const handlers: Handler[] = [];
let counter = 0;
let poppingFromBrowser = false;
let initialized = false;
// Quand on ferme une vue depuis l'UI, on consomme nous-mêmes l'entrée
// d'historique : le popstate qui en découle ne doit PAS fermer la vue suivante
// (sinon fermer une conversation renvoyait aussi à l'accueil).
let ignoreNextPop = 0;

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('popstate', () => {
    if (ignoreNextPop > 0) { ignoreNextPop--; return; }
    const h = handlers.pop();
    if (!h) return;                    // plus rien à fermer : on laisse sortir
    poppingFromBrowser = true;
    try { h.fn(); } finally { poppingFromBrowser = false; }
  });
}

/**
 * Tant que `active` est vrai, le retour système appelle `onBack` au lieu de
 * quitter la page. Fermer la vue depuis l'UI retire proprement l'entrée.
 */
export function useBackHandler(active: boolean, onBack: () => void) {
  const fnRef = useRef(onBack);
  fnRef.current = onBack;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    init();
    const id = ++counter;
    handlers.push({ id, fn: () => fnRef.current() });
    window.history.pushState({ shakemoi: id }, '');

    return () => {
      const idx = handlers.findIndex(h => h.id === id);
      if (idx === -1) return;          // déjà consommé par le retour système
      handlers.splice(idx, 1);
      // Fermeture via l'UI : on consomme l'entrée d'historique correspondante,
      // en ignorant le popstate qu'elle provoque.
      if (!poppingFromBrowser) { ignoreNextPop++; window.history.back(); }
    };
  }, [active]);
}
