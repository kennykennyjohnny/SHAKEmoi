// SHAKEMOI - Extrait Deezer à adresse stable (M1).
// GET /api/preview?deezer=<id de titre Deezer>  (ou ?isrc=<ISRC>)
//   → redirection vers l'extrait MP3 de 30 s.
//
// Deezer signe ses adresses d'extrait et elles expirent au bout d'une heure :
// on ne peut donc pas les enregistrer en base. On enregistre CETTE adresse,
// qui va chercher un extrait frais à chaque lecture (cache CDN 15 min).

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = (q.get('deezer') || '').trim();
  const isrc = (q.get('isrc') || '').trim();

  let api: string | null = null;
  if (/^\d{1,15}$/.test(id)) api = `https://api.deezer.com/track/${id}`;
  else if (/^[A-Z0-9]{12}$/i.test(isrc)) api = `https://api.deezer.com/track/isrc:${isrc.toUpperCase()}`;
  if (!api) return new Response('paramètre invalide', { status: 400 });

  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(5000) });
    const track = res.ok ? await res.json() : null;
    const preview: string | null = track && !track.error ? track.preview || null : null;
    if (!preview) {
      return new Response('pas d\'extrait', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: preview,
        'Access-Control-Allow-Origin': '*',
        // L'extrait signé vaut ~1 h : 15 min de cache CDN laissent de la marge.
        'Cache-Control': 'public, max-age=0, s-maxage=900',
      },
    });
  } catch {
    return new Response('Deezer indisponible', { status: 502 });
  }
}
