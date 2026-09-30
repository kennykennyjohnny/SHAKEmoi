// SHAKEMOI - Dessin des images d'aperçu (1200×630), une mise en page par type.
// Arbre d'éléments au format satori (ce que consomme @vercel/og), écrit sans
// JSX pour ne dépendre d'aucune config de compilation côté fonctions.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CardData } from './links.js';
import { SLOGANS } from '../../src/lib/brand.js';

/** Logos de la marque, en data URI (voir loadAssets). */
export interface Assets { icon: string; logo: string }

type Style = Record<string, string | number>;
type Child = El | string | null | false | undefined;
interface El { type: string; props: Record<string, unknown>; key: null }

function h(type: string, style: Style, ...children: Child[]): El {
  const kids = children.filter((c): c is El | string => c !== null && c !== false && c !== undefined);
  return { type, key: null, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}

function img(src: string, style: Style): El {
  return { type: 'img', key: null, props: { src, style } };
}

// Palette DA (fond toujours sombre, dégradé violet → magenta en signature).
const C = {
  void: '#0A0614',
  deep: '#1B1033',
  stroke: '#2A1B4A',
  violet: '#7B2CBF',
  magenta: '#E91E80',
  neon: '#C77DFF',
  text: '#F5F0FF',
  text2: '#CFC3E8',
  muted: '#8B7FA8',
};
const GRADIENT = `linear-gradient(135deg, ${C.violet} 0%, ${C.magenta} 100%)`;

export const WIDTH = 1200;
export const HEIGHT = 630;

function clip(s: string, max: number) {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Taille du titre selon sa longueur, pour qu'il tienne sur deux lignes.
function titleSize(s: string, big: number, small: number) {
  return s.length > 38 ? small : s.length > 22 ? Math.round((big + small) / 2) : big;
}

function frame(a: Assets, content: El, opts: { footer?: boolean } = {}): El {
  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      flexDirection: 'column',
      backgroundColor: C.void,
      backgroundImage: `radial-gradient(circle at 12% 0%, rgba(123,44,191,0.45) 0%, rgba(10,6,20,0) 55%), radial-gradient(circle at 100% 100%, rgba(233,30,128,0.30) 0%, rgba(10,6,20,0) 50%)`,
      fontFamily: 'Manrope',
      color: C.text,
      padding: '56px 64px',
    },
    h('div', { flex: 1, width: '100%' }, content),
    opts.footer !== false &&
      h(
        'div',
        { alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 28 },
        h(
          'div',
          { alignItems: 'center', gap: 16 },
          img(a.icon, { width: 52, height: 52, borderRadius: 14 }),
          img(a.logo, { width: 220, height: 34 }),
        ),
        h('div', { fontSize: 26, color: C.muted, fontWeight: 600 }, 'shakemoi.fr'),
      ),
  );
}

// Visuel carré : image si dispo, sinon aplat dégradé avec une initiale.
// Images choisies par les utilisateurs : seulement nos stockages et les CDN
// des plateformes (le serveur les télécharge : pas de relais vers n'importe où).
const SAFE_IMG = /^https:\/\/(vbjmhtwrfboqziwibsut\.supabase\.co\/storage\/v1\/object\/public\/|i\.scdn\.co\/|([a-z0-9-]+\.)*dzcdn\.net\/|([a-z0-9-]+\.)*mzstatic\.com\/|i\.ytimg\.com\/|(www\.)?shakemoi\.fr\/)/i;
const safe = (src: string | null) => (src && SAFE_IMG.test(src) ? src : null);

function tile(rawSrc: string | null, label: string, size: number, radius: number): El {
  const src = safe(rawSrc);
  if (src) {
    return img(src, {
      width: size,
      height: size,
      borderRadius: radius,
      objectFit: 'cover',
      boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
    });
  }
  return h(
    'div',
    {
      width: size,
      height: size,
      borderRadius: radius,
      backgroundImage: GRADIENT,
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Bricolage',
      fontSize: Math.round(size * 0.45),
      color: C.text,
    },
    (label.trim()[0] || 'S').toUpperCase(),
  );
}

