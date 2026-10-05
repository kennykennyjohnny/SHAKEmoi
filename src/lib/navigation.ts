// SHAKEMOI - Bouton/geste « retour » du téléphone et adresse de chaque écran (N2).
//
// Chaque vue empilée (conversation, cercle, story, aperçu de profil…) enregistre
// ici un handler : le retour ferme la vue du dessus, puis ramène au fil, et ce
// n'est qu'ensuite qu'il peut réellement sortir.
//
// L'adresse affichée suit ce qui est à l'écran : l'onglet donne l'adresse de
// base (/top, /messages…), une vue empilée peut porter la sienne
// (/messages/<id>, /cercles/<id>, /u/<pseudo>…). Rafraîchir garde donc l'écran.
//
// Les onglets restent montés quand on en change (état et défilement gardés) :
// les vues ouvertes dans un onglet caché « dorment » (elles libèrent leur
// entrée d'historique) et se réveillent quand on revient sur l'onglet.

import { createContext, useContext, useEffect, useRef } from 'react';

interface Handler {
  id: number;
  fn: () => void;
  path?: string;
  order: number;
}

const handlers: Handler[] = [];
let counter = 0;
// Ordre des vues (création) : une vue enfant passe toujours après sa parente,
// même quand elles se réenregistrent ensemble (retour sur un onglet, R5).
let orderCounter = 0;
let poppingFromBrowser = false;
let initialized = false;
// Quand on ferme une vue depuis l'UI, on consomme nous-mêmes l'entrée
// d'historique : le popstate qui en découle ne doit PAS fermer la vue suivante
// (sinon fermer une conversation renvoyait aussi à l'accueil).
let ignoreNextPop = 0;
let basePath: string | null = null;

/** Remet l'adresse en accord avec l'écran (vue du dessus, sinon l'onglet). */
function syncUrl() {
  if (typeof window === 'undefined' || ignoreNextPop > 0) return; // un retour est en cours : après
  const top = [...handlers].reverse().find(h => h.path);
  const want = top?.path ?? basePath;
  if (!want) return;
  // Même chemin : on ne touche pas aux paramètres (?open=… le temps qu'ils servent).
  if (window.location.pathname !== want.split('?')[0]) {
    window.history.replaceState(window.history.state, '', want);
  }
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('popstate', () => {
    if (ignoreNextPop > 0) { ignoreNextPop--; syncUrl(); return; }
    const h = handlers.pop();
    if (h) {
      poppingFromBrowser = true;
      try { h.fn(); } finally { poppingFromBrowser = false; }
    }
    syncUrl();
  });
}

/** Adresse de l'onglet en cours (/, /top, /messages…). */
export function setBasePath(path: string) {
  init();
  basePath = path;
  syncUrl();
}

/** Onglet visible ? Les vues d'un onglet caché libèrent le retour (N2). */
export const TabActiveContext = createContext(true);

/**
 * Tant que `active` est vrai, le retour système appelle `onBack` au lieu de
 * quitter la page. Fermer la vue depuis l'UI retire proprement l'entrée.
 * `path` : adresse de la vue (ex. /messages/<id>), affichée tant qu'elle est ouverte.
 */
export function useBackHandler(active: boolean, onBack: () => void, path?: string) {
  const fnRef = useRef(onBack);
  fnRef.current = onBack;
  const pathRef = useRef(path);
  pathRef.current = path;
  const entry = useRef<Handler | null>(null);
  const order = useRef(0);
  if (!order.current) order.current = ++orderCounter;
  const tabActive = useContext(TabActiveContext);
  const on = active && tabActive;

  useEffect(() => {
    if (!on || typeof window === 'undefined') return;
    init();
    const h: Handler = { id: ++counter, fn: () => fnRef.current(), path: pathRef.current, order: order.current };
    entry.current = h;
    handlers.push(h);
    handlers.sort((a, b) => a.order - b.order);
    window.history.pushState({ shakemoi: h.id }, '', h.path ?? undefined);
    syncUrl(); // l'adresse est celle de la vue du dessus

    return () => {
      entry.current = null;
      const idx = handlers.findIndex(x => x.id === h.id);
      if (idx === -1) return;          // déjà consommé par le retour système
      handlers.splice(idx, 1);
      // Fermeture via l'UI : on consomme l'entrée d'historique correspondante,
      // en ignorant le popstate qu'elle provoque.
      if (!poppingFromBrowser) { ignoreNextPop++; window.history.back(); }
      else syncUrl();
    };
  }, [on]);

  // Vue déjà ouverte dont l'adresse change (ex. autre conversation) : on
  // remplace l'adresse sans toucher à l'historique.
  useEffect(() => {
    if (!entry.current || entry.current.path === path) return;
    entry.current.path = path;
    syncUrl();
  }, [path]);
}
