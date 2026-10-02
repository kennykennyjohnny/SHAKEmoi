// SHAKEMOI — notifications push (P7), même appli fermée.
//
// Appelée par la base (déclencheurs → pg_net) à chaque nouvelle notification
// de la cloche, message privé, message de cercle et like de message. Elle
// choisit le ou les destinataires, respecte leurs réglages (P6/D5) et les
// conversations en sourdine, puis envoie à chacun de leurs appareils.
// Les abonnements expirés (404/410) sont supprimés.
//
// Sécurité : pas de JWT (appel serveur à serveur), mais un secret partagé
// rangé dans le coffre Supabase (Vault), jamais dans le code. Les clés VAPID
// sont générées ici une seule fois et rangées dans le même coffre.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateVapidKeys, sendPush, type VapidKeys } from './webpush.ts';

const SUBJECT = 'mailto:contact@shakemoi.fr';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Prefs = Record<string, boolean>;
interface Push {
  userId: string;
  pref: string;               // clé du réglage (likes, comments, messages…)
  title: string;
  body: string;
  url: string;                // /?open=<cible>
  tag: string;                // même tag = la notif remplace la précédente (regroupement)
  mute?: { kind: 'dm' | 'circle'; id: string };
  forceThroughMute?: boolean; // @mention : passe même en sourdine (P28)
  force?: boolean;            // affichée même si l'appli est à l'écran (test)
}

let config: { hookSecret: string; vapid: VapidKeys | null } | null = null;
async function getConfig() {
  if (config) return config;
  const { data, error } = await db.rpc('push_internal_config');
  if (error) throw error;
  config = { hookSecret: data.hook_secret, vapid: data.vapid || null };
  return config;
}

async function ensureVapid(): Promise<VapidKeys> {
  const c = await getConfig();
  if (c.vapid) return c.vapid;
  const keys = await generateVapidKeys();
  // La base garde la première paire enregistrée (aucun écrasement possible).
  const { data, error } = await db.rpc('push_store_vapid', { p_keys: keys });
  if (error) throw error;
  c.vapid = data as VapidKeys;
  return c.vapid;
}

const at = (u?: string | null) => (u ? `@${u}` : 'Quelqu’un');
const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function usernames(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await db.from('users_profile').select('id, username').in('id', uniq);
  return Object.fromEntries((data || []).map((u: any) => [u.id, u.username]));
}

function messageBody(m: any): string {
  if (m.track_name) return `🎵 ${m.track_name}${m.artist ? ` — ${m.artist}` : ''}`;
  if (m.image_url) return /\.gif|giphy|klipy|tenor/i.test(m.image_url) ? 'GIF' : '📷 Photo';
  return clip(m.text || '');
}

// ---------- Construction des notifications selon l'évènement ----------

