// SHAKEMOI - HTML des liens partagés (/s, /p, /u, /i, /c, /m).
// Renvoie l'index.html de l'app avec les métadonnées propres au lien : les
// robots d'aperçu lisent ces balises, les visiteurs chargent l'app normalement.

import { OG_VERSION, SITE_NAME, paramsFromUrl, resolveLink } from './_lib/links';
import { routePath } from '../src/lib/links';

export const config = { runtime: 'edge' };

const START = '<!-- link-meta:start -->';
const END = '<!-- link-meta:end -->';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const params = paramsFromUrl(url);

  const [meta, shell] = await Promise.all([
    resolveLink(params),
    fetch(`${origin}/index.html`).then(r => r.text()),
  ]);

  // URL publique du lien (celle d'avant le rewrite vers /api/page).
  const publicUrl = new URL(
    params.type === 'home' ? '/' : routePath({ type: params.type, id: params.id || '', by: params.by }),
    origin,
  );
  const q = new URLSearchParams({ type: params.type, v: OG_VERSION });
  if (params.id) q.set('id', params.id);
  if (params.by) q.set('by', params.by);
  const image = `${origin}/api/og?${q}`;

  const tags = [
    `<title>${esc(meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} | ${SITE_NAME}`)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${params.type === 'profile' ? 'profile' : params.type === 'song' || params.type === 'post' ? 'music.song' : 'website'}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(publicUrl.toString())}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(meta.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ');

  const start = shell.indexOf(START);
  const end = shell.indexOf(END);
  const html =
    start !== -1 && end > start
      ? `${shell.slice(0, start + START.length)}\n    ${tags}\n    ${shell.slice(end)}`
      : shell.replace('</head>', `    ${tags}\n  </head>`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Court en CDN : un titre/pochette corrigé se voit vite.
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
