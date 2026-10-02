import { useEffect, useRef, useState } from 'react';
import { Music2, Move } from 'lucide-react';
import { StoryBackdrop } from './StoryBackdrop';
import { drawStoryBackground, themeCss, type Palette, type StoryTheme } from '../../lib/storyTheme';

// SHAKEMOI - Aperçu d'une story pendant sa création, au format exact 9:16.
// La photo se déplace au doigt (ou à la souris) et se zoome au pincement
// (molette / curseur sur ordinateur). À la publication, composeStoryImage()
// dessine exactement cet aperçu (fond + photo) en 1080×1920.

/** Position de la photo, en fractions de la LARGEUR du cadre (indépendant de sa taille à l'écran). */
export interface PhotoTransform { x: number; y: number; s: number }

export const STORY_RATIO = 16 / 9;

/** Photo entière visible, centrée, avec un peu de fond autour. */
export function defaultTransform(iw: number, ih: number): PhotoTransform {
  const fitW = 0.88;
  const fitH = (0.8 * STORY_RATIO * iw) / ih; // largeur qui donne 80 % de la hauteur
  return { x: 0, y: -0.04, s: Math.min(fitW, fitH) };
}

const clampS = (s: number) => Math.min(4, Math.max(0.2, s));

interface PreviewProps {
  theme: StoryTheme;
  cover: string | null;
  track: { title: string; artist: string } | null;
  photo: string | null;
  text: string;
  transform: PhotoTransform;
  onTransform: (t: PhotoTransform) => void;
  onPhotoSize?: (iw: number, ih: number) => void;
}

