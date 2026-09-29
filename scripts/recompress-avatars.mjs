// ✅ OK de Kenny (29/09/2026). Simulation faite : 5 avatars, 13,7 Mo → 42 Ko.
//
// I1 : recompresse une fois les photos de profil déjà en ligne (jusqu'à 9,7 Mo)
// en JPEG 256 px (~15 Ko), et fait pointer les profils vers la nouvelle image.
// Les fichiers d'origine NE SONT PAS supprimés (retour arrière possible).
//
// Depuis ce soir, l'appli affiche déjà ces avatars en petite version via
// /api/img : ce script sert surtout à alléger le stockage et les autres
// usages (aperçus de liens, etc.).
//
// Lancement (clé « service_role » : Supabase > Project Settings > API) :
//   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/recompress-avatars.mjs          (simulation)
//   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/recompress-avatars.mjs --apply  (pour de vrai)

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const URL = process.env.SUPABASE_URL || 'https://vbjmhtwrfboqziwibsut.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const MIN_BYTES = 150 * 1024; // on ne touche pas aux avatars déjà légers

if (!KEY) {
  console.error('Il faut SUPABASE_SERVICE_ROLE_KEY dans l\'environnement.');
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });
const MARK = '/storage/v1/object/public/avatars/';

const { data: profiles, error } = await db
  .from('users_profile')
  .select('id, username, profile_album_cover_url')
  .like('profile_album_cover_url', `%${MARK}%`);
if (error) throw error;

let saved = 0;
for (const p of profiles) {
  const url = p.profile_album_cover_url;
  const res = await fetch(url);
  if (!res.ok) { console.log(`@${p.username} : image introuvable (${res.status}), ignorée`); continue; }
  const input = Buffer.from(await res.arrayBuffer());
  if (input.length < MIN_BYTES) { console.log(`@${p.username} : déjà léger (${Math.round(input.length / 1024)} Ko)`); continue; }

  const out = await sharp(input, { failOn: 'none' }).rotate()
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  saved += input.length - out.length;
  const path = `${p.id}/avatar-256-${Date.now()}.jpg`;
  console.log(`@${p.username} : ${Math.round(input.length / 1024)} Ko → ${Math.round(out.length / 1024)} Ko ${APPLY ? '' : '(simulation)'}`);
  if (!APPLY) continue;

  const { error: upErr } = await db.storage.from('avatars').upload(path, out, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (upErr) { console.log(`  échec de l'envoi : ${upErr.message}`); continue; }
  const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(path);
  const { error: updErr } = await db.from('users_profile').update({ profile_album_cover_url: publicUrl }).eq('id', p.id);
  if (updErr) console.log(`  échec de la mise à jour du profil : ${updErr.message}`);
}
console.log(`\nGain total : ${Math.round(saved / 1024 / 1024 * 10) / 10} Mo${APPLY ? '' : ' (simulation, rien n\'a été modifié)'}`);
