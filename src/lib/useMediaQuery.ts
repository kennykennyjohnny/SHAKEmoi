import { useEffect, useState } from 'react';

/** Vrai quand l'écran correspond à la requête (se met à jour en direct). */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Écran tactile (téléphone, tablette). Sert à ne pas ouvrir le clavier tout
 *  seul : sur téléphone, un champ ne prend le focus que si on le touche. */
export const IS_TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
