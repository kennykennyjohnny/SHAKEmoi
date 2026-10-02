// Cadrage d'une photo de profil ou de cercle (P11) : on place la photo dans un
// carré (glisser, pincer, molette ou curseur), et on enregistre l'image DÉJÀ
// recadrée (512 × 512). Les miniatures partout montrent donc exactement le
// cadrage choisi, plus jamais une partie qui était hors du cadre.
import { useEffect, useRef, useState } from 'react';
import { ensureDecodableImage } from '../../lib/media';
import { createPortal } from 'react-dom';
import { X, Check, ZoomIn, Move } from 'lucide-react';

interface Props {
  file: File;
  title?: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

const OUT = 512;

export function ImageCropDialog({ file, title = 'Cadre ta photo', onCancel, onDone }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [frame, setFrame] = useState(280);
  // Zoom (≥ 1 = la photo couvre le carré) et position du coin haut-gauche, en fractions du carré.
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist?: number; z: number; pos: { x: number; y: number } } | null>(null);

  useEffect(() => {
    let url = '';
    let alive = true;
    // N5 : photo HEIC (iPhone) convertie en JPEG si ce navigateur ne sait pas la lire.
    ensureDecodableImage(file).then((f) => {
      if (!alive) return;
      url = URL.createObjectURL(f);
      setSrc(url);
      return createImageBitmap(f, { imageOrientation: 'from-image' } as any).then((b) => { if (alive) setBitmap(b); });
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    setFrame(el.clientWidth || 280);
    const ro = new ResizeObserver(() => setFrame(el.clientWidth || 280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iw = bitmap?.width || 1;
  const ih = bitmap?.height || 1;
  const cover = Math.max(1 / iw, 1 / ih); // en « carrés par pixel »
  const w = iw * cover * z;               // taille affichée, en fractions du carré
  const h = ih * cover * z;
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.min(0, Math.max(1 - ww, p.x)),
    y: Math.min(0, Math.max(1 - hh, p.y)),
  });

  // Départ : centré, la photo couvre le carré.
  useEffect(() => {
    if (!bitmap) return;
    const ww = bitmap.width * Math.max(1 / bitmap.width, 1 / bitmap.height);
    const hh = bitmap.height * Math.max(1 / bitmap.width, 1 / bitmap.height);
    // Photo verticale : un peu vers le haut (là où sont les visages en général).
    setPos({ x: (1 - ww) / 2, y: hh > 1 ? (1 - hh) * 0.3 : (1 - hh) / 2 });
    setZ(1);
  }, [bitmap]);

  const zoomAround = (nz: number, cx = 0.5, cy = 0.5) => {
    nz = Math.min(5, Math.max(1, nz));
    const k = nz / z;
    const ww = iw * cover * nz;
    const hh = ih * cover * nz;
    setPos(clamp({ x: cx - (cx - pos.x) * k, y: cy - (cy - pos.y) * k }, ww, hh));
    setZ(nz);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { z, pos };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const dx = (e.clientX - prev.x) / frame;
      const dy = (e.clientY - prev.y) / frame;
      setPos((p) => clamp({ x: p.x + dx, y: p.y + dy }));
    } else if (pointers.current.size === 2 && gesture.current.dist) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = frameRef.current!.getBoundingClientRect();
      zoomAround(gesture.current.z * (dist / gesture.current.dist), ((a.x + b.x) / 2 - rect.left) / frame, ((a.y + b.y) / 2 - rect.top) / frame);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = pointers.current.size ? { z, pos } : null;
  };

  const confirm = async () => {
    if (!bitmap) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, pos.x * OUT, pos.y * OUT, w * OUT, h * OUT);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (blob) onDone(blob);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-label={title}>
      <div className="w-full max-w-sm bg-[#1D0F3D] rounded-2xl border border-purple-700/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-800/30">
          <button aria-label="Annuler" onClick={onCancel} className="p-1.5 rounded-full hover:bg-purple-900/40"><X className="w-5 h-5" /></button>
          <p className="flex-1 font-bold text-center">{title}</p>
          <button onClick={confirm} disabled={!bitmap} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-semibold flex items-center gap-1 disabled:opacity-40">
            <Check className="w-4 h-4" /> OK
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <p className="text-sm text-pink-200 text-center py-10">Cette photo ne peut pas être ouverte ici. Essaie une autre photo (JPEG ou PNG).</p>
          ) : (
            <div
              ref={frameRef}
              className="relative w-full aspect-square overflow-hidden rounded-xl bg-black touch-none select-none cursor-grab active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => zoomAround(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
            >
              {src && bitmap && (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none pointer-events-none"
                  style={{ left: pos.x * frame, top: pos.y * frame, width: w * frame, height: h * frame }}
                />
              )}
              {/* Le rond = ce qu'on verra dans les avatars ; le carré entier est enregistré. */}
              <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0)' }}>
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(10,6,20,0.55)' }} />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <ZoomIn className="w-4 h-4 text-purple-300" />
            <input type="range" min={1} max={5} step={0.01} value={z} onChange={(e) => zoomAround(parseFloat(e.target.value))} className="flex-1 accent-pink-500" aria-label="Zoom" />
          </div>
          <p className="mt-2 text-[11px] text-purple-300/70 flex items-center justify-center gap-1.5"><Move className="w-3.5 h-3.5" /> Glisse pour placer · pince ou curseur pour zoomer</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
