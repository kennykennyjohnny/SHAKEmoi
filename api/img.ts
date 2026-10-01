// SHAKEMOI - Image redimensionnée à la volée (I1).
// /api/img?u=<adresse d'origine>&w=256 → WebP de 256 px de large, mis en cache
// un an par le CDN de Vercel (chaque image n'est calculée qu'une fois).
//
// Les photos de profil ont été envoyées sans compression (jusqu'à 10 Mo) et
// s'affichent en 28 à 96 px : on sert une version de quelques Ko à la place.
// Seules nos images sont acceptées (pas de relais ouvert).

import sharp from 'sharp';

const ALLOWED = [
  /^https:\/\/vbjmhtwrfboqziwibsut\.supabase\.co\/storage\/v1\/object\/public\/(avatars|shake-media|story-media)\//,
  /^https:\/\/i\.scdn\.co\/image\//,
];
const WIDTHS = [64, 128, 256, 512, 1024];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const src = url.searchParams.get('u') || '';
  const asked = parseInt(url.searchParams.get('w') || '256', 10) || 256;
  const width = WIDTHS.find((w) => w >= asked) ?? WIDTHS[WIDTHS.length - 1];

  if (!ALLOWED.some((r) => r.test(src))) {
    return new Response('image non autorisée', { status: 400 });
  }

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.redirect(src, 302);
    const input = Buffer.from(await res.arrayBuffer());
    // sq=1 (avatars, P11) : carré recadré sur la zone la plus détaillée
    // (« entropy » : garde le visage, testé sur les vrais avatars), au lieu du
    // milieu d'une photo verticale qui coupait les visages.
    const square = url.searchParams.get('sq') === '1';
    const out = await sharp(input, { failOn: 'none' })
      .rotate() // respecte l'orientation des photos de téléphone
      .resize(square
        ? { width, height: width, fit: 'cover', position: sharp.strategy.entropy }
        : { width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch {
    // En cas de souci, l'image d'origine plutôt qu'une image cassée.
    return Response.redirect(src, 302);
  }
}
