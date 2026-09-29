// SHAKEMOI - Fonds des stories : un seul modèle pour l'affichage (CSS) et pour
// la composition d'une story photo (canvas), afin que l'aperçu soit fidèle.
//
// En base, stories.theme_color vaut :
//   - null            → « Auto » : dégradé tiré des couleurs de la pochette ;
//   - un dégradé CSS  → un des thèmes ci-dessous ;
//   - une couleur hex → ancien réglage (enrichi en dégradé à l'affichage).

export interface StoryTheme {
  id: string;
  label: string;
  /** Couleurs du dégradé (haut-gauche → bas-droite). Absent = Auto. */
  stops?: [string, string];
}

export const STORY_THEMES: StoryTheme[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'shake', label: 'Shake', stops: ['#7B2CBF', '#E91E80'] },
  { id: 'nuit', label: 'Nuit', stops: ['#2A1B4A', '#0A0614'] },
  { id: 'sunset', label: 'Sunset', stops: ['#FF5CAD', '#FFB800'] },
  { id: 'ocean', label: 'Océan', stops: ['#1E3A8A', '#7B2CBF'] },
  { id: 'aurora', label: 'Aurora', stops: ['#0F766E', '#4C1D95'] },
  { id: 'braise', label: 'Braise', stops: ['#7F1D1D', '#F97316'] },
  { id: 'noir', label: 'Noir', stops: ['#1A1A1A', '#000000'] },
];

export const STORY_ANGLE = 160;

export function themeCss(theme: StoryTheme): string | null {
  return theme.stops ? `linear-gradient(${STORY_ANGLE}deg, ${theme.stops[0]} 0%, ${theme.stops[1]} 100%)` : null;
}

/** Thème correspondant à une valeur stockée (null = Auto). */
export function themeFromStored(value: string | null | undefined): StoryTheme {
  if (!value) return STORY_THEMES[0];
  return STORY_THEMES.find(t => themeCss(t) === value) ?? { id: 'custom', label: 'Perso', stops: legacyStops(value) };
}

// ---------- Couleurs de la pochette ----------

export interface Palette { vivid: [number, number, number]; deep: [number, number, number] } // HSL

const paletteCache = new Map<string, Promise<Palette | null>>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

/**
 * Deux couleurs tirées de la pochette : la plus vive (accent) et une seconde
 * teinte distincte, assombrie (profondeur). null si l'image est illisible.
 */
export function getCoverPalette(url: string | null | undefined): Promise<Palette | null> {
  if (!url) return Promise.resolve(null);
  const hit = paletteCache.get(url);
  if (hit) return hit;
  const p = new Promise<Palette | null>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 24, 24);
        const data = g.getImageData(0, 0, 24, 24).data;
        // Histogramme par tranches de teinte, pondéré par la vivacité.
        const buckets = new Map<number, { w: number; h: number; s: number; l: number; n: number }>();
        let grayL = 0, grayN = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (s < 18 || l < 10 || l > 92) { grayL += l; grayN++; continue; }
          const k = Math.round(h / 24) % 15;
          const w = (s / 100) * (1 - Math.abs(l - 50) / 60);
          const b = buckets.get(k) ?? { w: 0, h: 0, s: 0, l: 0, n: 0 };
          b.w += w; b.h += h; b.s += s; b.l += l; b.n++;
          buckets.set(k, b);
        }
        const ranked = [...buckets.entries()].sort((a, b) => b[1].w - a[1].w);
        const avg = (b: { h: number; s: number; l: number; n: number }): [number, number, number] =>
          [b.h / b.n, b.s / b.n, b.l / b.n];
        let vivid: [number, number, number];
        let deep: [number, number, number];
        if (!ranked.length) {
          // Pochette noir & blanc : on reste dans la marque.
          vivid = [275, 60, 45];
          deep = [320, 55, Math.min(30, (grayL / Math.max(1, grayN)) * 0.4 + 8)];
        } else {
          vivid = avg(ranked[0][1]);
          // Seconde couleur seulement si elle compte vraiment dans la pochette ;
          // sinon une teinte voisine de la principale (camaïeu, toujours joli).
          const top = ranked[0][1].w;
          const other = ranked.find(([k, b]) =>
            b.w >= top * 0.45 && Math.min(Math.abs(k - ranked[0][0]), 15 - Math.abs(k - ranked[0][0])) >= 3);
          // Teinte voisine : chaudes → vers le magenta (coucher de soleil),
          // froides → vers le violet / sarcelle. Jamais de brun ni de kaki.
          const h = vivid[0];
          const shifted = h < 90 || h > 330 ? (h + 320) % 360 : (h + 40) % 360;
          deep = other ? avg(other[1]) : [shifted, vivid[1], vivid[2]];
        }
        // Couleurs franches : saturées et lumineuses (les tons chauds sombres
        // tournent au brun, on les éclaircit davantage).
        const warm = (x: number) => x >= 20 && x <= 70;
        vivid = [vivid[0], Math.max(72, Math.min(95, vivid[1] * 1.2)), Math.max(warm(vivid[0]) ? 56 : 50, Math.min(62, vivid[2]))];
        deep = [deep[0], Math.max(65, Math.min(92, deep[1] * 1.15)), Math.max(warm(deep[0]) ? 46 : 36, Math.min(48, deep[2]))];
        resolve({ vivid, deep });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  paletteCache.set(url, p);
  return p;
}

