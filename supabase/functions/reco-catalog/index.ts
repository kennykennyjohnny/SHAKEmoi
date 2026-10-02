// SHAKEMOI — catalogue de Découvrir (Q8). SEULE fonction qui parle aux API
// musicales extérieures pour les recommandations ; jamais pendant qu'on ouvre
// l'onglet (tâche planifiée). Voir docs/reco.md.
//
// À chaque passage (toutes les 20 min, quelques artistes à la fois) :
//   1. artistes de départ = les artistes forts des profils de goût + ceux
//      choisis au tuto (Q9), du plus ancien rafraîchi au plus récent (cache 30 j) ;
//      pour chacun : Deezer artistes proches (avec leur rang), titres phares de
//      l'artiste et de ses 6 premiers proches ;
//   2. une fois par jour : classements Deezer par famille de genres et
//      nouveautés (sorties récentes) ;
//   3. avec une clé Last.fm (LASTFM_API_KEY) : titres similaires à mes sons forts.
// Débit limité à ~8 requêtes / s (Deezer accepte 50 / 5 s).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const LASTFM = Deno.env.get('LASTFM_API_KEY') || '';
const PREVIEW = (id: number | string) => `https://www.shakemoi.fr/api/preview?deezer=${id}`;

// Familles (genre_family en base) → genres Deezer.
const FAMILY_GENRE: Record<string, number> = {
  'Rap': 116, 'Pop': 132, 'R&B / Soul': 165, 'Électro': 106, 'Rock / Indé': 152, 'Reggae / Dancehall': 144,
  'Latin': 197, 'Afro': 2, 'Jazz / Funk': 129, 'Chanson / Variété': 52, 'Classique / BO': 98, 'Folk / Country': 84,
};

