// SHAKEMOI - Liens publics : un seul format pour tout ce qu'on partage.
// Partagé entre l'app (construction + lecture des liens) et les fonctions
// Vercel d'aperçu (api/), donc sans dépendance au navigateur.
//
//   /s/<slug>        son partagé (table shares)
//   /p/<postId>      post / shake
//   /u/<pseudo>      profil
//   /i/<pseudo>      invitation sur SHAKEmoi
//   /c/<id>?by=<p>   cercle (invitation si `by`)
//   /m               conversation (aperçu neutre, aucun contenu privé)
//
// Les anciens formats (#/s/, #/circle/, ?song=, ?ref=) restent reconnus.

// Domaine principal sur Vercel : shakemoi.fr redirige (308) vers www. On
// pointe directement sur www pour que les robots d'aperçu n'aient aucune
// redirection à suivre.
export const PUBLIC_ORIGIN = 'https://www.shakemoi.fr';

export type RouteType = 'song' | 'post' | 'profile' | 'invite' | 'circle' | 'conversation';

export interface Route {
  type: RouteType;
  id: string;
  by?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]{6,32}$/i;
const USERNAME = /^[a-z0-9._-]{1,40}$/i;

export function routePath(r: Route): string {
  const id = encodeURIComponent(r.id);
  switch (r.type) {
    case 'song': return `/s/${id}`;
    case 'post': return `/p/${id}`;
    case 'profile': return `/u/${id}`;
    case 'invite': return `/i/${id}`;
    case 'circle': return r.by ? `/c/${id}?by=${encodeURIComponent(r.by)}` : `/c/${id}`;
    case 'conversation': return '/m';
  }
}

const url = (r: Route) => `${PUBLIC_ORIGIN}${routePath(r)}`;

export const songLink = (slug: string) => url({ type: 'song', id: slug });
export const postLink = (postId: string) => url({ type: 'post', id: postId });
export const profileLink = (username: string) => url({ type: 'profile', id: username });
export const inviteLink = (username?: string | null) =>
  username ? url({ type: 'invite', id: username }) : PUBLIC_ORIGIN;
export const circleLink = (circleId: string, by?: string | null) => url({ type: 'circle', id: circleId, by });
export const conversationLink = () => url({ type: 'conversation', id: '' });

/** Lit le lien d'arrivée (chemin, query ou ancien hash). */
export function parseRoute(pathname: string, search: string, hash: string): Route | null {
  const q = new URLSearchParams(search);
  const seg = pathname.split('/').filter(Boolean);
  const [head, raw] = seg;
  const id = raw ? decodeURIComponent(raw) : '';

  // Les tout premiers liens /s/<uuid> pointaient vers un post.
  if (head === 's' && UUID.test(id)) return { type: 'post', id };
  if (head === 's' && SLUG.test(id)) return { type: 'song', id };
  if (head === 'p' && UUID.test(id)) return { type: 'post', id };
  if (head === 'u' && USERNAME.test(id)) return { type: 'profile', id };
  if (head === 'i' && USERNAME.test(id)) return { type: 'invite', id };
  if (head === 'c' && UUID.test(id)) return { type: 'circle', id, by: q.get('by') };
  if (head === 'm') return { type: 'conversation', id: '' };

  // Anciens formats.
  const legacyPost = hash.match(/\/s\/([0-9a-f-]{36})/i);
  if (legacyPost && UUID.test(legacyPost[1])) return { type: 'post', id: legacyPost[1] };
  const legacyCircle = hash.match(/\/circle\/([0-9a-f-]{36})/i);
  if (legacyCircle && UUID.test(legacyCircle[1])) return { type: 'circle', id: legacyCircle[1] };
  const song = q.get('song');
  if (song && SLUG.test(song)) return { type: 'song', id: song };
  const ref = q.get('ref');
  if (ref && USERNAME.test(ref)) return { type: 'invite', id: ref };

  return null;
}