function eyebrow(text: string): El {
  return h('div', { fontSize: 24, fontWeight: 800, letterSpacing: 4, color: C.neon, textTransform: 'uppercase' }, text);
}

function pill(text: string): El {
  return h(
    'div',
    {
      alignSelf: 'flex-start',
      padding: '12px 26px',
      borderRadius: 999,
      backgroundImage: GRADIENT,
      fontSize: 28,
      fontWeight: 800,
      color: C.text,
    },
    text,
  );
}

function songCard(d: Extract<CardData, { kind: 'song' }>, a: Assets): El {
  const title = clip(d.title, 60);
  return frame(
    a,
    h(
      'div',
      { alignItems: 'center', gap: 56, width: '100%' },
      tile(d.cover, d.title, 420, 28),
      h(
        'div',
        { flexDirection: 'column', flex: 1, gap: 18 },
        eyebrow('Un son pour toi'),
        h('div', { fontFamily: 'Bricolage', fontSize: titleSize(title, 76, 56), lineHeight: 1.05 }, title),
        d.artist && h('div', { fontSize: 36, fontWeight: 600, color: C.text2 }, clip(d.artist, 48)),
        d.by && h('div', { marginTop: 14 }, pill(`partagé par @${clip(d.by, 24)}`)),
      ),
    ),
  );
}

function stat(value: number, label: string): El {
  return h(
    'div',
    { flexDirection: 'column', gap: 2 },
    h('div', { fontFamily: 'Bricolage', fontSize: 64 }, String(value)),
    h('div', { fontSize: 26, fontWeight: 600, color: C.muted }, label),
  );
}

function avatar(rawSrc: string | null, label: string, size: number): El {
  const src = safe(rawSrc);
  return h(
    'div',
    { width: size + 16, height: size + 16, borderRadius: 999, backgroundImage: GRADIENT, alignItems: 'center', justifyContent: 'center' },
    src
      ? img(src, { width: size, height: size, borderRadius: 999, objectFit: 'cover', border: `8px solid ${C.void}` })
      : h(
          'div',
          {
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: C.deep,
            border: `8px solid ${C.void}`,
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Bricolage',
            fontSize: Math.round(size * 0.42),
          },
          (label.trim()[0] || 'S').toUpperCase(),
        ),
  );
}

function profileCard(d: Extract<CardData, { kind: 'profile' }>, a: Assets): El {
  const name = clip(d.name, 28);
  return frame(
    a,
    h(
      'div',
      { alignItems: 'center', gap: 60, width: '100%' },
      avatar(d.avatar, d.name, 340),
      h(
        'div',
        { flexDirection: 'column', flex: 1, gap: 10 },
        h('div', { fontFamily: 'Bricolage', fontSize: titleSize(name, 80, 60), lineHeight: 1.05 }, name),
        h('div', { fontSize: 34, fontWeight: 600, color: C.neon }, `@${clip(d.username, 30)}`),
        h(
          'div',
          { gap: 56, marginTop: 30 },
          stat(d.songs, d.songs > 1 ? 'sons partagés' : 'son partagé'),
          stat(d.followers, d.followers > 1 ? 'abonnés' : 'abonné'),
        ),
      ),
    ),
  );
}

function circleCard(d: Extract<CardData, { kind: 'circle' }>, a: Assets): El {
  const name = clip(d.name, 40);
  return frame(
    a,
    h(
      'div',
      { alignItems: 'center', gap: 56, width: '100%' },
      tile(d.photo, d.name, 380, 190),
      h(
        'div',
        { flexDirection: 'column', flex: 1, gap: 18 },
        eyebrow('Cercle'),
        h('div', { fontFamily: 'Bricolage', fontSize: titleSize(name, 84, 60), lineHeight: 1.05 }, name),
        h('div', { marginTop: 10 }, pill(`${d.members} ${d.members > 1 ? 'membres' : 'membre'}`)),
      ),
    ),
  );
}

