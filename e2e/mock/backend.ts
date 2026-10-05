// Banc d'essai « connecté » sans compte de test (section Q).
//
// L'appli tourne en local (vite) avec une adresse Supabase FACTICE
// (https://mock.shakemoi.test) : Playwright intercepte toutes ses requêtes et
// répond avec les données d'exemple ci-dessous. Rien ne part vers la vraie
// base, aucun mot de passe n'est utilisé : la session est une fausse session
// posée dans le stockage du navigateur.
import type { Page, Route } from '@playwright/test';

export const MOCK_HOST = 'https://mock.shakemoi.test';
export const ME = '00000000-0000-4000-8000-000000000001';
export const LEA = '00000000-0000-4000-8000-000000000002';
export const BAPT = '00000000-0000-4000-8000-000000000003';
export const CIRCLE = '00000000-0000-4000-8000-0000000000c1';

const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();

export const profiles: Record<string, any> = {
  [ME]: { id: ME, username: 'testeur', display_name: 'Testeur', bio: '', profile_album_cover_url: null, onboarding_completed_at: iso(10_000), preferred_streaming_app: 'spotify', feels_count: 2, current_streak: 1 },
  [LEA]: { id: LEA, username: 'lea', display_name: 'Léa', bio: 'Rap FR et afro', profile_album_cover_url: null, feels_count: 12, current_streak: 3 },
  [BAPT]: { id: BAPT, username: 'bapt', display_name: 'Bapt', bio: '', profile_album_cover_url: null, feels_count: 8, current_streak: 0 },
};

/** Image servie par le banc (couleur unie), avec un délai pour imiter la 4G. */
export const img = (w: number, h: number, color = '7B2CBF', delay = 0) => `${MOCK_HOST}/img/${w}x${h}/${color}?d=${delay}`;
export const cover = (n: number) => img(300, 300, ['7B2CBF', 'E91E80', '2DD4BF', 'FFB800', 'C4C8D8'][n % 5]);

function dmMessages(partner: string) {
  const list: any[] = [];
  for (let i = 0; i < 40; i++) {
    const mine = i % 3 === 0;
    const m: any = {
      id: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`,
      sender_id: mine ? ME : partner, receiver_id: mine ? partner : ME,
      text: `Message ${i + 1}${i % 7 === 0 ? ' — un peu plus long pour prendre deux lignes dans la bulle de la conversation' : ''}`,
      created_at: iso(400 - i * 10), is_read: true, likes_count: 0, deleted_at: null, reply_to_id: null,
    };
    // Des photos et des sons (pochettes) répartis, dont les DERNIERS messages :
    // ce sont eux qui poussaient la conversation vers le bas en se chargeant (Q13).
    if (i % 9 === 4 || i === 38) { m.text = null; m.image_url = img(800, 1000, 'E91E80', 1200); }
    if (i % 11 === 5 || i === 39) { m.text = null; m.track_name = `Son ${i}`; m.artist = `Artiste ${i}`; m.cover_url = cover(i); m.track_id = null; m.preview_url = `${MOCK_HOST}/audio/m${i}.wav`; }
    list.push(m);
  }
  return list;
}

// Posts : 15 pour Léa, 5 pour moi, 6 pour Bapt (plus récents d'abord).
export const posts: any[] = [];
[[LEA, 15], [ME, 5], [BAPT, 6]].forEach(([uid, n]) => {
  for (let i = 0; i < (n as number); i++) {
    const k = posts.length;
    posts.push({
      id: `00000000-0000-4000-a000-${String(k).padStart(12, '0')}`, user_id: uid, created_at: iso(60 * (k + 1)),
      track_name: `Titre ${k + 1}`, artist: ['Tiakola', 'Aya Nakamura', 'SDM', 'Burna Boy', 'Orelsan'][k % 5],
      cover_url: cover(k), album_cover_url: cover(k), track_id: `trk${k}`, caption: k % 3 ? '' : 'En boucle 🔥',
      likes_count: k % 7, comments_count: k % 4, reshakes_count: 0, is_reshake: false, is_private: false, circle_id: null,
      spotify_url: `https://open.spotify.com/track/trk${k}`, preview_url: null,
      // Q11 : le 6e Shake de Léa est épinglé.
      pinned_at: k === 5 ? iso(5) : null,
    });
  }
});
const withUser = (p: any) => ({ ...p, user: profiles[p.user_id], original_post: null });

