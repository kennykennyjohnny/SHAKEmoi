import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SLOGANS } from '../../lib/brand';

/** Slogan qui alterne entre les deux accroches de la marque. */
export function Slogan({ className = '', interval = 3500 }: { className?: string; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % SLOGANS.length), interval);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <span className={`relative inline-grid ${className}`} aria-label={SLOGANS.join(' ')}>
      {/* Réserve la place du slogan le plus long : pas de saut de mise en page. */}
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {SLOGANS.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          aria-hidden
          className="col-start-1 row-start-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          {SLOGANS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
