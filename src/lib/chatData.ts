// Messagerie : UNE logique pour les messages privés et les cercles (lot 4).
// Mêmes possibilités des deux côtés : envoyer (texte, photo, GIF, son),
// répondre à un message précis (P27), @mentionner (P28, cercles), liker (P9),
// retirer (P12), « Vu », sourdine, lu / non lu (P26).
import { supabase } from './supabase';
import { getOdesliLinks, getSongPreview } from './odesli';
import { compressImage, extFor, privateMediaPath } from './media';

export type ChatKind = 'dm' | 'circle';
export interface ChatRef { kind: ChatKind; id: string } // id = interlocuteur (dm) ou cercle

const TABLE: Record<ChatKind, string> = { dm: 'messages', circle: 'circle_messages' };
const LIKES: Record<ChatKind, string> = { dm: 'message_likes', circle: 'circle_message_likes' };
const REPLY = 'reply:reply_to_id(id, sender_id, text, track_name, artist, cover_url, image_url, deleted_at)';
const SELECT: Record<ChatKind, string> = {
  dm: `*, sender:users_profile!messages_sender_id_fkey(id, username, display_name, profile_album_cover_url),
       story:stories!messages_story_id_fkey(id, image_url, cover_url, track_name, artist), ${REPLY}`,
  circle: `*, sender:users_profile!circle_messages_sender_id_fkey(id, username, display_name, profile_album_cover_url), ${REPLY}`,
};
export const CHAT_PAGE = 50;

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const norm = (m: any) => (m ? { ...m, reply: Array.isArray(m.reply) ? m.reply[0] : m.reply } : m);

/** Les derniers messages (du plus ancien au plus récent) ; `before` = page précédente. */
export async function fetchChatPage(ref: ChatRef, before?: string): Promise<any[]> {
  const me = await myId();
  if (!me) return [];
  let q = supabase.from(TABLE[ref.kind]).select(SELECT[ref.kind]).order('created_at', { ascending: false }).limit(CHAT_PAGE);
  q = ref.kind === 'dm'
    ? q.or(`and(sender_id.eq.${me},receiver_id.eq.${ref.id}),and(sender_id.eq.${ref.id},receiver_id.eq.${me})`)
    : q.eq('circle_id', ref.id);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(norm).reverse();
}

/** Un message complet (expéditeur, citation…), pour le temps réel. */
export async function fetchChatMessage(ref: ChatRef, id: string): Promise<any | null> {
  const { data } = await supabase.from(TABLE[ref.kind]).select(SELECT[ref.kind]).eq('id', id).maybeSingle();
  return norm(data) || null;
}

export interface OutgoingMessage {
  text?: string | null;
  track?: any;
  imageUrl?: string | null;
  replyToId?: string | null;
  mentionedIds?: string[];
}

export async function sendChatMessage(ref: ChatRef, msg: OutgoingMessage): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const me = await myId();
    if (!me) throw new Error('Not authenticated');
    const row: any = {
      sender_id: me,
      text: msg.text?.trim() || null,
      image_url: msg.imageUrl || null,
      reply_to_id: msg.replyToId || null,
    };
    if (ref.kind === 'dm') row.receiver_id = ref.id;
    else {
      row.circle_id = ref.id;
      if (msg.mentionedIds?.length) row.mentioned_ids = msg.mentionedIds;
    }
    const t = msg.track;
    if (t) {
      row.track_name = t.name || t.track_name || t.title;
      row.artist = t.artist;
      row.cover_url = t.cover || t.cover_url || t.coverUrl;
      row.track_id = t.id || t.track_id;
      row.spotify_url = t.spotify_url || t.spotifyUrl || (row.track_id ? `https://open.spotify.com/track/${row.track_id}` : null);
      row.spotify_embed_url = row.track_id ? `https://open.spotify.com/embed/track/${row.track_id}` : null;
      // Liens des plateformes + extrait (M1), pareil en privé et en cercle.
      const meta = { title: row.track_name, artist: row.artist };
      const [links, preview] = await Promise.all([
        getOdesliLinks(row.spotify_url || '', meta).catch(() => ({})),
        getSongPreview(row.spotify_url || row.track_id || '', meta, t.preview_url || t.previewUrl).catch(() => ({})),
      ]);
      Object.assign(row, links, preview);
    }
    const { data, error } = await supabase.from(TABLE[ref.kind]).insert([row]).select(SELECT[ref.kind]).single();
    if (error) throw error;
    return { success: true, data: norm(data) };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}

