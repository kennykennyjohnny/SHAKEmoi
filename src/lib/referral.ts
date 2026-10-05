// R8 : qui m'a invité·e. Le parrain voyage par TROIS chemins, pour survivre au
// passage du navigateur d'Instagram (ou TikTok, Snapchat…) au vrai navigateur,
// qui ne partagent rien :
//   1. l'adresse : /i/<pseudo>, /u/<pseudo>, puis ?ref=<pseudo> tant qu'on n'est
//      pas inscrit (c'est elle que « Ouvrir dans Chrome / Safari » emporte) ;
//   2. le stockage du navigateur (30 jours) ;
//   3. le compte : passé à l'inscription (options.data.referrer), la base
//      enregistre l'invitation elle-même à la création du compte.
const KEY = 'shakemoi_referrer';
const TTL = 30 * 86400_000;
const USERNAME = /^[a-z0-9._-]{1,40}$/i;

/** L'adresse d'arrivée, figée au chargement (avant toute réécriture). */
export const ENTRY_PATH = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

function fromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('ref');
  if (q && USERNAME.test(q)) return q.toLowerCase();
  const m = window.location.pathname.match(/^\/(?:i|u)\/([^/?#]+)/);
  const id = m ? decodeURIComponent(m[1]) : '';
  return USERNAME.test(id) ? id.toLowerCase() : null;
}

function fromStorage(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    // Ancien format : le pseudo seul.
    if (!raw.startsWith('{')) return USERNAME.test(raw) ? raw : null;
    const { u, at } = JSON.parse(raw);
    if (!USERNAME.test(u) || Date.now() - at > TTL) { localStorage.removeItem(KEY); return null; }
    return u;
  } catch { return null; }
}

/** Le parrain (adresse d'abord, puis stockage) ; l'enregistre au passage. */
export function getReferrer(): string | null {
  const u = fromUrl() || fromStorage();
  if (u) rememberReferrer(u);
  return u;
}

export function rememberReferrer(u: string) {
  if (!USERNAME.test(u)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ u: u.toLowerCase(), at: Date.now() })); } catch { /* navigation privée */ }
}

export function clearReferrer() {
  try { localStorage.removeItem(KEY); } catch { /* rien */ }
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('ref')) {
    const u = new URL(window.location.href);
    u.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  }
}

/** Ajoute ?ref=<parrain> à une adresse (si on en a un et qu'il n'y est pas déjà). */
export function withRef(path: string, ref = getReferrer()): string {
  if (!ref) return path;
  const u = new URL(path, 'https://x.invalid');
  if (!u.searchParams.has('ref')) u.searchParams.set('ref', ref);
  return u.pathname + u.search + u.hash;
}

// --- Navigateurs intégrés aux applis (Instagram, Facebook, TikTok…) -----------
// Ils ne partagent ni session ni stockage avec le vrai navigateur, et certains
// effacent tout à la fermeture : on propose d'en sortir, adresse comprise.
const IN_APP: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/musical_ly|TikTok|Bytedance/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Twitter|XApp/i, 'X'],
];

export function inAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): { app: string; os: 'android' | 'ios' | 'other' } | null {
  const hit = IN_APP.find(([re]) => re.test(ua));
  if (!hit) return null;
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other';
  return { app: hit[1], os };
}

/** Lien qui ouvre la même adresse dans Chrome (Android), invitation comprise. */
export function chromeIntent(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}