const hsl = ([h, s, l]: [number, number, number], a = 1) =>
  `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a})`;

const FALLBACK: Palette = { vivid: [280, 65, 48], deep: [325, 70, 22] };

/** Fond « Auto » en CSS : halos de la pochette sur une base sombre. */
export function autoBackgroundCss(p: Palette | null): string {
  const { vivid, deep } = p ?? FALLBACK;
  return [
    `radial-gradient(130% 75% at 10% 0%, ${hsl(vivid, 1)} 0%, ${hsl(vivid, 0)} 70%)`,
    `radial-gradient(120% 70% at 100% 85%, ${hsl(deep, 0.95)} 0%, ${hsl(deep, 0)} 70%)`,
    `linear-gradient(${STORY_ANGLE}deg, ${hsl([vivid[0], vivid[1], 38])} 0%, ${hsl([deep[0], deep[1], 22])} 60%, #0C0618 100%)`,
  ].join(', ');
}

// Anciennes couleurs unies : on en fait un dégradé vers une version sombre.
function legacyStops(hex: string): [string, string] {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return ['#2A1B4A', '#0A0614'];
  const n = parseInt(m[1], 16);
  const [h, s, l] = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return [hsl([h, Math.max(s, 45), Math.min(l + 12, 45)]), hsl([h, s, Math.max(l * 0.35, 5)])];
}

/** Fond CSS d'une story à partir de la valeur stockée et de sa palette. */
export function storyBackgroundCss(stored: string | null | undefined, palette: Palette | null): string {
  if (!stored) return autoBackgroundCss(palette);
  if (stored.includes('gradient')) return stored;
  const [a, b] = legacyStops(stored);
  return `linear-gradient(${STORY_ANGLE}deg, ${a} 0%, ${b} 100%)`;
}

// ---------- Même fond, dessiné sur canvas (story photo composée) ----------

function linearAt(g: CanvasRenderingContext2D, w: number, h: number, angle: number) {
  // Équivalent du linear-gradient CSS : ligne passant par le centre.
  const rad = ((angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const cx = w / 2, cy = h / 2;
  const dx = (Math.cos(rad) * len) / 2, dy = (Math.sin(rad) * len) / 2;
  return g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
}

export function drawStoryBackground(g: CanvasRenderingContext2D, w: number, h: number, theme: StoryTheme, palette: Palette | null) {
  if (theme.stops) {
    const lg = linearAt(g, w, h, STORY_ANGLE);
    lg.addColorStop(0, theme.stops[0]);
    lg.addColorStop(1, theme.stops[1]);
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    return;
  }
  const { vivid, deep } = palette ?? FALLBACK;
  const base = linearAt(g, w, h, STORY_ANGLE);
  base.addColorStop(0, hsl([vivid[0], vivid[1], 38]));
  base.addColorStop(0.6, hsl([deep[0], deep[1], 22]));
  base.addColorStop(1, '#0C0618');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const halo = (x: number, y: number, rx: number, ry: number, color: [number, number, number], stop: number) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, hsl(color, color === deep ? 0.95 : 1));
    rg.addColorStop(stop, hsl(color, 0));
    g.fillStyle = rg;
    g.fillRect(-x, -y / (ry / rx), w, h / (ry / rx));
    g.restore();
  };
  halo(w * 0.1, 0, w * 1.3, h * 0.75, vivid, 0.7);
  halo(w, h * 0.85, w * 1.2, h * 0.7, deep, 0.7);
}
