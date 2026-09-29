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

/** <img> qui sait afficher une photo privée. */
export function MediaImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src?: string | null }) {
  const url = useMediaUrl(src);
  if (!url) return createElement('div', { className: `${rest.className || ''} bg-violet-950/40 animate-pulse` });
  return createElement('img', { loading: 'lazy', decoding: 'async', ...rest, src: url });
}