let last = 0;
async function dz(path: string): Promise<any> {
  const wait = last + 125 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const r = await fetch(`https://api.deezer.com${path}`).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  if (j?.error) return null;
  return j;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

type Row = { title: string; artist: string; deezer_id: number; cover_url: string | null; preview_url: string; deezer_rank: number | null; release_date?: string | null; source: string; score: number };
const rowFrom = (t: any, source: string, score: number, release?: string | null): Row | null =>
  t?.id && t?.title && t?.artist?.name ? {
    title: t.title, artist: t.artist.name, deezer_id: t.id, cover_url: t.album?.cover_medium || null,
    preview_url: PREVIEW(t.id), deezer_rank: t.rank ?? null, release_date: release ?? null, source, score: Math.round(score * 100) / 100,
  } : null;

async function save(rows: Row[]) {
  if (!rows.length) return 0;
  const { data, error } = await db.rpc('catalog_upsert', { p_rows: rows });
  if (error) console.error('catalog_upsert', error.message);
  return (data as number) || 0;
}

async function deezerIdFor(akey: string, name: string, known: string | null): Promise<string | null> {
  if (known) return known;
  const s = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=5`);
  const a = (s?.data || []).find((x: any) => norm(x.name) === norm(name)) || s?.data?.[0];
  if (!a) return null;
  await db.from('artist_profiles').update({ deezer_id: String(a.id), picture_url: a.picture_medium || null, fans: a.nb_fan ?? null }).eq('artist_key', akey);
  return String(a.id);
}

async function refreshSeed(seed: { artist_key: string; name: string; deezer_id: string | null }, deadline: number) {
  const id = await deezerIdFor(seed.artist_key, seed.name, seed.deezer_id);
  if (!id) { await db.from('artist_profiles').update({ catalog_at: new Date().toISOString() }).eq('artist_key', seed.artist_key); return 0; }
  const rows: Row[] = [];
  const [top, rel] = [await dz(`/artist/${id}/top?limit=8`), await dz(`/artist/${id}/related?limit=10`)];
  (top?.data || []).forEach((t: any, i: number) => { const r = rowFrom(t, `top:${seed.artist_key}`, 1 - i * 0.08); if (r) rows.push(r); });
  const related = (rel?.data || []).map((a: any, i: number) => ({ key: norm(a.name), name: a.name, id: String(a.id), rank: i + 1, picture: a.picture_medium || null }));
  await db.from('artist_profiles').update({
    related_ranked: related, catalog_at: new Date().toISOString(),
    ...(related.length ? { related: related.map((r: any) => r.name.toLowerCase()) } : {}),
  }).eq('artist_key', seed.artist_key);
  for (const ra of related.slice(0, 6)) {
    if (Date.now() > deadline) break;
    const tt = await dz(`/artist/${ra.id}/top?limit=4`);
    (tt?.data || []).forEach((t: any, i: number) => {
      const r = rowFrom(t, `rel:${seed.artist_key}`, (1 - (ra.rank - 1) / 10) * (1 - i * 0.1));
      if (r) rows.push(r);
    });
  }
  return save(rows);
}

async function refreshCharts(deadline: number) {
  let n = 0;
  for (const [fam, gid] of Object.entries(FAMILY_GENRE)) {
    if (Date.now() > deadline) break;
    const rows: Row[] = [];
    const chart = await dz(`/chart/${gid}/tracks?limit=30`);
    (chart?.data || []).forEach((t: any, i: number) => { const r = rowFrom(t, `chart:${fam}`, 1 - i / 40); if (r) rows.push(r); });
    // Nouveautés : sorties récentes du genre (1er titre de chaque album).
    const rel = await dz(`/editorial/${gid}/releases?limit=6`);
    for (const alb of rel?.data || []) {
      if (Date.now() > deadline) break;
      const tr = await dz(`/album/${alb.id}/tracks?limit=1`);
      const t = tr?.data?.[0];
      if (t) { t.album = { cover_medium: alb.cover_medium }; const r = rowFrom(t, `fresh:${fam}`, 0.8, alb.release_date || null); if (r) rows.push(r); }
    }
    n += await save(rows);
  }
  await db.rpc('catalog_mark', { p_key: 'charts' });
  return n;
}

async function refreshLastfm(deadline: number) {
  if (!LASTFM) return 0;
  const { data: seeds } = await db.rpc('reco_track_seeds', { p_limit: 12 });
  let n = 0;
  for (const s of seeds || []) {
    if (Date.now() > deadline) break;
    const u = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(s.artist)}&track=${encodeURIComponent(s.track_name)}&limit=8&autocorrect=1&api_key=${LASTFM}&format=json`;
    const j = await fetch(u).then((r) => r.json()).catch(() => null);
    const rows: Row[] = [];
    for (const t of j?.similartracks?.track || []) {
      if (Date.now() > deadline) break;
      const q = await dz(`/search/track?q=${encodeURIComponent(`artist:"${t.artist?.name}" track:"${t.name}"`)}&limit=1`);
      const r = rowFrom(q?.data?.[0], `lfm:${s.skey}`, Number(t.match) || 0.5);
      if (r) rows.push(r);
    }
    n += await save(rows);
  }
  return n;
}

Deno.serve(async (req) => {
  try {
    const { data: cfg } = await db.rpc('push_internal_config');
    if (!cfg?.hook_secret || req.headers.get('x-push-secret') !== cfg.hook_secret) return new Response('forbidden', { status: 403 });
    const body = await req.json().catch(() => ({}));
    const deadline = Date.now() + Math.min(Number(body.seconds) || 100, 130) * 1000;
    const out: Record<string, number> = { seeds: 0, tracks: 0, charts: 0, lastfm: 0 };
    const { data: seeds } = await db.rpc('reco_artist_seeds', { p_limit: Math.min(Number(body.seeds) || 20, 60) });
    for (const s of seeds || []) {
      if (Date.now() > deadline) break;
      out.tracks += await refreshSeed(s, deadline);
      out.seeds++;
    }
    const { data: chartsDue } = await db.rpc('catalog_due', { p_key: 'charts', p_hours: 20 });
    if (chartsDue && Date.now() < deadline) out.charts = await refreshCharts(deadline);
    if (Date.now() < deadline) out.lastfm = await refreshLastfm(deadline);
    return Response.json(out);
  } catch (e) {
    console.error('reco-catalog', String(e));
    return new Response('error', { status: 500 });
  }
});