/** Photo privée : dossier de la conversation (dm/…) ou du cercle, lien signé à l'affichage (B5). */
export async function uploadChatPhoto(ref: ChatRef, file: File): Promise<string | null> {
  const me = await myId();
  if (!me) return null;
  const small = await compressImage(file, 1280);
  const name = ref.kind === 'dm'
    ? `dm/${me}/${ref.id}/${Date.now()}.${extFor(small, file.name)}`
    : `circle-${ref.id}/${Date.now()}.${extFor(small, file.name)}`;
  const { error } = await supabase.storage.from('circle-media').upload(name, small, { cacheControl: '3600', upsert: false, contentType: small.type || undefined });
  if (error) return null;
  return supabase.storage.from('circle-media').getPublicUrl(name).data.publicUrl;
}

export async function likedMessageIds(ref: ChatRef, ids: string[]): Promise<Set<string>> {
  const me = await myId();
  const real = ids.filter((id) => !id.startsWith('temp-'));
  if (!me || !real.length) return new Set();
  const { data } = await supabase.from(LIKES[ref.kind]).select('message_id').eq('user_id', me).in('message_id', real);
  return new Set((data || []).map((d: any) => d.message_id));
}

export async function setMessageLike(ref: ChatRef, messageId: string, like: boolean): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const table = supabase.from(LIKES[ref.kind]);
  const { error } = like
    ? await table.insert([{ message_id: messageId, user_id: me, emoji: '❤️' }])
    : await table.delete().eq('message_id', messageId).eq('user_id', me);
  // Déjà liké (double appareil) : c'est bon quand même.
  return !error || /duplicate/i.test(error.message);
}

export async function messageLikers(ref: ChatRef, messageId: string): Promise<any[]> {
  const { data } = await supabase.from(LIKES[ref.kind])
    .select('user:users_profile!' + (ref.kind === 'dm' ? 'message_likes_user_id_fkey' : 'circle_message_likes_user_id_fkey') + '(id, username, display_name, profile_album_cover_url)')
    .eq('message_id', messageId);
  return (data || []).map((r: any) => r.user).filter(Boolean);
}

/** Retirer (P12) : « Message retiré » chez tout le monde ; ma photo part du stockage. */
export async function retractMessage(ref: ChatRef, messageId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('retract_message', { p_kind: ref.kind, p_id: messageId });
  if (error) return { success: false, error: error.message };
  const path = privateMediaPath(data?.image_url);
  if (path && data?.own) await supabase.storage.from('circle-media').remove([path]).catch(() => {});
  return { success: true };
}

export async function markChatRead(ref: ChatRef) {
  if (ref.kind === 'dm') await supabase.rpc('mark_conversation_read', { p_partner_id: ref.id });
  else await supabase.rpc('mark_circle_read', { p_circle_id: ref.id });
  window.dispatchEvent(new Event('shakemoi:messages-read'));
}

/** « Vu » : quand l'autre a lu (dm) ou la dernière lecture de chaque membre (cercle). */
export async function fetchDmPartnerRead(partnerId: string): Promise<string | null> {
  const { data } = await supabase.rpc('get_dm_partner_read', { p_partner: partnerId });
  return (data as string) || null;
}
export async function fetchCircleReads(circleId: string): Promise<any[]> {
  const { data } = await supabase.rpc('get_circle_reads', { p_circle: circleId });
  return data || [];
}

/** Sourdine (P12-6) : plus de notif push ni de pastille pour cette conversation. */
export async function isChatMuted(ref: ChatRef): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { count } = await supabase.from('chat_mutes').select('target_id', { count: 'exact', head: true })
    .eq('user_id', me).eq('kind', ref.kind).eq('target_id', ref.id);
  return (count ?? 0) > 0;
}
export async function setChatMuted(ref: ChatRef, muted: boolean): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = muted
    ? await supabase.from('chat_mutes').upsert({ user_id: me, kind: ref.kind, target_id: ref.id })
    : await supabase.from('chat_mutes').delete().eq('user_id', me).eq('kind', ref.kind).eq('target_id', ref.id);
  if (!error) window.dispatchEvent(new Event('shakemoi:messages-read'));
  return !error;
}

/** Nom du canal de diffusion (« écrit… », « vu ») : le même pour les deux personnes. */
export function chatChannelKey(ref: ChatRef, me: string): string {
  return ref.kind === 'dm' ? `dm-${[me, ref.id].sort().join('-')}` : `circle-${ref.id}`;
}

/** Aperçu court d'un message (citation, listes). */
export function messageSnippet(m: any): string {
  if (!m) return '';
  if (m.deleted_at) return 'Message retiré';
  if (m.track_name) return `🎵 ${m.track_name}${m.artist ? ` — ${m.artist}` : ''}`;
  if (m.image_url && !m.text) return /\.gif|giphy|klipy|tenor/i.test(m.image_url) ? 'GIF' : '📷 Photo';
  return m.text || '';
}
