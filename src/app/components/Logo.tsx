import { motion } from 'motion/react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  variant?: 1 | 2 | 3 | 4 | 5;
}

export function Logo({ size = 'md', animated = true, showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-8', wordmark: 'h-6' },
    md: { icon: 'h-12', wordmark: 'h-8' },
    lg: { icon: 'h-20', wordmark: 'h-12' }
  };

  const { icon, wordmark } = sizes[size];

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={animated ? { opacity: 0, scale: 0.9 } : undefined}
      animate={animated ? { opacity: 1, scale: 1 } : undefined}
      transition={{ type: 'spring', duration: 0.5 }}
    >
      {showText ? (
        <img src="/shakemoi-logo.png" alt="SHAKEmoi" className={`${wordmark} object-contain`} draggable={false} />
      ) : (
        <img src="/shakemoi-favicon.png" alt="S" className={`${icon} object-contain`} draggable={false} />
      )}
    </motion.div>
  );
}