// R7 : deux Shakes éphémères de Léa (avec un vrai petit son) et un sans son.
export const stories = [0, 1, 2].map((i) => ({
  id: `00000000-0000-4000-b000-00000000000${i}`, user_id: LEA, created_at: iso(120 - i * 30), expires_at: new Date(Date.now() + 20 * 3600_000).toISOString(),
  track_name: i < 2 ? `Story ${i + 1}` : null, artist: i < 2 ? 'Tiakola' : null, track_id: null, cover_url: i < 2 ? cover(i + 7) : null,
  preview_url: i < 2 ? `${MOCK_HOST}/audio/${i}.wav` : null, image_url: null, text: i === 2 ? 'Sans son' : null, likes_count: 0, is_pinned: false,
  bg_color: '#7B2CBF', user: { id: LEA, username: 'lea', display_name: 'Léa', profile_album_cover_url: null },
}));
/** 3 s de son (un la très doux) : assez pour que le navigateur joue « vraiment ». */
function wav(seconds = 3, rate = 8000) {
  const n = seconds * rate, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(8 * Math.sin((2 * Math.PI * 440 * i) / rate));
  return b;
}

const circle = { id: CIRCLE, name: 'Les potes', created_by: LEA, invite_code: 'ABCD2345', created_at: iso(50_000), photo_url: null };
function circleMessages() {
  return dmMessages(LEA).map((m, i) => ({
    ...m, id: m.id.replace('9000', '9001'), circle_id: CIRCLE, receiver_id: undefined,
    sender_id: m.sender_id === ME ? ME : (i % 2 ? LEA : BAPT), kind: null, mentioned_ids: [],
  }));
}

export interface MockOptions {
  log?: boolean;
  /** Délai ajouté à chaque requête (ms) : ~150 ms ≈ aller-retour en 4G. */
  latency?: number;
  /** Compte les requêtes vers la base (mesures Q5). */
  counter?: { n: number };
  /** Nouveau compte : le tuto s'ouvre au démarrage. */
  newUser?: boolean;
  /** R7 : des Shakes éphémères (Léa) dans la barre. */
  stories?: boolean;
  /** Visiteur sans compte (R8) : pas de session ; /auth/v1/signup en crée une. */
  visitor?: boolean;
  /** Journal des appels (R8) : « rpc nom {corps} », « signup {corps} ». */
  calls?: string[];
}

