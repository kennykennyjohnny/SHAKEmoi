// M1 — Contrôle des extraits de tous les sons (posts, stories, messages, cercles).
//
// Entrée : un fichier JSON de sons distincts [{ id, t, a }] (id Spotify, titre,
// artiste), exporté de la base (requête dans supabase/pending/m1_export_sons.sql).
// Pour chacun : chaîne Spotify → Deezer → iTunes via https://www.shakemoi.fr/api/links,
// puis vérification que l'extrait se charge vraiment.
// Sortie : bilan chiffré + fichier SQL de réparation (preview_url + preview_source).
//
//   node scripts/check-previews.mjs sons.json reparation.sql

import fs from 'node:fs';

const [, , input, output = 'reparation-extraits.sql'] = process.argv;
const sounds = JSON.parse(fs.readFileSync(input, 'utf8'));
const ORIGIN = 'https://www.shakemoi.fr';

async function checkPlayable(url) {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
    const type = res.headers.get('content-type') || '';
    return res.ok && /audio|mpeg|mp4|octet/.test(type);
  } catch { return false; }
}

const sql = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const stats = { total: sounds.length, spotify: 0, deezer: 0, itunes: 0, aucun: 0, casse: 0 };
const rows = [];
const missing = [];

for (const s of sounds) {
  const p = new URLSearchParams();
  if (s.id) p.set('spotify', s.id);
  if (s.t) p.set('title', s.t);
  if (s.a) p.set('artist', s.a);
  p.set('v', '3');
  let r = null;
  try { r = await (await fetch(`${ORIGIN}/api/links?${p}`, { signal: AbortSignal.timeout(15000) })).json(); } catch { /* réseau */ }
  const url = r?.preview || null;
  let source = r?.previewSource || null;
  if (url && !(await checkPlayable(url))) { stats.casse++; source = null; }
  const ok = url && source;
  if (ok) stats[source]++; else { stats.aucun++; missing.push(`${s.t || '(sans titre)'} — ${s.a || ''}`); }
  rows.push(`(${sql(s.id)}, ${sql(s.t)}, ${sql(s.a || '')}, ${sql(ok ? url : null)}, ${sql(ok ? source : 'none')})`);
  process.stdout.write(ok ? '.' : 'x');
}

const upd = (t) => `UPDATE public.${t} x SET preview_url = f.url, preview_source = f.src FROM f
WHERE (x.preview_url IS NULL OR x.preview_url LIKE '%dzcdn.net%')
  AND ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));`;
fs.writeFileSync(output, `-- M1 : réparation des extraits (généré par scripts/check-previews.mjs)
BEGIN;
CREATE TEMP TABLE f (id text, t text, a text, url text, src text) ON COMMIT DROP;
INSERT INTO f VALUES
  ${rows.join(',\n  ')};
${['posts', 'stories', 'messages', 'circle_messages'].map(upd).join('\n')}
COMMIT;
`);
console.log(`\n\nBilan sur ${stats.total} sons distincts :`);
console.log(`  lisibles via Spotify : ${stats.spotify}`);
console.log(`  lisibles via Deezer  : ${stats.deezer}`);
console.log(`  lisibles via iTunes  : ${stats.itunes}`);
console.log(`  sans extrait         : ${stats.aucun}${stats.casse ? ` (dont ${stats.casse} extrait trouvé mais illisible)` : ''}`);
if (missing.length) console.log('\nSans extrait (bouton « Écouter sur Spotify ») :\n  ' + missing.join('\n  '));
console.log(`\nSQL de réparation écrit dans ${output}`);