async function fromNotification(n: any, old: any | null): Promise<Push[]> {
  // A2 : tout ce qui passe par les messages a sa propre notif (table messages).
  if (['message', 'song_share', 'story_comment', 'circle_post'].includes(n.type)) return [];
  // M10 : un like de story déjà notifié est mis à jour → on ne renvoie que si
  // une nouvelle personne s'ajoute.
  if (old && (n.type !== 'story_like' || n.is_read || (old.actor_ids || []).length >= (n.actor_ids || []).length)) return [];
  if (n.from_user_id && n.from_user_id === n.user_id) return [];

  const names = await usernames([n.from_user_id]);
  const who = at(names[n.from_user_id]);
  let track = '';
  if (n.post_id) {
    const { data } = await db.from('posts').select('track_name, is_reshake, original_post_id').eq('id', n.post_id).maybeSingle();
    if (data?.track_name) track = ` « ${clip(data.track_name, 40)} »`;
  }
  const post = (pref: string, text: string): Push => ({
    userId: n.user_id, pref, title: 'SHAKEmoi', body: `${who} ${text}${track}`,
    url: `/?open=post:${n.post_id}`, tag: `${n.type}-${n.post_id}-${n.from_user_id}`,
  });
  switch (n.type) {
    case 'like': return n.post_id ? [post('likes', 'a aimé ton shake')] : [];
    case 'comment': return n.post_id ? [post('comments', 'a commenté ton shake')] : [];
    case 'music_reaction': return n.post_id ? [post('comments', 'a répondu en musique à ton shake')] : [];
    case 'comment_like': return n.post_id ? [post('likes', 'a aimé ton commentaire sur')] : [];
    case 'reshake': return n.post_id ? [post('reshakes', 'a reshaké ton shake')] : [];
    case 'follow':
    case 'feel':
      return [{ userId: n.user_id, pref: 'follows', title: 'SHAKEmoi', body: `${who} s’est abonné·e à toi`,
        url: `/?open=profile:${n.from_user_id}`, tag: `follow-${n.from_user_id}` }];
    case 'invite_joined':
      return [{ userId: n.user_id, pref: 'follows', title: 'SHAKEmoi', body: `${who} a rejoint SHAKEmoi grâce à toi 🎉`,
        url: `/?open=profile:${n.from_user_id}`, tag: `invite-${n.from_user_id}` }];
    case 'story_like': {
      const others = Math.max(0, (n.actor_ids || []).length - 1);
      return [{ userId: n.user_id, pref: 'likes', title: 'SHAKEmoi',
        body: others > 0 ? `${who} et ${others} autre${others > 1 ? 's' : ''} ont aimé ton Shake éphémère` : `${who} a aimé ton Shake éphémère`,
        url: `/?open=story:${n.story_id}`, tag: `story_like-${n.story_id}` }];
    }
    case 'circle_join':
    case 'circle_add':
    case 'circle_invite': {
      const { data: c } = await db.from('circles').select('name').eq('id', n.circle_id).maybeSingle();
      const text = n.type === 'circle_join' ? 'a rejoint ton cercle' : 't’a ajouté·e au cercle';
      return [{ userId: n.user_id, pref: 'circles', title: 'SHAKEmoi', body: `${who} ${text}${c?.name ? ` « ${c.name} »` : ''}`,
        url: `/?open=circle:${n.circle_id}`, tag: `${n.type}-${n.circle_id}` }];
    }
    default:
      return [];
  }
}

async function fromMessage(m: any): Promise<Push[]> {
  if (!m.receiver_id || m.receiver_id === m.sender_id) return [];
  const names = await usernames([m.sender_id]);
  const body = m.story_id ? `A répondu à ton Shake éphémère : ${messageBody(m)}` : messageBody(m);
  return [{ userId: m.receiver_id, pref: 'messages', title: at(names[m.sender_id]), body,
    url: `/?open=dm:${m.sender_id}`, tag: `dm-${m.sender_id}`, mute: { kind: 'dm', id: m.sender_id } }];
}

async function fromCircleMessage(m: any): Promise<Push[]> {
  if (m.kind) return [];
  const [{ data: circle }, { data: members }, names] = await Promise.all([
    db.from('circles').select('name').eq('id', m.circle_id).maybeSingle(),
    db.from('circle_members').select('user_id').eq('circle_id', m.circle_id),
    usernames([m.sender_id]),
  ]);
  const who = at(names[m.sender_id]);
  const mentioned = new Set<string>(m.mentioned_ids || []);
  const name = circle?.name || 'Cercle';
  return (members || [])
    .map((x: any) => x.user_id as string)
    .filter((uid) => uid !== m.sender_id)
    .map((uid) => mentioned.has(uid)
      ? { userId: uid, pref: 'circles', title: name, body: `${who} t’a mentionné·e : ${messageBody(m)}`,
          url: `/?open=circle:${m.circle_id}`, tag: `mention-${m.id}`, forceThroughMute: true }
      : { userId: uid, pref: 'circles', title: name, body: `${who} : ${messageBody(m)}`,
          url: `/?open=circle:${m.circle_id}`, tag: `circle-${m.circle_id}`, mute: { kind: 'circle' as const, id: m.circle_id } });
}

