// Photos privées (messages privés et cercles) : l'espace « circle-media » est
// privé. En base on garde l'adresse « publique » habituelle ; à l'affichage on
// la remplace par un lien signé valable 1 h (B5). Les autres images (GIF,
// pochettes, avatars) passent telles quelles.
import { createElement, useEffect, useState, type ImgHTMLAttributes } from 'react';
import { supabase } from './supabase';

const PRIVATE_BUCKET = 'circle-media';
const MARK = `/storage/v1/object/public/${PRIVATE_BUCKET}/`;
const TTL = 3600;

const cache = new Map<string, { url: string; exp: number }>();
const pending = new Map<string, Promise<string | null>>();

/** Chemin du fichier dans l'espace privé, ou null si l'image n'en vient pas. */
export function privateMediaPath(url?: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf(MARK);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + MARK.length).split('?')[0]);
}

export async function signMediaUrl(url?: string | null): Promise<string | null> {
  const path = privateMediaPath(url);
  if (!path) return url || null;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  if (pending.has(path)) return pending.get(path)!;
  const p = supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, TTL)
    .then(({ data }) => {
      const signed = data?.signedUrl || null;
      if (signed) cache.set(path, { url: signed, exp: Date.now() + (TTL - 120) * 1000 });
      return signed;
    })
    .catch(() => null)
    .finally(() => pending.delete(path));
  pending.set(path, p);
  return p;
}

/** Adresse affichable (signée si besoin) ; undefined le temps de la signer. */
export function useMediaUrl(url?: string | null): string | undefined {
  const isPrivate = !!privateMediaPath(url);
  const [signed, setSigned] = useState<string | undefined>(() => {
    if (!url) return undefined;
    if (!isPrivate) return url;
    const hit = cache.get(privateMediaPath(url)!);
    return hit && hit.exp > Date.now() ? hit.url : undefined;
  });
  useEffect(() => {
    if (!url) { setSigned(undefined); return; }
    if (!isPrivate) { setSigned(url); return; }
    let alive = true;
    signMediaUrl(url).then((s) => { if (alive) setSigned(s || undefined); });
    return () => { alive = false; };
  }, [url, isPrivate]);
  return signed;
}

// ==================== Images légères (I1, I2, I10, B11) ====================

const STORAGE_PUBLIC = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(avatars|shake-media|story-media)\//;
const SPOTIFY_640 = 'ab67616d0000b273';
const SPOTIFY_300 = 'ab67616d00001e02';

/**
 * Version légère d'une image pour l'affichage : photos de nos espaces publics
 * redimensionnées par /api/img (cache CDN), pochettes Spotify en 300 px au lieu
 * de 640. Le reste passe tel quel.
 */
export function thumb(url?: string | null, width = 256): string | undefined {
  if (!url) return undefined;
  if (url.includes(SPOTIFY_640) && width <= 320) return url.replace(SPOTIFY_640, SPOTIFY_300);
  if (import.meta.env.PROD && STORAGE_PUBLIC.test(url)) {
    return `/api/img?w=${width}&u=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Avatar (ou photo de cercle) en petit (P11) : toujours CARRÉ. Les anciennes
 * photos sont souvent verticales (captures d'écran) ; le rond n'en montrait que
 * le milieu (visage coupé). /api/img les recadre en carré sur la zone la plus
 * détaillée (le visage, en pratique). Les nouvelles photos sont déjà carrées
 * (outil de cadrage à l'envoi).
 */
export function avatarThumb(url?: string | null, width = 128): string | undefined {
  if (!url) return undefined;
  if (import.meta.env.PROD && STORAGE_PUBLIC.test(url)) {
    return `/api/img?w=${width}&sq=1&u=${encodeURIComponent(url)}`;
  }
  return thumb(url, width);
}

/** Avatar par défaut (initiale sur fond violet), généré sur place : aucun service extérieur ne voit le pseudo. */
export function defaultAvatar(name?: string | null): string {
  const letter = (String(name || '?').trim()[0] || '?').toUpperCase().replace(/[<>&"']/g, '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2A1852"/><text x="32" y="42" font-family="Manrope,Arial,sans-serif" font-size="28" font-weight="700" fill="#FFEFD5" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Compresse une photo dans le navigateur avant l'envoi : côté le plus long
 * limité à `maxSize` px, JPEG qualité ~0,8. Une photo de 10 Mo tombe à ~200 Ko.
 * Les GIF (animés) et les petites images passent telles quelles.
 */
export async function compressImage(file: File | Blob, maxSize = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) { bitmap.close?.(); return file; }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Extension de fichier adaptée au contenu compressé. */
export function extFor(blob: Blob, fallbackName = ''): string {
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/png') return 'png';
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'image/gif') return 'gif';
  return fallbackName.split('.').pop() || 'jpg';
}

/** <img> qui sait afficher une photo privée. */
export function MediaImg({ src, width = 1024, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'width'> & { src?: string | null; width?: number }) {
  const signed = useMediaUrl(src);
  // Photo publique : version redimensionnée ; photo privée : lien signé.
  const url = privateMediaPath(src) ? signed : thumb(src, width);
  if (!url) return createElement('div', { className: `${rest.className || ''} bg-violet-950/40 animate-pulse` });
  return createElement('img', { loading: 'lazy', decoding: 'async', ...rest, src: url });
}