/** Pose la fausse session et branche la fausse base sur la page. */
export async function mockBackend(page: Page, opts: MockOptions = {}) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', aud: 'authenticated', exp: now + 7200, email: 'testeur@example.test' })}.c2lnbmF0dXJl`;
  const session = {
    access_token: jwt, token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'mock-refresh',
    user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'testeur@example.test', app_metadata: {}, user_metadata: {}, created_at: iso(100_000) },
  };
  await page.addInitScript(([s, visitor]) => {
    try {
      if (!visitor) localStorage.setItem('sb-mock-auth-token', s as string);
      localStorage.setItem('shakemoi_profile_completed', 'true');
      localStorage.setItem('shakemoi_install_dismissed', String(Date.now()));
    } catch { /* rien */ }
  }, [JSON.stringify(session), opts.visitor ? '1' : ''] as const);

  const unhandled = new Set<string>();
  // Relais Vercel (/api/…) : n'existent pas avec vite en local → simulés.
  await page.route('**/api/artists**', async (route: Route) => {
    const u = new URL(route.request().url());
    const names = u.searchParams.get('related') ? ['Gazo', 'Zola', 'Leto', 'Ninho'] : u.searchParams.get('q')
      ? [u.searchParams.get('q')!, 'Tiakola', 'Tayc'] : ['Ninho', 'Aya Nakamura', 'Bad Bunny', 'SZA', 'Taylor Swift', 'David Guetta', 'Arctic Monkeys', 'Tiakola', 'Burna Boy', 'Karol G', 'The Weeknd', 'Angèle'];
    const artists = names.map((n, i) => ({ id: String(1000 + n.length * 37 + i), name: n, picture: img(250, 250, ['7B2CBF', 'E91E80', '2DD4BF', 'FFB800'][i % 4]) }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ artists }) });
  });
  await page.route(`${MOCK_HOST}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body: any, status = 200, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body) });

    if (opts.latency && req.method() !== 'OPTIONS') await new Promise((r) => setTimeout(r, opts.latency));
    if (opts.counter && (p.startsWith('/rest/') || p.startsWith('/functions/'))) opts.counter.n++;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    // Images : SVG de la bonne taille, après un délai éventuel.
    // « /audio/long-… » : 20 s (un son qui ne doit pas finir pendant le test).
    if (p.startsWith('/audio/')) return route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: wav(p.includes('/long-') ? 20 : 3) });
    if (p.startsWith('/img/')) {
      const [, , size, color] = p.split('/');
      const [w, h] = size.split('x').map(Number);
      const d = Number(url.searchParams.get('d') || 0);
      if (d) await new Promise((r) => setTimeout(r, d));
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#${color}"/></svg>` });
    }
    if (p.startsWith('/auth/v1/signup')) {
      opts.calls?.push(`signup ${decodeURIComponent(url.search)} ${JSON.stringify(req.postDataJSON?.() || {})}`);
      return json(session);
    }
    if (p.startsWith('/auth/v1/user')) return json(session.user);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/realtime/')) return route.abort();
    if (p.startsWith('/functions/v1/')) return json({});
    if (p.startsWith('/storage/v1/object/sign')) return json({ signedURL: '/img/400x400/2DD4BF' });

    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const one = (rows: any[]) => single
      ? (rows[0] ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406))
      : json(rows, 200, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
    const eqParam = (k: string) => (url.searchParams.get(k) || '').replace(/^eq\./, '');

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      const body = req.postDataJSON?.() || {};
      opts.calls?.push(`rpc ${fn} ${JSON.stringify(body)}`);
      switch (fn) {
        case 'username_available': return json(true);
        case 'accept_invite': return json(LEA);
        case 'get_invite_card': return json(null);
        case 'get_conversations':
          return json([LEA, BAPT].map((id, i) => ({ partner_id: id, other_id: id, partner: profiles[id], last_message: { ...dmMessages(id)[39 - i], created_at: iso(5 + i * 30) }, unread_count: i === 0 ? 2 : 0, unread_likes: 0, muted: false })));
        case 'get_my_circles':
          return json([{ ...circle, member_count: 3, unread_count: 1, last_activity_at: iso(3), last_message: { ...circleMessages()[39], sender_username: 'lea' }, muted: false, has_mention: false }]);
        case 'unread_inbox_count': return json({ dms: 1, circles: 1 });
        case 'resolve_username': {
          const u = Object.values(profiles).find((x) => x.username === String(body.p_username || '').toLowerCase());
          return json(u ? [{ id: u.id, username: u.username }] : []);
        }
        case 'get_profile_header': {
          const u = body.p_user ? profiles[body.p_user] : Object.values(profiles).find((x) => x.username === body.p_username);
          if (!u) return json(null);
          return json({
            profile: { id: u.id, username: u.username, display_name: u.display_name, bio: u.bio, profile_album_cover_url: u.profile_album_cover_url },
            block: 'none', counts: { shakes: posts.filter((p) => p.user_id === u.id).length, followers: 7, following: 7 },
            is_following: false, follows_me: true,
            mutual: u.id === ME ? null : { users: [{ id: BAPT, username: 'bapt', display_name: 'Bapt', profile_album_cover_url: null }], total: 1 },
            taste: u.id === ME ? null : { status: 'ok', score: 88, families: ['Rap', 'Afro'], artists: ['Tiakola', 'SDM'], close: [] },
            streak: { current: u.current_streak, best: 3, this_week: true, week_ends_at: new Date(Date.now() + 86400000).toISOString() },
            stories: [], pinned_stories: [],
          });
        }
        case 'get_my_recos': {
          const reasons: [string, string][] = [['Parce que tu as shaké Tiakola', 'rel'], ['Aimé par Bapt · 92 % compatibles', 'social'], ['Dans ton style Afro', 'style'],
            ['Plus de Tiakola', 'top'], ['Pour sortir de ta bulle · Électro', 'explore'], ['Nouveauté Rap', 'fresh'], ['Léa écoute Gazo · 88 % compatibles', 'crowd'], ['Tendance sur SHAKEmoi', 'trend']];
          const titles = ['MELROSE PLACE', 'Coco', 'Djadja', 'Meuda', 'Calm Down', 'Tchikita', 'Pookie', 'Sapés comme jamais', 'Bande organisée', 'Dans la zone', 'Kilos', 'Toucher', 'Sasuke', 'Fendi', 'Ma meilleure ennemie', 'Popcorn salé', 'Lumière', 'Bijou', 'Contrôle', 'Mi Gente'];
          const artistsR = ['Tiakola', 'Burna Boy', 'Aya Nakamura', 'Gazo', 'Rema', 'Jul', 'Aya Nakamura', 'GIMS', 'Jul', 'SDM', 'Ninho', 'Tiakola', 'Werenoi', 'Gazo', 'Stromae', 'Santa', 'Tayc', 'Dadju', 'Zola', 'J Balvin'];
          const s0 = Number(body.p_series || 0);
          return json({ series: s0, generated_at: new Date().toISOString(), items: titles.map((t, i) => ({
            rank: i + 1 + s0 * 20, song_key: `${t.toLowerCase()}|${artistsR[i].toLowerCase()}|${s0}`, reason: reasons[i % reasons.length][0], reason_kind: reasons[i % reasons.length][1],
            track: { title: s0 ? t + ' (série 2)' : t, artist: artistsR[i], cover_url: cover(i), preview_url: img(10, 10), deezer_id: 1000 + i, spotify_url: null, deezer_url: null, post_id: null },
          })) });
        }
        case 'save_artist_picks': return json((body.p_picks || []).length);
        case 'get_weekly_recap':
          return json({ week: 40, start: iso(60 * 24 * 10), end: iso(60 * 24 * 3), shakes: 3, likes: 7, streak: 2, genre: 'Rap', match: null,
            top: [{ id: 'p1', title: 'Meuda', artist: 'Tiakola', cover: cover(1), preview_url: null, track_id: null, spotify_url: null, likes: 4 }] });
        case 'get_taste':
          return json({ status: 'ok', score: 88, families: ['Rap', 'Afro'], artists: ['Tiakola', 'SDM'], close: [], mine: 12, theirs: 15 });
        case 'get_mutual_followers':
          return json([{ id: BAPT, username: 'bapt', display_name: 'Bapt', profile_album_cover_url: null, total: 1 }]);
        case 'get_streak': return json({ current: 1, best: 3, this_week: true });
        default:
          if (opts.log) unhandled.add(`rpc ${fn} ${JSON.stringify(body).slice(0, 80)}`);
          return json(null);
      }
    }

    if (p.startsWith('/rest/v1/')) {
      const table = p.slice('/rest/v1/'.length);
      if (req.method() !== 'GET' && req.method() !== 'HEAD') {
        // Écritures : acceptées et renvoyées telles quelles.
        let body: any = null;
        try { body = req.postDataJSON(); } catch { /* rien */ }
        const row = Array.isArray(body) ? body[0] : body;
        return single ? json({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }) : json(body ? [].concat(body) : []);
      }
      switch (table) {
        case 'users_profile': {
          const id = eqParam('id');
          const inList = (url.searchParams.get('id') || '').match(/^in\.\((.*)\)$/)?.[1]?.split(',').map((x) => x.replace(/"/g, ''));
          if (id === ME && (opts.newUser || opts.visitor)) return one([{ ...profiles[ME], onboarding_completed_at: null }]);
          if (id) return one(profiles[id] ? [profiles[id]] : []);
          if (inList) return one(inList.map((x) => profiles[x]).filter(Boolean));
          const u = eqParam('username') || (url.searchParams.get('username') || '').replace(/^ilike\./, '');
          if (u) return one(Object.values(profiles).filter((x) => x.username === u));
          return one(Object.values(profiles));
        }
        case 'messages': {
          const or = url.searchParams.get('or') || '';
          const partner = [LEA, BAPT].find((x) => or.includes(x)) || LEA;
          if (url.searchParams.get('created_at')?.startsWith('lt.')) return one([]);
          const rows = dmMessages(partner).slice().reverse().map((m) => ({ ...m, sender: profiles[m.sender_id], reply: null, story: null }));
          const id = eqParam('id');
          return one(id ? rows.filter((r) => r.id === id) : rows);
        }
        case 'circle_messages':
          if (url.searchParams.get('created_at')?.startsWith('lt.')) return one([]);
          return one(circleMessages().slice().reverse().map((m) => ({ ...m, sender: profiles[m.sender_id], reply: null })));
        case 'posts': {
          const id = eqParam('id');
          if (id) return one(posts.filter((p) => p.id === id).map(withUser));
          const uid = eqParam('user_id');
          let rows = (uid ? posts.filter((p) => p.user_id === uid) : posts).map(withUser);
          const pin = url.searchParams.get('pinned_at');
          if (pin === 'is.null') rows = rows.filter((p) => !p.pinned_at);
          if (pin === 'not.is.null') rows = rows.filter((p) => p.pinned_at).sort((a, b) => b.pinned_at.localeCompare(a.pinned_at));
          const total = rows.length;
          const off = Number(url.searchParams.get('offset') || 0);
          const lim = Number(url.searchParams.get('limit') || 1000);
          rows = rows.slice(off, off + lim);
          if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${total}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
          return single ? one(rows) : json(rows, 200, { 'content-range': `${off}-${off + rows.length - 1}/${total}`, 'access-control-expose-headers': 'content-range' });
        }
        case 'follows': {
          if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/7', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
          return one([]);
        }
        case 'catalog_tracks':
          return one([['Meuda', 'Tiakola', 'Rap'], ['Djadja', 'Aya Nakamura', 'Afro'], ['Espresso', 'Sabrina Carpenter', 'Pop'], ['Snooze', 'SZA', 'R&B / Soul']]
            .map(([title, artist, fam], i) => ({ title, artist, cover_url: cover(i + 1), preview_url: img(10, 10), sources: { [`chart:${fam}`]: 1 } })));
        case 'circles': return one([circle]);
        case 'stories': return opts.stories ? one(stories) : one([]);
        case 'shake_du_jour': return one([{ id: 'sdj' }]);
        case 'circle_members': return one([ME, LEA, BAPT].map((id) => ({ circle_id: CIRCLE, user_id: id, user: profiles[id], joined_at: iso(1000), role: id === LEA ? 'owner' : 'member' })));
        default:
          if (opts.log) unhandled.add(`GET ${table}?${url.searchParams.toString().slice(0, 80)}`);
          return one([]);
      }
    }
    if (opts.log) unhandled.add(`${req.method()} ${p}`);
    return json({});
  });
  return { unhandled };
}
