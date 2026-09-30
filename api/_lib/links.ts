// SHAKEMOI - Aperçus de liens : un seul système pour tous les liens partagés.
//
// Les robots d'aperçu (WhatsApp, iMessage, Messenger, Slack, X…) n'exécutent
// pas le JavaScript de l'app : ils ne voient que le HTML renvoyé par le
// serveur. Chaque lien public (/s, /p, /u, /i, /c, /m) passe donc par
// api/page, qui injecte le titre, la description et l'image propres à ce lien,
// et par api/og, qui dessine l'image. Ce fichier décrit chaque type une fois.

// Valeurs publiques du projet (même fallback que src/lib/supabase.ts : la clé
// anon est publique par design et protégée par le RLS).
import { SITE_DESCRIPTION, SITE_TITLE } from '../../src/lib/brand.js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';

// Incrémenter quand le dessin des images change : WhatsApp & co gardent en
// cache l'image d'une URL, changer `v` force un nouvel aperçu.
export const OG_VERSION = '2';

export const SITE_NAME = 'SHAKEmoi';
export const DEFAULT_DESCRIPTION = SITE_DESCRIPTION;

/**
 * Requête vers le site lui-même (index.html, polices, logos). Sur les
 * déploiements de preview protégés, passe la protection si Vercel fournit le
 * secret « Protection Bypass for Automation ». Sans effet en production.
 */
export function selfFetch(url: string) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return fetch(url, secret ? { headers: { 'x-vercel-protection-bypass': secret } } : undefined);
}

export type LinkType = 'song' | 'post' | 'profile' | 'invite' | 'circle' | 'conversation' | 'home';

export interface LinkParams {
  type: LinkType;
  id?: string | null;
  by?: string | null;   // pseudo de la personne qui invite (cercles)
}

/** Données dessinées dans l'image d'aperçu. */
export type CardData =
  | { kind: 'song'; title: string; artist: string; cover: string | null; by: string | null }
  | { kind: 'profile'; name: string; username: string; avatar: string | null; songs: number; followers: number }
  | { kind: 'invite'; username: string; avatar: string | null; circle: string | null }
  | { kind: 'circle'; name: string; photo: string | null; members: number }
  | { kind: 'conversation' }
  | { kind: 'home' };

export interface LinkMeta {
  title: string;
  description: string;
  card: CardData;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]{6,32}$/i;
const USERNAME = /^[a-z0-9._-]{1,40}$/i;

async function rest<T = any>(path: string, count = false): Promise<{ rows: T[]; count: number | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(count ? { Prefer: 'count=exact', Range: '0-0' } : {}),
    },
  });
  if (!res.ok) return { rows: [], count: null };
  const rows = (await res.json()) as T[];
  const range = res.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : null;
  return { rows: Array.isArray(rows) ? rows : [], count: Number.isFinite(total) ? total : null };
}

async function one<T = any>(path: string): Promise<T | null> {
  const { rows } = await rest<T>(path);
  return rows[0] ?? null;
}

async function countOf(path: string): Promise<number> {
  const { count } = await rest(path, true);
  return count ?? 0;
}

async function userById(id: string | null | undefined) {
  if (!id || !UUID.test(id)) return null;
  return one<{ username: string; display_name: string | null; profile_album_cover_url: string | null }>(
    `users_profile?id=eq.${id}&select=username,display_name,profile_album_cover_url`
  );
}

