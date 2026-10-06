// Correctif 06/10 (S1 / S6) — Diagnostic chiffré des extraits, son par son.
//
// Pour chaque son (posts lisibles avec la clé publique + résultats de recherche
// réels) :
//   1. ce qui est en base : preview_url, preview_source ;
//   2. l'adresse enregistrée se lit-elle ? (GET Range, redirections suivies) ;
//   3. /api/links tel que le téléphone le demande (v=2 / v=3, peut venir du cache CDN) ;
//   4. /api/links sans cache (paramètre anti-cache) ;
//   5. l'extrait trouvé se lit-il ? ;
//   6. Deezer et iTunes interrogés directement depuis cette machine (pas Vercel),
//      pour savoir si l'échec vient de la source ou du serveur.
// Puis classe chaque échec par cause et écrit le bilan (stdout + résumé GitHub)
// et un SQL de réparation (preview_url / preview_source) à coller dans
// Supabase → SQL Editor.
//
//   node scripts/diag-previews.mjs [--limit 150] [--sql reparation.sql]

import fs from 'node:fs';

const ORIGIN = process.env.SHAKEMOI_ORIGIN || 'https://www.shakemoi.fr';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vbjmhtwrfboqziwibsut.supabase.co';
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';
// Clé de service (facultative, secret GitHub) : lit aussi stories et messages.
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON;

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const LIMIT = Number(arg('limit', '150'));
const SQL_OUT = arg('sql', 'reparation-extraits.sql');
const VERSION = arg('version', '2'); // paramètre v= qu'envoie la version en ligne

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => `diag${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function timed(url, init = {}, ms = 15000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    return { res, ms: Date.now() - t0 };
  } catch (e) {
    return { res: null, ms: Date.now() - t0, err: e?.name === 'TimeoutError' ? 'timeout' : String(e?.message || e) };
  }
}

async function rest(table, select, extra = '') {
  const { res } = await timed(
    `${SUPABASE_URL}/rest/v1/${table}?select=${select}&track_name=not.is.null&order=created_at.desc&limit=${LIMIT}${extra}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (!res || !res.ok) return { rows: [], status: res?.status ?? 'réseau' };
  return { rows: await res.json(), status: res.status };
}

// L'extrait se lit-il vraiment ? (ce que fait le téléphone : GET, redirections suivies)
async function playable(url) {
  if (!url) return { ok: false, why: 'aucune adresse' };
  const { res, err, ms } = await timed(url, { headers: { Range: 'bytes=0-2047' }, redirect: 'follow' }, 12000);
  if (!res) return { ok: false, why: err, ms };
  const type = res.headers.get('content-type') || '';
  const cache = res.headers.get('x-vercel-cache') || '';
  if (!res.ok) {
    let body = '';
    try { body = (await res.text()).slice(0, 60); } catch { /* rien */ }
    return { ok: false, why: `HTTP ${res.status}${body ? ` « ${body} »` : ''}${cache ? ` (CDN ${cache})` : ''}`, ms };
  }
  try { await res.arrayBuffer(); } catch { /* rien */ }
  const ok = /audio|mpeg|mp4|octet|aac/.test(type);
  return { ok, why: ok ? 'OK' : `type ${type}`, ms };
}

async function links(params, bust) {
  const p = new URLSearchParams(params);
  p.set('v', bust ? rnd() : VERSION);
  const { res, ms, err } = await timed(`${ORIGIN}/api/links?${p}`, {}, 20000);
  if (!res) return { err, ms };
  let body = null;
  try { body = await res.json(); } catch { /* rien */ }
  return {
    status: res.status,
    ms,
    preview: body?.preview || null,
    source: body?.previewSource || null,
    cache: res.headers.get('x-vercel-cache') || '',
    age: res.headers.get('age') || '',
    cc: res.headers.get('cache-control') || '',
    why: body?.why || null,
  };
}

