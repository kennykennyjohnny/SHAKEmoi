import type { ReactElement } from 'react';
import { PLATFORM_LABELS, STREAMING_APPS, type PlatformKey } from '../../lib/platforms';
import { PlatformLogo } from './PlatformLogo';

// SHAKEMOI - Boutons « Écouter sur … » : logo officiel + couleur de chaque plateforme.

export interface PlatformButton {
  key: PlatformKey;
  label: string;
  color: string;
  logo: ReactElement;
}

const COLORS: Record<PlatformKey, string> = {
  spotify: 'from-green-500 to-green-600',
  apple_music: 'from-pink-500 to-rose-600',
  deezer: 'from-purple-500 to-purple-600',
  youtube_music: 'from-red-500 to-red-600',
  soundcloud: 'from-orange-500 to-orange-600',
  amazon_music: 'from-cyan-600 to-sky-700',
  tidal: 'from-neutral-800 to-black',
};

export const PLATFORM_BUTTONS: PlatformButton[] = STREAMING_APPS.map(key => ({
  key,
  label: PLATFORM_LABELS[key],
  color: COLORS[key],
  logo: <PlatformLogo platform={key} variant="glyph" className="w-5 h-5" />,
}));
