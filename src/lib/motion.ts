// Q3 : UNE seule façon de bouger dans l'appli, calée sur la transition
// Messages ↔ Cercles (la référence) : même courbe, même durée partout.
// Uniquement transform / opacity (60 images/s), et « réduire les
// animations » du téléphone respecté.
import { useEffect, useRef, type RefObject } from 'react';

/** Courbe et durée de Messages ↔ Cercles (useSwipeTabs). */
export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const EASE_ARRAY = [0.2, 0.8, 0.2, 1] as const;
export const DURATION_MS = 280;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
/** Durée à utiliser (presque nulle si l'utilisateur a réduit les animations). */
export const duration = () => (prefersReducedMotion() ? 1 : DURATION_MS);
/** `transition` CSS standard de l'appli. */
export const transitionCss = (props = 'transform') =>
  props.split(',').map((p) => `${p.trim()} ${duration()}ms ${EASE}`).join(', ');
/** Même chose pour les composants `motion` (ouvertures / fermetures). */
export const tween = () => ({ type: 'tween' as const, ease: [...EASE_ARRAY] as [number, number, number, number], duration: duration() / 1000 });

/**
 * Glisser vers le bas pour fermer un panneau (aperçu de profil, post…),
 * comme les panneaux d'Instagram : le panneau suit le doigt, le fond
 * s'éclaircit ; au-delà d'un seuil (ou d'un geste rapide) il part vers le bas
 * et se ferme, sinon il revient en place.
 * - Ne gêne pas le défilement : ça ne démarre que si le contenu est déjà tout
 *   en haut (ou depuis une zone marquée `data-drag-handle`).
 * - Un geste surtout horizontal est laissé aux autres (posts suivants, Q2).
 * Le panneau est déplacé directement (pas de rendu React à chaque image).
 */
export function useDragToClose(opts: {
  panelRef: RefObject<HTMLElement>;
  scrollRef?: RefObject<HTMLElement>;
  backdropRef?: RefObject<HTMLElement>;
  enabled?: boolean;
  onClose: () => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    const panel = opts.panelRef.current;
    if (!panel || opts.enabled === false) return;
    let st: { x: number; y: number; t: number; can: boolean; lock: 'drag' | 'other' | null; dy: number } | null = null;
    const set = (dy: number, animate: boolean) => {
      const h = panel.offsetHeight || window.innerHeight;
      panel.style.transition = animate ? transitionCss('transform') : 'none';
      panel.style.transform = dy ? `translate3d(0, ${dy}px, 0)` : '';
      const bd = optsRef.current.backdropRef?.current;
      if (bd) {
        bd.style.transition = animate ? transitionCss('opacity') : 'none';
        bd.style.opacity = String(Math.max(0, 1 - (dy / h) * 1.1));
      }
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { st = null; return; }
      const t = e.touches[0];
      const sc = optsRef.current.scrollRef?.current;
      const handle = (e.target as Element | null)?.closest?.('[data-drag-handle]');
      const inScroller = sc && sc.contains(e.target as Node);
      st = { x: t.clientX, y: t.clientY, t: Date.now(), can: !!handle || !inScroller || (sc!.scrollTop <= 0), lock: null, dy: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      if (!st.lock) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        st.lock = st.can && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2 ? 'drag' : 'other';
      }
      if (st.lock !== 'drag') return;
      e.preventDefault(); // pas de défilement ni de « tirer pour actualiser » pendant le geste
      st.dy = Math.max(0, dy);
      set(st.dy, false);
    };
    const onEnd = (e: TouchEvent) => {
      const s = st;
      st = null;
      if (!s || s.lock !== 'drag') return;
      if (e.type === 'touchcancel') { set(0, true); return; }
      const h = panel.offsetHeight || window.innerHeight;
      const v = s.dy / Math.max(1, Date.now() - s.t); // px/ms
      if (s.dy > Math.min(160, h * 0.25) || (v > 0.6 && s.dy > 30)) {
        set(h, true);
        window.setTimeout(() => optsRef.current.onClose(), duration());
      } else {
        set(0, true);
      }
    };
    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', onEnd);
    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.removeEventListener('touchcancel', onEnd);
    };
  }, [opts.enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