async function deezerDirect(isrc, title, artist) {
  const out = { quota: false, found: false, preview: false };
  const get = async (u) => {
    const { res } = await timed(u, {}, 8000);
    const j = res && res.ok ? await res.json().catch(() => null) : null;
    if (j?.error?.code === 4) out.quota = true;
    return j;
  };
  if (isrc) {
    const t = await get(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`);
    if (t?.id && !t.error) { out.found = true; out.preview = !!t.preview; out.id = t.id; return out; }
  }
  if (title) {
    const r = await get(`https://api.deezer.com/search?q=${encodeURIComponent(`${title} ${artist || ''}`)}&limit=5`);
    const t = (r?.data || [])[0];
    if (t) { out.found = true; out.preview = !!t.preview; out.id = t.id; }
  }
  return out;
}

async function itunesDirect(title, artist) {
  if (!title) return { status: 'pas de titre' };
  const { res } = await timed(`https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist || ''}`)}&media=music&entity=song&limit=5&country=FR`, {}, 8000);
  if (!res) return { status: 'réseau' };
  if (!res.ok) return { status: `HTTP ${res.status}` };
  const j = await res.json().catch(() => null);
  return { status: 'OK', found: !!j?.results?.some((r) => r.previewUrl) };
}

async function spotifySearch(q) {
  const { res } = await timed(`${SUPABASE_URL}/functions/v1/spotify-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ action: 'search', query: q }),
  });
  const j = res && res.ok ? await res.json().catch(() => null) : null;
  return (j?.tracks?.items || []).slice(0, 4).map((t) => ({
    origin: 'recherche', id: t.id, t: t.name, a: (t.artists || []).map((x) => x.name).join(', '),
    preview_url: t.preview_url || null, preview_source: null, isrc: t.external_ids?.isrc || null,
  }));
}

// ---- Sons à contrôler ------------------------------------------------------------
const sounds = [];
const seen = new Set();
const add = (s) => {
  const k = s.id || `${(s.t || '').toLowerCase()}::${(s.a || '').toLowerCase()}`;
  if (seen.has(k)) { const o = sounds.find((x) => x.key === k); if (o) o.rows++; return; }
  seen.add(k);
  sounds.push({ ...s, key: k, rows: 1 });
};
const tables = {};
for (const t of ['posts', 'stories', 'messages', 'circle_messages']) {
  const { rows, status } = await rest(t, 'id,track_id,track_name,artist,preview_url,preview_source,created_at');
  tables[t] = { rows: rows.length, status };
  for (const r of rows) add({ origin: t, id: r.track_id || null, t: r.track_name, a: r.artist || '', preview_url: r.preview_url, preview_source: r.preview_source });
}
// Recherche : de vraies requêtes, comme dans l'onglet Recherche.
const QUERIES = ['tiakola', 'houdi', 'ninho', 'aya nakamura', 'jul', 'gims', 'werenoi', 'sdm', 'theodora', 'pnl', 'angèle', 'stromae', 'the weeknd', 'tayc', 'zola'];
for (const q of QUERIES) { for (const s of await spotifySearch(q)) add(s); await sleep(150); }
console.log(`Lecture base : ${Object.entries(tables).map(([t, v]) => `${t} ${v.rows} (HTTP ${v.status})`).join(', ')}`);
console.log(`${sounds.length} sons distincts à contrôler\n`);

// ---- Contrôle son par son -----------------------------------------------------------
const results = [];
for (const s of sounds) {
  const params = {};
  if (s.id) params.spotify = s.id;
  if (s.t) params.title = s.t;
  if (s.a) params.artist = s.a;
  const r = { s };
  r.stored = s.preview_url && !s.preview_url.includes('dzcdn.net') ? await playable(s.preview_url) : { ok: false, why: s.preview_url ? 'Deezer signé expiré' : 'vide' };
  r.cached = await links(params, false);
  r.fresh = await links(params, true);
  r.freshPlay = r.fresh.preview ? await playable(r.fresh.preview) : { ok: false, why: 'pas d\'extrait' };
  const failing = !r.stored.ok && !(r.cached.preview && (await playable(r.cached.preview)).ok);
  r.failing = failing;
  if (failing || !r.freshPlay.ok) {
    r.dz = await deezerDirect(s.isrc || null, s.t, s.a);
    r.it = await itunesDirect(s.t, s.a);
  }
  // Cause, du point de vue du téléphone (version en ligne) :
  let cause;
  if (!failing) cause = 'lisible';
  else if (r.freshPlay.ok) {
    cause = r.cached.preview ? 'extrait en cache CDN mort'
      : r.cached.cache === 'HIT' || r.cached.cache === 'STALE' || Number(r.cached.age) > 0 ? 'échec gardé en cache CDN (/api/links)'
      : 'échec passager (réussit en réessayant)';
    if (s.preview_url && !r.stored.ok) cause = `adresse en base illisible (${r.stored.why}) — réparable`;
  } else if (r.dz?.quota) cause = 'Deezer en limite de débit (code 4)';
  else if (r.dz?.preview) cause = 'Deezer a l\'extrait mais /api/links ne le trouve pas (Vercel : délai / quota / correspondance)';
  else if (r.it?.found) cause = 'iTunes a l\'extrait mais pas /api/links (iTunes bloqué depuis Vercel ?)';
  else cause = 'aucun extrait nulle part (rare)';
  r.cause = cause;
  results.push(r);
  process.stdout.write(failing ? 'x' : '.');
  await sleep(250);
}

