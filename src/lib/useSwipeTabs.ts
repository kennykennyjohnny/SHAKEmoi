// Onglets qu'on change en glissant le doigt (P10 Messages/Cercles, P14 TOP),
// comme Instagram ou WhatsApp : les pages et l'indicateur suivent le doigt en
// direct. Gestes natifs, sans bibliothèque. Les bords de l'écran sont laissés
// au geste retour (iPhone / Android) et un geste surtout vertical fait défiler.
import { useRef, useState, type CSSProperties } from 'react';
import { transitionCss } from './motion';

const EDGE = 24;

export function useSwipeTabs<T extends string>(tabs: readonly T[], tab: T, setTab: (t: T) => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const st = useRef<{ x: number; y: number; lock: 'h' | 'v' | null } | null>(null);
  const idx = Math.max(0, tabs.indexOf(tab));

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled || e.touches.length > 1) { st.current = null; return; }
    const t = e.touches[0];
    st.current = t.clientX < EDGE || t.clientX > window.innerWidth - EDGE ? null : { x: t.clientX, y: t.clientY, lock: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = st.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      s.lock = Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v';
      if (s.lock === 'h') setDragging(true);
    }
    if (s.lock !== 'h') return;
    // Au bord (premier / dernier onglet) : ça résiste un peu.
    const atEdge = (idx === 0 && mx > 0) || (idx === tabs.length - 1 && mx < 0);
    setDx(atEdge ? mx * 0.25 : mx);
  };
  const onTouchEnd = () => {
    const s = st.current;
    st.current = null;
    if (!s || s.lock !== 'h') return;
    const w = ref.current?.offsetWidth || window.innerWidth;
    if (dx < -w * 0.22 && idx < tabs.length - 1) setTab(tabs[idx + 1]);
    else if (dx > w * 0.22 && idx > 0) setTab(tabs[idx - 1]);
    setDx(0);
    setDragging(false);
  };

  const width = ref.current?.offsetWidth || 1;
  /** Position de l'indicateur, de 0 (premier onglet) à n-1, qui suit le doigt. */
  const progress = Math.min(tabs.length - 1, Math.max(0, idx - dx / width));
  const trackStyle: CSSProperties = {
    transform: `translateX(calc(${-idx * 100}% + ${dx}px))`,
    transition: dragging ? 'none' : transitionCss('transform'),
    touchAction: 'pan-y',
  };
  const indicatorStyle: CSSProperties = {
    width: `${100 / tabs.length}%`,
    transform: `translateX(${progress * 100}%)`,
    transition: dragging ? 'none' : transitionCss('transform'),
  };
  return { ref, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd }, trackStyle, indicatorStyle, dragging };
}
