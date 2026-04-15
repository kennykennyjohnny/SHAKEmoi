import { motion } from 'motion/react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  variant?: 1 | 2 | 3 | 4 | 5;
}

export function Logo({ size = 'md', animated = true, showText = true, variant = 1 }: LogoProps) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-lg' },
    md: { container: 'w-12 h-12', text: 'text-2xl' },
    lg: { container: 'w-20 h-20', text: 'text-4xl' }
  };

  const { container, text } = sizes[size];

  const logoVariants = {
    // Variant 1: Style Spotify - 3 ondes courbes
    1: (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad1)" />
        <motion.path
          d="M 25 60 Q 37.5 50, 50 60 T 75 60"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          animate={animated ? { d: ["M 25 60 Q 37.5 50, 50 60 T 75 60", "M 25 60 Q 37.5 52, 50 60 T 75 60", "M 25 60 Q 37.5 50, 50 60 T 75 60"] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M 25 48 Q 37.5 38, 50 48 T 75 48"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
          animate={animated ? { d: ["M 25 48 Q 37.5 38, 50 48 T 75 48", "M 25 48 Q 37.5 40, 50 48 T 75 48", "M 25 48 Q 37.5 38, 50 48 T 75 48"] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <motion.path
          d="M 25 36 Q 37.5 26, 50 36 T 75 36"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
          animate={animated ? { d: ["M 25 36 Q 37.5 26, 50 36 T 75 36", "M 25 36 Q 37.5 28, 50 36 T 75 36", "M 25 36 Q 37.5 26, 50 36 T 75 36"] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
      </svg>
    ),

    // Variant 2: Ondes centrées et symétriques (plus équilibré)
    2: (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad2)" />
        <motion.path
          d="M 30 55 Q 40 45, 50 55 Q 60 65, 70 55"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          animate={animated ? { 
            d: [
              "M 30 55 Q 40 45, 50 55 Q 60 65, 70 55",
              "M 30 55 Q 40 47, 50 55 Q 60 63, 70 55",
              "M 30 55 Q 40 45, 50 55 Q 60 65, 70 55"
            ] 
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M 30 42 Q 40 32, 50 42 Q 60 52, 70 42"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          animate={animated ? { 
            d: [
              "M 30 42 Q 40 32, 50 42 Q 60 52, 70 42",
              "M 30 42 Q 40 34, 50 42 Q 60 50, 70 42",
              "M 30 42 Q 40 32, 50 42 Q 60 52, 70 42"
            ] 
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
      </svg>
    ),

    // Variant 3: Ondes horizontales droites (plus moderne/minimal)
    3: (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad3)" />
        <motion.line
          x1="28"
          y1="40"
          x2="72"
          y2="40"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          animate={animated ? { x1: [28, 30, 28], x2: [72, 70, 72] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.line
          x1="28"
          y1="50"
          x2="72"
          y2="50"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          animate={animated ? { x1: [28, 26, 28], x2: [72, 74, 72] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <motion.line
          x1="28"
          y1="60"
          x2="72"
          y2="60"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          animate={animated ? { x1: [28, 30, 28], x2: [72, 70, 72] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
      </svg>
    ),

    // Variant 4: Style soundwave avec barres verticales
    4: (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad4)" />
        {[32, 40, 48, 56, 64, 68].map((x, i) => {
          const heights = [20, 32, 28, 36, 24, 18];
          const height = heights[i];
          return (
            <motion.rect
              key={i}
              x={x}
              y={50 - height / 2}
              width="4"
              height={height}
              rx="2"
              fill="white"
              animate={animated ? {
                height: [height, height + 8, height],
                y: [50 - height / 2, 50 - (height + 8) / 2, 50 - height / 2]
              } : {}}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1
              }}
            />
          );
        })}
      </svg>
    ),

    // Variant 5: Demi-cercles empilés (super moderne)
    5: (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad5)" />
        <motion.path
          d="M 30 50 Q 30 35, 50 35 Q 70 35, 70 50"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          animate={animated ? { 
            d: [
              "M 30 50 Q 30 35, 50 35 Q 70 35, 70 50",
              "M 30 50 Q 30 37, 50 37 Q 70 37, 70 50",
              "M 30 50 Q 30 35, 50 35 Q 70 35, 70 50"
            ] 
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M 35 50 Q 35 42, 50 42 Q 65 42, 65 50"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          animate={animated ? { 
            d: [
              "M 35 50 Q 35 42, 50 42 Q 65 42, 65 50",
              "M 35 50 Q 35 44, 50 44 Q 65 44, 65 50",
              "M 35 50 Q 35 42, 50 42 Q 65 42, 65 50"
            ] 
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <motion.line
          x1="40"
          y1="50"
          x2="60"
          y2="50"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.5"
          animate={animated ? { x1: [40, 42, 40], x2: [60, 58, 60] } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-3">
      {/* Logo Icon */}
      <motion.div
        className={`${container} relative flex items-center justify-center flex-shrink-0`}
      >
        {logoVariants[variant]}
      </motion.div>

      {/* Text logo with Maven Pro */}
      {showText && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${text} font-black tracking-tight bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent whitespace-nowrap`}
          style={{ fontFamily: "'Maven Pro', sans-serif" }}
        >
          Shakemoi
        </motion.span>
      )}
    </div>
  );
}