// Q8 : les écoutes faites dans l'appli (lecteur M2) sont enregistrées
// (listen_events) pour affiner les goûts : > 15 s = un petit « j'aime »,
// passé en moins de 5 s = un petit « pas trop ». Jamais bloquant.
import { onListen } from './preview';
import { supabase } from './supabase';

/** Même clé « titre|artiste » que la base (song_key). */
export function songKeyOf(title?: string | null, artist?: string | null): string {
  const t = (title || '').replace(/\s*[([][^)\]]*[)\]]|\s+-\s+.*$/g, '').trim().toLowerCase();
  const a = (artist || '').split(',')[0].split('&')[0].trim().toLowerCase();
  return `${t}|${a}`;
}

let started = false;
export function startListenLog() {
  if (started) return;
  started = true;
  onListen(async (r) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    supabase.from('listen_events').insert({
      song_key: songKeyOf(r.title, r.artist), track_name: r.title, artist: r.artist,
      source: r.source || null, listened_ms: Math.min(600_000, r.listenedMs), ended: r.ended,
    }).then(() => {}, () => {});
  });
}
