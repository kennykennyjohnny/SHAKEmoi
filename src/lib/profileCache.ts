// Q5 : aperçu de profil instantané.
// - Ce qu'on connaît déjà (avatar, nom, @ du post ou de la liste touchée) est
//   gardé ici et affiché tout de suite : jamais d'écran vide.
// - L'en-tête complet arrive en UNE requête (fonction SQL get_profile_header),
//   et la 1re page du fil en parallèle.
// - Préchargement : dès que le doigt touche un avatar / un nom (ou au survol
//   sur ordinateur), avant même que l'aperçu s'ouvre.
// - Cache : rouvrir le même profil dans la minute est instantané, puis c'est
//   rafraîchi discrètement en arrière-plan.
import { supabase } from './supabase';
import { getProfileGridPage } from './database';

export interface ProfileSeed {
  id: string;
  username?: string;
  display_name?: string | null;
  profile_album_cover_url?: string | null;
}

export interface ProfileHeader {
  profile: ProfileSeed & { bio?: string | null };
  block: 'none' | 'i_blocked' | 'blocked_me';
  counts?: { shakes: number; followers: number; following: number };
  is_following?: boolean;
  follows_me?: boolean;
  mutual?: { users: any[]; total: number } | null;
  taste?: any;
  streak?: { current: number; best: number; this_week: boolean; week_ends_at: string } | null;
  stories?: any[];
  pinned_stories?: any[];
}

const FRESH_MS = 60_000;
const seeds = new Map<string, ProfileSeed>();
const headers = new Map<string, { at: number; p: Promise<ProfileHeader | null>; data?: ProfileHeader | null }>();
const grids = new Map<string, { at: number; p: Promise<any[]>; data?: any[] }>();

/** Ce qu'on sait déjà d'une personne (sans requête). */
export function seedProfile(s: Partial<ProfileSeed> | null | undefined) {
  if (!s?.id) return;
  const prev = seeds.get(s.id) || { id: s.id };
  const next: ProfileSeed = { ...prev };
  if (s.username) next.username = s.username;
  if (s.display_name) next.display_name = s.display_name;
  if (s.profile_album_cover_url) next.profile_album_cover_url = s.profile_album_cover_url;
  seeds.set(s.id, next);
}
export const getSeed = (id: string): ProfileSeed | null => seeds.get(id) || null;

/** En-tête (cache 1 min, la même requête en vol est partagée). */
export function fetchProfileHeader(id: string, force = false): Promise<ProfileHeader | null> {
  const hit = headers.get(id);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit.p;
  const entry: { at: number; p: Promise<ProfileHeader | null>; data?: ProfileHeader | null } = { at: Date.now(), p: Promise.resolve(null) };
  entry.p = Promise.resolve(supabase.rpc('get_profile_header', { p_user: id }))
    .then(({ data, error }) => {
      if (error) throw error;
      const h = (data as ProfileHeader) || null;
      entry.data = h;
      if (h?.profile) seedProfile(h.profile);
      return h;
    })
    .catch((e) => { headers.delete(id); throw e; });
  headers.set(id, entry);
  return entry.p;
}
/** Dernier en-tête connu, même un peu ancien (affiché pendant le rafraîchissement). */
export function peekProfileHeader(id: string): { data: ProfileHeader; fresh: boolean } | null {
  const hit = headers.get(id);
  if (!hit?.data) return null;
  return { data: hit.data, fresh: Date.now() - hit.at < FRESH_MS };
}
export function patchProfileHeader(id: string, patch: Partial<ProfileHeader>) {
  const hit = headers.get(id);
  if (hit?.data) hit.data = { ...hit.data, ...patch };
}

/** 1re page du fil d'un profil (Shakes), même principe. */
export function fetchProfileFirstPage(id: string, force = false): Promise<any[]> {
  const hit = grids.get(id);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit.p;
  const entry: { at: number; p: Promise<any[]>; data?: any[] } = { at: Date.now(), p: Promise.resolve([]) };
  entry.p = getProfileGridPage(id, 'shakes', null)
    .then((rows) => { entry.data = rows; return rows; })
    .catch((e) => { grids.delete(id); throw e; });
  grids.set(id, entry);
  return entry.p;
}
export function peekProfileFirstPage(id: string): { data: any[]; fresh: boolean } | null {
  const hit = grids.get(id);
  if (!hit?.data) return null;
  return { data: hit.data, fresh: Date.now() - hit.at < FRESH_MS };
}

/** Lance les deux chargements (en-tête + 1re page) sans attendre. */
export function prefetchProfile(id: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  fetchProfileHeader(id).catch(() => {});
  fetchProfileFirstPage(id).catch(() => {});
}

/** Attributs à poser sur un avatar / un nom cliquable : préchargement au toucher. */
export function profileProps(u: Partial<ProfileSeed> | null | undefined): Record<string, string> {
  if (!u?.id) return {};
  return {
    'data-profile': u.id,
    'data-pname': u.display_name || '',
    'data-puser': u.username || '',
    'data-pavatar': u.profile_album_cover_url || '',
  };
}

// Un seul écouteur pour toute l'appli : le doigt qui se pose (ou la souris qui
// survole) un élément marqué `data-profile` lance le préchargement.
if (typeof window !== 'undefined') {
  let lastHover = '';
  const onTarget = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.('[data-profile]');
    if (!el) return;
    const id = el.getAttribute('data-profile') || '';
    if (e.type === 'mouseover') { if (id === lastHover) return; lastHover = id; }
    seedProfile({
      id,
      username: el.getAttribute('data-puser') || undefined,
      display_name: el.getAttribute('data-pname') || undefined,
      profile_album_cover_url: el.getAttribute('data-pavatar') || undefined,
    });
    prefetchProfile(id);
  };
  window.addEventListener('pointerdown', onTarget, { capture: true, passive: true });
  window.addEventListener('mouseover', onTarget, { capture: true, passive: true });
}
