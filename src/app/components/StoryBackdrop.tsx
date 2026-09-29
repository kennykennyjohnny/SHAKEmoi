import { useEffect, useState } from 'react';
import { getCoverPalette, storyBackgroundCss, type Palette } from '../../lib/storyTheme';

// SHAKEMOI - Fond d'une story (lecteur ET aperçu du composeur).
// « Auto » : dégradé aux couleurs de la pochette + pochette très floutée pour
// la matière, et un voile en bas pour que le texte reste lisible.

export function useCoverPalette(cover: string | null | undefined): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPalette(null);
    getCoverPalette(cover).then(p => { if (!cancelled) setPalette(p); });
    return () => { cancelled = true; };
  }, [cover]);
  return palette;
}

export function StoryBackdrop({ theme, cover }: { theme: string | null | undefined; cover: string | null | undefined }) {
  const palette = useCoverPalette(cover);
  const isAuto = !theme;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: storyBackgroundCss(theme, palette) }}>
      {cover && (
        <img loading="lazy"
          src={cover}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover scale-150 blur-3xl saturate-150 ${isAuto ? 'opacity-40' : 'opacity-15 mix-blend-overlay'}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/45" />
    </div>
  );
}