function inviteCard(d: Extract<CardData, { kind: 'invite' }>, a: Assets): El {
  const where = d.circle ? `dans le cercle ${clip(d.circle, 30)}` : 'sur SHAKEmoi';
  return frame(
    a,
    h(
      'div',
      { alignItems: 'center', gap: 60, width: '100%' },
      avatar(d.avatar, d.username, 300),
      h(
        'div',
        { flexDirection: 'column', flex: 1, gap: 8 },
        h('div', { fontFamily: 'Bricolage', fontSize: 64, color: C.neon, lineHeight: 1.05 }, `@${clip(d.username, 22)}`),
        h('div', { fontFamily: 'Bricolage', fontSize: d.circle ? 60 : 72, lineHeight: 1.08 }, `t'invite ${where}`),
      ),
    ),
  );
}

function centered(a: Assets, title: string, subtitle: string, icon: El): El {
  return frame(
    a,
    h(
      'div',
      { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 28 },
      icon,
      h('div', { fontFamily: 'Bricolage', fontSize: 72, textAlign: 'center', lineHeight: 1.05 }, title),
      h('div', { fontSize: 32, fontWeight: 600, color: C.text2, textAlign: 'center' }, subtitle),
    ),
  );
}

// Bulle de message dessinée en CSS (pas d'emoji dans les visuels).
function bubble(): El {
  return h(
    'div',
    { width: 150, height: 120, borderRadius: 40, backgroundImage: GRADIENT, alignItems: 'center', justifyContent: 'center', gap: 16 },
    h('div', { width: 20, height: 20, borderRadius: 999, backgroundColor: C.text }),
    h('div', { width: 20, height: 20, borderRadius: 999, backgroundColor: C.text }),
    h('div', { width: 20, height: 20, borderRadius: 999, backgroundColor: C.text }),
  );
}

function homeCard(a: Assets): El {
  return frame(
    a,
    h(
      'div',
      { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 26 },
      img(a.icon, { width: 170, height: 170, borderRadius: 42, border: `2px solid ${C.stroke}` }),
      img(a.logo, { width: 500, height: 77 }),
      h('div', { fontFamily: 'Bricolage', fontSize: 58, marginTop: 10, color: C.text }, SLOGANS[0]),
      h('div', { fontSize: 32, fontWeight: 600, color: C.neon }, SLOGANS[1]),
    ),
    { footer: false },
  );
}

export function renderCard(card: CardData, a: Assets): El {
  switch (card.kind) {
    case 'song': return songCard(card, a);
    case 'profile': return profileCard(card, a);
    case 'circle': return circleCard(card, a);
    case 'invite': return inviteCard(card, a);
    case 'conversation': return centered(a, 'Rejoins la conversation', 'Ouvre SHAKEmoi pour lire les messages.', bubble());
    default: return homeCard(a);
  }
}

/**
 * Polices et logos des images, lus dans public/ (embarqué avec la fonction via
 * `includeFiles` dans vercel.json). Les logos passent en data URI : satori n'a
 * alors plus rien à télécharger.
 */
export async function loadAssets() {
  const get = (path: string) => readFile(join(process.cwd(), 'public', path));
  const dataUri = async (path: string) => `data:image/png;base64,${(await get(path)).toString('base64')}`;
  const [bricolage, manrope600, manrope800, icon, logo] = await Promise.all([
    get('/fonts/bricolage-800.woff'),
    get('/fonts/manrope-600.woff'),
    get('/fonts/manrope-800.woff'),
    dataUri('/favicon.png'),
    dataUri('/shakemoi-logo.png'),
  ]);
  return {
    assets: { icon, logo } as Assets,
    fonts: [
      { name: 'Bricolage', data: bricolage, weight: 800 as const, style: 'normal' as const },
      { name: 'Manrope', data: manrope600, weight: 600 as const, style: 'normal' as const },
      { name: 'Manrope', data: manrope800, weight: 800 as const, style: 'normal' as const },
    ],
  };
}