async function fromMessageLike(l: any, circle: boolean): Promise<Push[]> {
  const table = circle ? 'circle_messages' : 'messages';
  const { data: m } = await db.from(table).select('*').eq('id', l.message_id).maybeSingle();
  if (!m || m.sender_id === l.user_id) return [];
  const names = await usernames([l.user_id]);
  const who = at(names[l.user_id]);
  if (circle) {
    const { data: c } = await db.from('circles').select('name').eq('id', m.circle_id).maybeSingle();
    return [{ userId: m.sender_id, pref: 'circles', title: c?.name || 'Cercle', body: `${who} a aimé ton message : ${messageBody(m)}`,
      url: `/?open=circle:${m.circle_id}`, tag: `msglike-${m.id}`, mute: { kind: 'circle', id: m.circle_id } }];
  }
  return [{ userId: m.sender_id, pref: 'messages', title: who, body: `A aimé ton message : ${messageBody(m)}`,
    url: `/?open=dm:${l.user_id}`, tag: `msglike-${m.id}`, mute: { kind: 'dm', id: l.user_id } }];
}

// ---------- Envoi ----------

async function deliver(pushes: Push[]) {
  if (!pushes.length) return { sent: 0, removed: 0, skipped: 0 };
  const userIds = [...new Set(pushes.map((p) => p.userId))];
  const [{ data: subs }, { data: settings }, { data: mutes }] = await Promise.all([
    db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
    db.from('user_settings').select('user_id, notif_prefs').in('user_id', userIds),
    db.from('chat_mutes').select('user_id, kind, target_id').in('user_id', userIds),
  ]);
  if (!subs?.length) return { sent: 0, removed: 0, skipped: pushes.length };
  const prefsOf = new Map<string, Prefs>((settings || []).map((s: any) => [s.user_id, s.notif_prefs || {}]));
  const muted = new Set((mutes || []).map((x: any) => `${x.user_id}:${x.kind}:${x.target_id}`));
  const vapid = await ensureVapid();

  let sent = 0, removed = 0, skipped = 0;
  await Promise.all(pushes.map(async (p) => {
    if (prefsOf.get(p.userId)?.[p.pref] === false) { skipped++; return; }
    if (p.mute && !p.forceThroughMute && muted.has(`${p.userId}:${p.mute.kind}:${p.mute.id}`)) { skipped++; return; }
    const payload = { title: p.title, body: p.body, url: p.url, tag: p.tag, force: !!p.force };
    await Promise.all((subs || []).filter((s: any) => s.user_id === p.userId).map(async (s: any) => {
      try {
        const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid, { subject: SUBJECT, topic: p.tag });
        if (r.ok) { sent++; return; }
        if (r.gone) { removed++; await db.from('push_subscriptions').delete().eq('id', s.id); return; }
        console.error('push refusé', r.status, r.text);
      } catch (e) {
        console.error('push erreur', String(e));
      }
    }));
  }));
  return { sent, removed, skipped };
}

// Appels depuis l'appli (notif de test, mise en route) : CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    // Mise en route : crée les clés VAPID si besoin et renvoie la clé PUBLIQUE.
    if (body.action === 'setup') {
      const v = await ensureVapid();
      return json({ publicKey: v.publicKey });
    }
    // Notif de test, envoyée à soi-même seulement (personne connectée, P6).
    if (body.action === 'test') {
      const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = await db.auth.getUser(jwt);
      if (!u?.user) return json({ error: 'unauthorized' }, 401);
      return json(await deliver([{ userId: u.user.id, pref: '_test', title: 'SHAKEmoi',
        body: 'C’est activé ! Tes notifications arriveront ici, même appli fermée 🎧', url: '/?open=notifications:1', tag: 'test', force: true }]));
    }
    const cfg = await getConfig();
    if (!cfg.hookSecret || req.headers.get('x-push-secret') !== cfg.hookSecret) {
      return new Response('forbidden', { status: 403 });
    }
    // Rappel de série (P22) ou envoi direct préparé par la base.
    if (body.action === 'direct' && Array.isArray(body.pushes)) {
      return json(await deliver(body.pushes as Push[]));
    }
    const { table, record, old } = body;
    let pushes: Push[] = [];
    if (table === 'notifications') pushes = await fromNotification(record, old || null);
    else if (table === 'messages') pushes = await fromMessage(record);
    else if (table === 'circle_messages') pushes = await fromCircleMessage(record);
    else if (table === 'message_likes') pushes = await fromMessageLike(record, false);
    else if (table === 'circle_message_likes') pushes = await fromMessageLike(record, true);
    return json(await deliver(pushes));
  } catch (e) {
    console.error('push', String(e));
    return new Response('error', { status: 500 });
  }
});
