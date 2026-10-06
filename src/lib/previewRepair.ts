// Correctif 06/10 (S3) : une adresse d'extrait morte se répare toute seule.
// Un extrait ne se lit pas (erreur audio, 403, 404, 503) :
//   1. on l'oublie partout sur le téléphone (caches d'extraits et de liens) ;
//   2. on relance UNE fois la résolution complète, sans aucun cache ;
//   3. si un extrait est trouvé, l'écran le joue, et dès qu'il sort vraiment du
//      haut-parleur, on l'écrit en base pour tout le monde (repair_song_preview).
import { supabase } from './supabase';
import { resolvePreviewUrl, forgetPreview, onPreviewChange, getPreviewState, getCurrentPreviewUrl } from './preview';

export interface RepairTarget { title: string; artist: string; spotifyId?: string | null }

const sourceOf = (url: string) => (url.includes('/api/preview') ? 'deezer' : url.includes('scdn.co') ? 'spotify' : 'itunes');

// Réparations trouvées, en attente de confirmation (le son sort vraiment).
const pending = new Map<string, { url: string; old: string; t: RepairTarget }>();

export async function repairPreview(key: string, t: RepairTarget, badUrl: string): Promise<string | null> {
  forgetPreview(badUrl);
  const url = await resolvePreviewUrl(t.title || '', t.artist || '', null, t.spotifyId || null, { fresh: true, exclude: badUrl }).catch(() => null);
  console.info(`[extrait] réparation « ${t.title} » : ${url ? `nouvel extrait ${sourceOf(url)}` : 'rien trouvé'}`);
  // Réessai de la même adresse stable Deezer (&r=…) : rien à écrire en base.
  if (url && !url.includes('&r=')) pending.set(key, { url, old: badUrl, t });
  return url;
}

if (typeof window !== 'undefined') {
  onPreviewChange(() => {
    const s = getPreviewState();
    const p = s.key ? pending.get(s.key) : null;
    if (!p || !s.playing || getCurrentPreviewUrl() !== p.url) return;
    pending.delete(s.key!);
    supabase
      .rpc('repair_song_preview', {
        p_track_id: p.t.spotifyId || null,
        p_title: p.t.title || null,
        p_artist: p.t.artist || null,
        p_old_url: p.old,
        p_url: p.url,
        p_source: sourceOf(p.url),
      })
      .then(({ data, error }) => {
        if (error) console.info('[extrait] réparation non écrite en base :', error.message);
        else console.info(`[extrait] base réparée : ${data ?? 0} ligne(s)`);
      });
  });
}
