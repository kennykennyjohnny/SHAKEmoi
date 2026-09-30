import { useEffect, useState } from 'react';
import { BRAND_PATHS } from '../../lib/brandIcons';
import { getMyStreamingApp, onMyStreamingAppChange, PLATFORM_LABELS, type PlatformKey } from '../../lib/platforms';

/** Appli d'écoute de la personne connectée (se met à jour si elle en change). */
export function useMyStreamingApp(): PlatformKey {
  const [app, setApp] = useState(getMyStreamingApp());
  useEffect(() => onMyStreamingAppChange(() => setApp(getMyStreamingApp())), []);
  return app;
}

/** Logo de MON appli d'écoute : icône des boutons « ouvrir dans mon appli ». */
export function MyAppLogo({ className = 'w-4 h-4' }: { className?: string }) {
  const app = useMyStreamingApp();
  return <span title={`Ouvrir dans ${PLATFORM_LABELS[app]}`} className="inline-flex"><Glyph platform={app} className={className} /></span>;
}

// SHAKEMOI - Logo officiel d'une appli d'écoute (O2). Un seul composant,
// utilisé partout où on choisit ou ouvre une plateforme.
//  - variant « tile »  : carré arrondi aux couleurs de la marque ;
//  - variant « glyph » : le logo seul, couleur du texte (dans un bouton coloré).

export const PLATFORM_STYLE: Record<PlatformKey, { bg: string; fg: string }> = {
  spotify: { bg: '#1ED760', fg: '#000000' },
  apple_music: { bg: 'linear-gradient(160deg, #FB5C74 0%, #FA233B 100%)', fg: '#FFFFFF' },
  deezer: { bg: '#A238FF', fg: '#FFFFFF' },
  youtube_music: { bg: '#FF0000', fg: '#FFFFFF' },
  soundcloud: { bg: 'linear-gradient(180deg, #FF7700 0%, #FF3300 100%)', fg: '#FFFFFF' },
  amazon_music: { bg: '#0F1B2E', fg: '#25D1DA' },
  tidal: { bg: '#000000', fg: '#FFFFFF' },
};

function Glyph({ platform, className }: { platform: PlatformKey; className?: string }) {
  if (platform === 'amazon_music') {
    // Amazon ne publie pas son logo en libre accès : mot « music » + sourire.
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <text x="12" y="12.5" textAnchor="middle" fontSize="7.2" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" fill="currentColor">music</text>
        <path d="M5 15.2c4.3 2.6 9.7 2.6 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17.2 13.9l2 1.2-1.3 1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={BRAND_PATHS[platform]} />
    </svg>
  );
}

const TILE_SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5' },
  lg: { box: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7' },
  xl: { box: 'w-16 h-16 rounded-[1.1rem]', icon: 'w-9 h-9' },
};

interface PlatformLogoProps {
  platform: PlatformKey;
  variant?: 'tile' | 'glyph';
  size?: keyof typeof TILE_SIZES;
  className?: string;
}

export function PlatformLogo({ platform, variant = 'tile', size = 'md', className = '' }: PlatformLogoProps) {
  if (variant === 'glyph') return <Glyph platform={platform} className={className || 'w-5 h-5'} />;
  const s = TILE_SIZES[size];
  const style = PLATFORM_STYLE[platform];
  return (
    <span
      className={`${s.box} inline-flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20 ${className}`}
      style={{ background: style.bg, color: style.fg }}
    >
      <Glyph platform={platform} className={s.icon} />
    </span>
  );
}
