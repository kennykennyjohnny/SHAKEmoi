// SHAKEMOI - Dessin des images d'aperçu (1200×630), une mise en page par type.
// Arbre d'éléments au format satori (ce que consomme @vercel/og), écrit sans
// JSX pour ne dépendre d'aucune config de compilation côté fonctions.

import type { CardData } from './links';

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

function frame(origin: string, content: El, opts: { footer?: boolean } = {}): El {
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
          img(`${origin}/favicon.png`, { width: 52, height: 52, borderRadius: 14 }),
          img(`${origin}/shakemoi-logo.png`, { width: 220, height: 34 }),
        ),
        h('div', { fontSize: 26, color: C.muted, fontWeight: 600 }, 'shakemoi.fr'),
      ),
  );
}

// Visuel carré : image si dispo, sinon aplat dégradé avec une initiale.
function tile(src: string | null, label: string, size: number, radius: number): El {
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

function songCard(d: Extract<CardData, { kind: 'song' }>, origin: string): El {
  const title = clip(d.title, 60);
  return frame(
    origin,
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

function avatar(src: string | null, label: string, size: number): El {
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

function profileCard(d: Extract<CardData, { kind: 'profile' }>, origin: string): El {
  const name = clip(d.name, 28);
  return frame(
    origin,
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

function circleCard(d: Extract<CardData, { kind: 'circle' }>, origin: string): El {
  const name = clip(d.name, 40);
  return frame(
    origin,
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

function inviteCard(d: Extract<CardData, { kind: 'invite' }>, origin: string): El {
  const where = d.circle ? `dans le cercle ${clip(d.circle, 30)}` : 'sur SHAKEmoi';
  return frame(
    origin,
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

function centered(origin: string, title: string, subtitle: string, icon: El): El {
  return frame(
    origin,
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

function homeCard(origin: string, tagline: string): El {
  return frame(
    origin,
    h(
      'div',
      { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 36 },
      img(`${origin}/favicon.png`, { width: 200, height: 200, borderRadius: 48, border: `2px solid ${C.stroke}` }),
      img(`${origin}/shakemoi-logo.png`, { width: 560, height: 86 }),
      h('div', { fontSize: 34, fontWeight: 600, color: C.text2, textAlign: 'center' }, tagline),
    ),
    { footer: false },
  );
}

export function renderCard(card: CardData, origin: string, tagline: string): El {
  switch (card.kind) {
    case 'song': return songCard(card, origin);
    case 'profile': return profileCard(card, origin);
    case 'circle': return circleCard(card, origin);
    case 'invite': return inviteCard(card, origin);
    case 'conversation': return centered(origin, 'Rejoins la conversation', 'Ouvre SHAKEmoi pour lire les messages.', bubble());
    default: return homeCard(origin, tagline);
  }
}

/** Polices des images (servies depuis public/fonts). */
export async function loadFonts(origin: string) {
  const get = (f: string) => fetch(`${origin}/fonts/${f}`).then(r => r.arrayBuffer());
  const [bricolage, manrope600, manrope800] = await Promise.all([
    get('bricolage-800.woff'),
    get('manrope-600.woff'),
    get('manrope-800.woff'),
  ]);
  return [
    { name: 'Bricolage', data: bricolage, weight: 800 as const, style: 'normal' as const },
    { name: 'Manrope', data: manrope600, weight: 600 as const, style: 'normal' as const },
    { name: 'Manrope', data: manrope800, weight: 800 as const, style: 'normal' as const },
  ];
}