// ---- Bilan ----------------------------------------------------------------------------
const by = (f) => results.reduce((m, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {});
const lines = [];
const out = (l = '') => { lines.push(l); };
out(`# Diagnostic des extraits — ${new Date().toISOString()}`);
out();
out(`Site : ${ORIGIN} · lecture base : ${Object.entries(tables).map(([t, v]) => `${t} ${v.rows}`).join(', ')} · ${results.length} sons distincts`);
out();
out('## Par cause (point de vue du téléphone, version en ligne)');
out();
out('| Cause | Sons |');
out('|---|---|');
for (const [k, v] of Object.entries(by((r) => r.cause)).sort((a, b) => b[1] - a[1])) out(`| ${k} | ${v} |`);
out();
out('## Sources (sans cache)');
out();
out('| Source | Sons |');
out('|---|---|');
for (const [k, v] of Object.entries(by((r) => (r.freshPlay.ok ? r.fresh.source || '?' : 'aucune')))) out(`| ${k} | ${v} |`);
out();
const cacheStats = by((r) => `${r.cached.preview ? 'avec' : 'sans'} extrait · CDN ${r.cached.cache || '-'}`);
out('## /api/links tel que demandé par le téléphone');
out();
for (const [k, v] of Object.entries(cacheStats)) out(`- ${k} : ${v}`);
const slow = results.filter((r) => r.fresh.ms > 4000).length;
out(`- réponses sans cache de plus de 4 s : ${slow} ; plus lente : ${Math.max(...results.map((r) => r.fresh.ms || 0))} ms`);
out();
out('## Sons qui échouent (détail)');
out();
out('| Son | Origine | En base | Adresse en base | /api/links (téléphone) | /api/links sans cache | Deezer direct | iTunes direct | Cause |');
out('|---|---|---|---|---|---|---|---|---|');
for (const r of results.filter((x) => x.failing)) {
  const s = r.s;
  out(`| ${(s.t || '?').slice(0, 40)} — ${(s.a || '').slice(0, 25)} | ${s.origin}${s.rows > 1 ? ` ×${s.rows}` : ''} | ${s.preview_source || '-'} | ${r.stored.why} | ${r.cached.preview ? r.cached.source : 'null'} · CDN ${r.cached.cache || '-'}${r.cached.age ? ` · âge ${r.cached.age}s` : ''} | ${r.fresh.preview ? `${r.fresh.source} (${r.freshPlay.why})` : r.fresh.err || 'null'} · ${r.fresh.ms} ms${r.fresh.why ? ` · ${JSON.stringify(r.fresh.why)}` : ''} | ${r.dz ? (r.dz.quota ? 'QUOTA' : r.dz.preview ? 'extrait' : r.dz.found ? 'sans extrait' : 'introuvable') : '-'} | ${r.it ? (r.it.found ? 'extrait' : r.it.status) : '-'} | ${r.cause} |`);
}
const report = lines.join('\n');
console.log('\n\n' + report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

// ---- SQL de réparation (S6) : seulement des extraits vérifiés lisibles ----------------
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const fix = results.filter((r) => r.s.origin !== 'recherche' && r.freshPlay.ok && r.fresh.preview !== r.s.preview_url && !r.stored.ok);
const values = fix.map((r) => `(${q(r.s.id)}, ${q(r.s.t)}, ${q(r.s.a || '')}, ${q(r.fresh.preview)}, ${q(r.fresh.source)})`);
fs.writeFileSync(SQL_OUT, values.length ? `-- Correctif 06/10 (S6) : extraits réparés (généré par scripts/diag-previews.mjs)
BEGIN;
CREATE TEMP TABLE f (id text, t text, a text, url text, src text) ON COMMIT DROP;
INSERT INTO f VALUES
  ${values.join(',\n  ')};
${['posts', 'stories', 'messages', 'circle_messages'].map((t) => `UPDATE public.${t} x SET preview_url = f.url, preview_source = f.src FROM f
WHERE ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));`).join('\n')}
COMMIT;
` : '-- Rien à réparer\n');
console.log(`\nSQL de réparation (${fix.length} sons) écrit dans ${SQL_OUT}`);
