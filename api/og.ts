// SHAKEMOI - Image d'aperçu d'un lien (og:image / twitter:image).
// /api/og?type=song&id=<slug>&v=1 → JPEG 1200×630.
//
// Rendu en PNG par @vercel/og puis converti en JPEG : avec une pochette, le
// PNG dépasse 400 Ko, et WhatsApp ignore les images d'aperçu trop lourdes.

import { ImageResponse } from '@vercel/og';
import sharp from 'sharp';
import { paramsFromUrl, resolveLink } from './_lib/links.js';
import { HEIGHT, WIDTH, loadAssets, renderCard } from './_lib/card.js';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const [meta, { fonts, assets }] = await Promise.all([resolveLink(paramsFromUrl(url)), loadAssets()]);

  const png = await new ImageResponse(renderCard(meta.card, assets) as any, {
    width: WIDTH,
    height: HEIGHT,
    fonts,
    emoji: 'twemoji',
  }).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 84, mozjpeg: true }).toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Une journée en cache CDN : `v` dans l'URL sert à forcer un nouveau rendu.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
