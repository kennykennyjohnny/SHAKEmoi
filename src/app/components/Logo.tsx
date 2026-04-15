import { motion } from 'motion/react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  variant?: 1 | 2 | 3 | 4 | 5;
}

export function Logo({ size = 'md', animated = true, showText = true }: LogoProps) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-lg', fontSize: 52 },
    md: { container: 'w-12 h-12', text: 'text-2xl', fontSize: 52 },
    lg: { container: 'w-20 h-20', text: 'text-4xl', fontSize: 52 }
  };

  const { container, text, fontSize } = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className={`${container} relative flex items-center justify-center flex-shrink-0`}
      >
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d946ef" />
              <stop offset="50%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#logoGrad)" />
          <motion.text
            x="50"
            y="54"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontWeight="900"
            fontSize={fontSize}
            fontFamily="'Maven Pro', sans-serif"
            letterSpacing="-2"
            animate={animated ? { rotate: [-8, -8] } : { rotate: -8 }}
            style={{ transformOrigin: '50px 54px' }}
          >
            S
          </motion.text>
        </svg>
      </motion.div>

      {showText && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${text} font-black tracking-tight bg-gradient-to-r from-fuchsia-500 to-pink-500 bg-clip-text text-transparent whitespace-nowrap`}
          style={{ fontFamily: "'Maven Pro', sans-serif" }}
        >
          SHAKEmoi
        </motion.span>
      )}
    </div>
  );
}