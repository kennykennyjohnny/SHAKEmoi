// SHAKEMOI - Extrait Deezer à adresse stable (M1).
// GET /api/preview?deezer=<id de titre Deezer>  (ou ?isrc=<ISRC>)
//   → redirection vers l'extrait MP3 de 30 s.
//
// Deezer signe ses adresses d'extrait et elles expirent au bout d'une heure :
// on ne peut donc pas les enregistrer en base. On enregistre CETTE adresse,
// qui va chercher un extrait frais à chaque lecture (cache CDN 15 min).
//
// Correctif 06/10 : un raté passager de Deezer (quota « code 4 », délai,
// réseau) n'est plus jamais mis en cache — avant, il était gardé 1 h sur le
// CDN sous forme de 404, et le son était muet pour tout le monde pendant 1 h.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = (q.get('deezer') || '').trim();
  const isrc = (q.get('isrc') || '').trim();

  let api: string | null = null;
  if (/^\d{1,15}$/.test(id)) api = `https://api.deezer.com/track/${id}`;
  else if (/^[A-Z0-9]{12}$/i.test(isrc)) api = `https://api.deezer.com/track/isrc:${isrc.toUpperCase()}`;
  if (!api) return new Response('paramètre invalide', { status: 400 });

  const t0 = Date.now();
  let why = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(350 + attempt * 400);
    try {
      const res = await fetch(api, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) { why = `HTTP ${res.status}`; continue; }
      const track = await res.json();
      if (track?.error?.code === 4) { why = 'quota'; continue; } // « Quota limit exceeded »
      if (track?.error || !track?.preview) {
        // Vraiment pas d'extrait (titre retiré, non lisible) : réponse courte en cache.
        console.log(`[preview] sans extrait · ${id || isrc} · ${track?.error ? `erreur ${track.error.code}` : 'preview vide'}`);
        return new Response('pas d\'extrait', { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: track.preview,
          'Access-Control-Allow-Origin': '*',
          // L'extrait signé vaut ~1 h : 15 min de cache CDN laissent de la marge.
          'Cache-Control': 'public, max-age=0, s-maxage=900',
        },
      });
    } catch (e: any) {
      why = e?.name === 'TimeoutError' ? 'délai' : 'réseau';
    }
  }
  console.log(`[preview] ÉCHEC Deezer · ${id || isrc} · ${why} · ${Date.now() - t0} ms`);
  return new Response('Deezer indisponible', { status: 503, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
}