// Pseudo d'un lien /u/… : sans tenir compte des majuscules, et les anciens
// pseudos redirigent vers le profil actuel (fonction resolve_username).
async function userByUsername(username: string) {
  const hit = await one<{ id: string; username: string }>(
    `rpc/resolve_username?p_username=${encodeURIComponent(username)}`
  );
  if (!hit?.id) return null;
  return one<{ id: string; username: string; display_name: string | null; profile_album_cover_url: string | null }>(
    `users_profile?id=eq.${hit.id}&select=id,username,display_name,profile_album_cover_url`
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

function songMeta(track: string, artist: string, cover: string | null, by: string | null): LinkMeta {
  return {
    title: artist ? `${track} · ${artist}` : track,
    description: by
      ? `@${by} te fait écouter ce son. Ouvre-le sur ta plateforme en un clic.`
      : 'Ouvre ce son sur ta plateforme en un clic.',
    card: { kind: 'song', title: track, artist, cover, by },
  };
}

const HOME: LinkMeta = { title: SITE_TITLE, description: DEFAULT_DESCRIPTION, card: { kind: 'home' } };

const CONVERSATION: LinkMeta = {
  title: 'Rejoins la conversation sur SHAKEmoi',
  description: 'Ouvre SHAKEmoi pour lire les messages.',
  card: { kind: 'conversation' },
};

// Son qu'on ne peut pas montrer (post privé, de cercle, ou introuvable).
const NEUTRAL_SONG: LinkMeta = {
  title: 'Un son partagé sur SHAKEmoi',
  description: 'Ouvre SHAKEmoi pour l\'écouter.',
  card: { kind: 'home' },
};

async function inviteMeta(username: string, circle: { name: string } | null): Promise<LinkMeta | null> {
  const user = USERNAME.test(username) ? await userByUsername(username) : null;
  if (!user) return null;
  return {
    title: circle
      ? `@${user.username} t'invite dans le cercle ${circle.name}`
      : `@${user.username} t'invite sur SHAKEmoi`,
    description: circle
      ? 'Rejoins le cercle pour partager vos sons entre vous.'
      : 'Viens partager tes sons avec tes amis, quelle que soit leur plateforme.',
    card: { kind: 'invite', username: user.username, avatar: user.profile_album_cover_url, circle: circle?.name ?? null },
  };
}

/** Résout le titre, la description et l'image d'un lien. Ne jette jamais. */
export async function resolveLink({ type, id, by }: LinkParams): Promise<LinkMeta> {
  try {
    switch (type) {
      case 'song': {
        // Les tout premiers liens /s/<uuid> pointaient vers un post.
        if (id && UUID.test(id)) return resolveLink({ type: 'post', id });
        if (!id || !SLUG.test(id)) return NEUTRAL_SONG;
        const share = await one<{ song_id: string; user_id: string | null }>(
          `shares?slug=eq.${id}&select=song_id,user_id`
        );
        if (!share) return NEUTRAL_SONG;
        const [song, user] = await Promise.all([
          one<{ track_name: string; artist: string; cover_url: string | null }>(
            `songs?id=eq.${share.song_id}&select=track_name,artist,cover_url`
          ),
          userById(share.user_id),
        ]);
        if (!song) return NEUTRAL_SONG;
        return songMeta(song.track_name, song.artist, song.cover_url, user?.username ?? null);
      }

      case 'post': {
        if (!id || !UUID.test(id)) return NEUTRAL_SONG;
        const post = await one<{
          track_name: string | null; artist: string | null; cover_url: string | null;
          user_id: string; is_private: boolean | null; circle_id: string | null;
        }>(`posts?id=eq.${id}&select=track_name,artist,cover_url,user_id,is_private,circle_id`);
        // Posts privés ou de cercle : rien de leur contenu ne sort dans l'aperçu.
        if (!post || post.is_private || post.circle_id || !post.track_name) return NEUTRAL_SONG;
        const user = await userById(post.user_id);
        return songMeta(post.track_name, post.artist || '', post.cover_url, user?.username ?? null);
      }

      case 'profile': {
        if (!id || !USERNAME.test(id)) return HOME;
        const user = await userByUsername(id);
        if (!user) return HOME;
        const [songs, followers] = await Promise.all([
          countOf(`posts?user_id=eq.${user.id}&is_private=not.is.true&circle_id=is.null&is_reshake=not.is.true&select=id`),
          countOf(`follows?following_id=eq.${user.id}&select=id`),
        ]);
        const name = user.display_name || user.username;
        return {
          title: `${name} (@${user.username}) sur SHAKEmoi`,
          description: `${plural(songs, 'son partagé', 'sons partagés')} · ${plural(followers, 'abonné', 'abonnés')}`,
          card: { kind: 'profile', name, username: user.username, avatar: user.profile_album_cover_url, songs, followers },
        };
      }

      case 'invite':
        return (id && (await inviteMeta(id, null))) || HOME;

      case 'circle': {
        if (!id || !UUID.test(id)) return HOME;
        // Les cercles ne sont lisibles que connecté : une fonction dédiée
        // n'expose que le nom, la photo et le nombre de membres.
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_circle_preview`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_circle_id: id }),
        });
        const rows = res.ok ? await res.json() : [];
        const circle = Array.isArray(rows) ? rows[0] : rows;
        if (!circle?.name) return HOME;
        if (by) {
          const invite = await inviteMeta(by, circle);
          if (invite) return invite;
        }
        const members = Number(circle.member_count) || 0;
        return {
          title: `Cercle ${circle.name} sur SHAKEmoi`,
          description: `${plural(members, 'membre', 'membres')} y partagent leurs sons. Rejoins-les.`,
          card: { kind: 'circle', name: circle.name, photo: circle.photo_url ?? null, members },
        };
      }

      case 'conversation':
        return CONVERSATION;

      default:
        return HOME;
    }
  } catch {
    return type === 'conversation' ? CONVERSATION : HOME;
  }
}

/** Lit le type de lien à partir des paramètres posés par les rewrites de vercel.json. */
export function paramsFromUrl(url: URL): LinkParams {
  const q = url.searchParams;
  const type = (q.get('type') || 'home') as LinkType;
  const known: LinkType[] = ['song', 'post', 'profile', 'invite', 'circle', 'conversation', 'home'];
  return {
    type: known.includes(type) ? type : 'home',
    id: q.get('id'),
    by: q.get('by'),
  };
}