export function StoryComposerPreview({ theme, cover, track, photo, text, transform, onTransform, onPhotoSize }: PreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(260);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ t: PhotoTransform; dist?: number; mid?: { x: number; y: number } } | null>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 260));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!photo) return;
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 2600);
    return () => clearTimeout(t);
  }, [photo]);

  const tRef = useRef(transform);
  tRef.current = transform;

  const gesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
    return { dist: undefined, mid: pts[0] };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!photo) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = { t: tRef.current, ...gesture() };
    setShowHint(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!photo || !pointers.current.has(e.pointerId) || !last.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture();
    const start = last.current;
    if (!g.mid || !start.mid) return;
    const dx = (g.mid.x - start.mid.x) / width;
    const dy = (g.mid.y - start.mid.y) / width;
    const s = g.dist && start.dist ? clampS(start.t.s * (g.dist / start.dist)) : start.t.s;
    onTransform({ x: start.t.x + dx, y: start.t.y + dy, s });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    // Nouveau point de départ pour le(s) doigt(s) restant(s).
    last.current = pointers.current.size ? { t: tRef.current, ...gesture() } : null;
  };

  // Molette (ordinateur) : zoom.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !photo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = tRef.current;
      onTransform({ ...t, s: clampS(t.s * (1 - e.deltaY * 0.0015)) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [photo, onTransform]);

  const k = width / 390; // même mise en page que le lecteur (390 px de large)

  return (
    <div
      ref={frameRef}
      className={`relative w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 select-none ${photo ? 'touch-none cursor-grab active:cursor-grabbing' : ''}`}
      style={{ aspectRatio: '9 / 16' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <StoryBackdrop theme={themeCss(theme)} cover={cover} />

      {photo ? (
        <>
          <img loading="lazy"
            src={photo}
            alt=""
            draggable={false}
            onLoad={e => onPhotoSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={{
              width: `${transform.s * 100}%`,
              transform: `translate(-50%, -50%) translate(${transform.x * width}px, ${transform.y * width}px)`,
              borderRadius: width * 0.045,
              boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
            }}
          />
          {/* Même voile que le lecteur, pour juger la lisibilité */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent via-60% to-black/60" />
        </>
      ) : track ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ padding: 20 * k }}>
          {cover && (
            <img loading="lazy" src={cover} alt="" className="aspect-square object-cover shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              style={{ width: '53%', borderRadius: 16 * k, marginBottom: 20 * k }} />
          )}
          <p className="font-bold text-white text-center leading-tight drop-shadow-lg" style={{ fontSize: 24 * k }}>{track.title}</p>
          <p className="text-white/70 text-center" style={{ fontSize: 14 * k, marginTop: 6 * k }}>{track.artist}</p>
        </div>
      ) : null}

      {/* Bas de la story : texte + sticker musique, comme dans le lecteur */}
      {(text || (photo && track)) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none" style={{ padding: `0 ${20 * k}px ${76 * k}px`, gap: 12 * k }}>
          {text && (
            <p className="w-full text-center text-white bg-black/40 backdrop-blur-sm" style={{ fontSize: 14 * k, padding: `${12 * k}px ${16 * k}px`, borderRadius: 16 * k }}>
              {text}
            </p>
          )}
          {photo && track && (
            <div className="w-full flex items-center bg-black/50 backdrop-blur-md border border-white/15" style={{ gap: 12 * k, padding: 8 * k, borderRadius: 16 * k }}>
              {cover
                ? <img loading="lazy" src={cover} alt="" className="object-cover flex-shrink-0" style={{ width: 56 * k, height: 56 * k, borderRadius: 12 * k }} />
                : <span className="flex-shrink-0 bg-gradient-to-br from-purple-600 to-pink-600" style={{ width: 56 * k, height: 56 * k, borderRadius: 12 * k }} />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate" style={{ fontSize: 14 * k }}>{track.title}</p>
                <p className="text-white/70 truncate" style={{ fontSize: 12 * k }}>{track.artist}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!photo && !track && !text && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 text-xs text-center px-6">
          <Music2 className="w-7 h-7" />
          Ajoute une photo, un son ou du texte : l'aperçu s'affiche ici.
        </div>
      )}

      {photo && showHint && (
        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-[11px] font-semibold">
            <Move className="w-3.5 h-3.5" /> Glisse pour placer · pince pour zoomer
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- Composition finale (1080×1920) ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Dessine la story telle qu'elle apparaît dans l'aperçu (fond + photo placée)
 * et renvoie un JPEG prêt à publier.
 */
export async function composeStoryImage(opts: {
  photo: string;
  theme: StoryTheme;
  palette: Palette | null;
  cover: string | null;
  transform: PhotoTransform;
}): Promise<Blob> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;

  drawStoryBackground(g, W, H, opts.theme, opts.palette);

  // Même matière que l'aperçu : la pochette très floutée par-dessus le dégradé.
  if (opts.cover && 'filter' in g) {
    try {
      const cover = await loadImage(opts.cover);
      g.save();
      g.globalAlpha = opts.theme.stops ? 0.15 : 0.4;
      g.globalCompositeOperation = opts.theme.stops ? 'overlay' : 'source-over';
      g.filter = 'blur(90px) saturate(1.5)';
      const size = Math.max(W, H) * 1.5;
      g.drawImage(cover, (W - size) / 2, (H - size) / 2, size, size);
      g.restore();
    } catch { /* pochette illisible : fond seul */ }
  }
  // Voile haut/bas du fond (comme StoryBackdrop).
  const veil = g.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(0,0,0,0.15)');
  veil.addColorStop(0.5, 'rgba(0,0,0,0)');
  veil.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = veil;
  g.fillRect(0, 0, W, H);

  // Photo, à la position et à l'échelle choisies.
  const img = await loadImage(opts.photo);
  const pw = opts.transform.s * W;
  const ph = (pw * img.naturalHeight) / img.naturalWidth;
  const px = W / 2 + opts.transform.x * W - pw / 2;
  const py = H / 2 + opts.transform.y * W - ph / 2;
  const r = W * 0.045;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 90;
  g.shadowOffsetY = 36;
  g.beginPath();
  g.roundRect(px, py, pw, ph, r);
  g.fillStyle = '#000';
  g.fill();
  g.restore();
  g.save();
  g.beginPath();
  g.roundRect(px, py, pw, ph, r);
  g.clip();
  g.drawImage(img, px, py, pw, ph);
  g.restore();

  // 0,82 : ~500-700 Ko au lieu de 1,4 Mo, sans différence visible sur un téléphone (N5).
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Composition impossible'))), 'image/jpeg', 0.82));
}
