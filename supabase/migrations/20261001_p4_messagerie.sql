-- Lot 4 — messagerie : privée et cercles ont exactement les mêmes possibilités.
-- P27 répondre à un message, P12 retirer (« Message retiré » chez tout le monde),
-- P9 likes de messages privés comptés comme ceux des cercles, « Vu » / « Vu par »,
-- sourdine (P12-6), pastille Messages = conversations + cercles non lus (P26),
-- @mention signalée sur le cercle (P28).

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.circle_messages(id) ON DELETE SET NULL;
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Likes de messages privés : compteur tenu par la base, comme les cercles (M11-1).
CREATE OR REPLACE FUNCTION public.recount_message_likes(p_message uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE messages SET likes_count = (SELECT count(*) FROM message_likes WHERE message_id = p_message) WHERE id = p_message;
$$;
CREATE OR REPLACE FUNCTION public.update_message_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM recount_message_likes(CASE WHEN TG_OP = 'DELETE' THEN OLD.message_id ELSE NEW.message_id END);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.recount_message_likes(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_message_like_counts() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trigger_message_like_counts ON public.message_likes;
CREATE TRIGGER trigger_message_like_counts AFTER INSERT OR DELETE ON public.message_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_message_like_counts();
-- Un même like ne compte qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS message_likes_message_user_key ON public.message_likes (message_id, user_id);

-- Retirer un message (P12) : l'auteur, ou le créateur du cercle (modération).
-- Le contenu est effacé, la bulle devient « Message retiré » chez tout le monde
-- (et dans les citations). Renvoie l'adresse de la photo pour la supprimer.
CREATE OR REPLACE FUNCTION public.retract_message(p_kind text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_img text;
  v_sender uuid;
  v_circle uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_kind = 'dm' THEN
    SELECT image_url, sender_id INTO v_img, v_sender FROM messages WHERE id = p_id AND deleted_at IS NULL;
    IF v_sender IS NULL THEN RAISE EXCEPTION 'introuvable'; END IF;
    IF v_sender <> uid THEN RAISE EXCEPTION 'Seul l''auteur peut retirer ce message.'; END IF;
    DELETE FROM message_likes WHERE message_id = p_id;
    UPDATE messages SET text = NULL, track_name = NULL, artist = NULL, cover_url = NULL, track_id = NULL,
      spotify_url = NULL, spotify_embed_url = NULL, apple_music_url = NULL, deezer_url = NULL, youtube_url = NULL,
      youtube_music_url = NULL, tidal_url = NULL, odesli_page_url = NULL, image_url = NULL, preview_url = NULL,
      preview_source = NULL, likes_count = 0, deleted_at = now()
    WHERE id = p_id;
  ELSIF p_kind = 'circle' THEN
    SELECT image_url, sender_id, circle_id INTO v_img, v_sender, v_circle FROM circle_messages WHERE id = p_id AND deleted_at IS NULL AND kind IS NULL;
    IF v_sender IS NULL THEN RAISE EXCEPTION 'introuvable'; END IF;
    IF v_sender <> uid AND NOT EXISTS (SELECT 1 FROM circles WHERE id = v_circle AND created_by = uid) THEN
      RAISE EXCEPTION 'Seuls l''auteur et le créateur du cercle peuvent retirer ce message.';
    END IF;
    DELETE FROM circle_message_likes WHERE message_id = p_id;
    UPDATE circle_messages SET text = NULL, track_name = NULL, artist = NULL, cover_url = NULL, track_id = NULL,
      spotify_url = NULL, spotify_embed_url = NULL, apple_music_url = NULL, deezer_url = NULL, youtube_url = NULL,
      youtube_music_url = NULL, tidal_url = NULL, odesli_page_url = NULL, image_url = NULL, preview_url = NULL,
      preview_source = NULL, mentioned_ids = NULL, likes_count = 0, deleted_at = now()
    WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'type inconnu';
  END IF;
  RETURN jsonb_build_object('image_url', v_img, 'own', v_sender = uid);
END $$;
REVOKE ALL ON FUNCTION public.retract_message(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.retract_message(text, uuid) TO authenticated;

-- « Vu à 14:32 » : quand mon interlocuteur a lu notre conversation pour la dernière fois.
CREATE OR REPLACE FUNCTION public.get_dm_partner_read(p_partner uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT last_read_at FROM conversation_reads WHERE user_id = p_partner AND partner_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_dm_partner_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dm_partner_read(uuid) TO authenticated;

-- « Vu par 3 » : dernière lecture de chaque membre (membres seulement).
CREATE OR REPLACE FUNCTION public.get_circle_reads(p_circle uuid)
RETURNS TABLE (user_id uuid, username text, display_name text, profile_album_cover_url text, last_read_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.user_id, u.username, u.display_name, u.profile_album_cover_url, r.last_read_at
  FROM circle_members m
  JOIN users_profile u ON u.id = m.user_id
  LEFT JOIN circle_reads r ON r.user_id = m.user_id AND r.circle_id = m.circle_id
  WHERE m.circle_id = p_circle AND public.is_circle_member(p_circle, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.get_circle_reads(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_reads(uuid) TO authenticated;

-- Liste des conversations : + sourdine, + « Message retiré ».
DROP FUNCTION IF EXISTS public.get_conversations();
CREATE FUNCTION public.get_conversations()
RETURNS TABLE(partner_id uuid, partner jsonb, last_message jsonb, unread_count bigint, muted boolean)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH mine AS (
    SELECT m.*, CASE WHEN m.sender_id = auth.uid() THEN m.receiver_id ELSE m.sender_id END AS other_id
    FROM messages m
    WHERE m.sender_id = auth.uid() OR m.receiver_id = auth.uid()
  ),
  last AS (
    SELECT DISTINCT ON (other_id) * FROM mine ORDER BY other_id, created_at DESC
  )
  SELECT
    l.other_id,
    jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                       'profile_album_cover_url', u.profile_album_cover_url),
    jsonb_build_object('id', l.id, 'sender_id', l.sender_id, 'receiver_id', l.receiver_id,
                       'text', l.text, 'track_name', l.track_name, 'image_url', l.image_url,
                       'story_id', l.story_id, 'created_at', l.created_at, 'deleted_at', l.deleted_at),
    (SELECT count(*) FROM mine x
      WHERE x.other_id = l.other_id AND x.receiver_id = auth.uid() AND x.deleted_at IS NULL
        AND x.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
    EXISTS (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = auth.uid() AND cm.kind = 'dm' AND cm.target_id = l.other_id)
  FROM last l
  JOIN users_profile u ON u.id = l.other_id
  LEFT JOIN conversation_reads r ON r.user_id = auth.uid() AND r.partner_id = l.other_id
  ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_conversations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;

-- Mes cercles : + sourdine, + « on t'a mentionné » non lu.
DROP FUNCTION IF EXISTS public.get_my_circles();
CREATE FUNCTION public.get_my_circles()
RETURNS TABLE (
  id uuid, name text, created_by uuid, invite_code text, created_at timestamptz, photo_url text,
  last_activity_at timestamptz, last_message jsonb, unread_count bigint, member_count bigint,
  muted boolean, has_mention boolean
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.created_by, c.invite_code, c.created_at, c.photo_url,
         coalesce(lm.created_at, c.created_at) AS last_activity_at,
         CASE WHEN lm.id IS NULL THEN NULL ELSE jsonb_build_object(
           'id', lm.id, 'sender_id', lm.sender_id, 'text', lm.text, 'track_name', lm.track_name,
           'image_url', lm.image_url, 'kind', lm.kind, 'created_at', lm.created_at, 'deleted_at', lm.deleted_at,
           'sender_username', u.username) END AS last_message,
         (SELECT count(*) FROM circle_messages x
           WHERE x.circle_id = c.id AND x.sender_id <> auth.uid() AND x.kind IS NULL AND x.deleted_at IS NULL
             AND x.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS unread_count,
         (SELECT count(*) FROM circle_members y WHERE y.circle_id = c.id) AS member_count,
         EXISTS (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = auth.uid() AND cm.kind = 'circle' AND cm.target_id = c.id) AS muted,
         EXISTS (SELECT 1 FROM circle_messages z
           WHERE z.circle_id = c.id AND z.deleted_at IS NULL AND auth.uid() = ANY (z.mentioned_ids)
             AND z.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS has_mention
  FROM circle_members me
  JOIN circles c ON c.id = me.circle_id
  LEFT JOIN circle_reads r ON r.user_id = auth.uid() AND r.circle_id = c.id
  LEFT JOIN LATERAL (
    SELECT m.* FROM circle_messages m WHERE m.circle_id = c.id ORDER BY m.created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN users_profile u ON u.id = lm.sender_id
  WHERE me.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.created_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_circles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_circles() TO authenticated;

-- P26 : pastille Messages = conversations non lues + cercles non lus (hors sourdine ;
-- une @mention compte toujours).
CREATE OR REPLACE FUNCTION public.unread_inbox_count()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'dms', (SELECT count(*) FROM get_conversations() c WHERE c.unread_count > 0 AND NOT c.muted),
    'circles', (SELECT count(*) FROM get_my_circles() g WHERE (g.unread_count > 0 AND NOT g.muted) OR g.has_mention));
$$;
REVOKE ALL ON FUNCTION public.unread_inbox_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unread_inbox_count() TO authenticated;

-- Temps réel : likes de messages (déjà publiés), lectures pour « Vu » via un canal de diffusion côté appli.

-- Supprimer un cercle (P12-10) : créateur seulement. Les posts de cercle
-- n'ont pas de suppression en cascade : on les retire d'abord.
CREATE OR REPLACE FUNCTION public.delete_circle(p_circle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = p_circle_id AND created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Seul le créateur peut supprimer ce cercle.';
  END IF;
  DELETE FROM posts WHERE circle_id = p_circle_id;
  DELETE FROM notifications WHERE circle_id = p_circle_id;
  DELETE FROM chat_mutes WHERE kind = 'circle' AND target_id = p_circle_id;
  DELETE FROM circles WHERE id = p_circle_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_circle(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_circle(uuid) TO authenticated;

-- P9 : un like reçu sur un de mes messages allume la pastille Messages (jamais
-- la cloche, A2). Compté à part pour ne pas décaler le séparateur « Non lus ».
DROP FUNCTION IF EXISTS public.unread_inbox_count();
DROP FUNCTION IF EXISTS public.get_conversations();
CREATE FUNCTION public.get_conversations()
RETURNS TABLE(partner_id uuid, partner jsonb, last_message jsonb, unread_count bigint, muted boolean, unread_likes bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH mine AS (
    SELECT m.*, CASE WHEN m.sender_id = auth.uid() THEN m.receiver_id ELSE m.sender_id END AS other_id
    FROM messages m
    WHERE m.sender_id = auth.uid() OR m.receiver_id = auth.uid()
  ),
  last AS (
    SELECT DISTINCT ON (other_id) * FROM mine ORDER BY other_id, created_at DESC
  )
  SELECT
    l.other_id,
    jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                       'profile_album_cover_url', u.profile_album_cover_url),
    jsonb_build_object('id', l.id, 'sender_id', l.sender_id, 'receiver_id', l.receiver_id,
                       'text', l.text, 'track_name', l.track_name, 'image_url', l.image_url,
                       'story_id', l.story_id, 'created_at', l.created_at, 'deleted_at', l.deleted_at),
    (SELECT count(*) FROM mine x
      WHERE x.other_id = l.other_id AND x.receiver_id = auth.uid() AND x.deleted_at IS NULL
        AND x.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
    EXISTS (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = auth.uid() AND cm.kind = 'dm' AND cm.target_id = l.other_id),
    (SELECT count(*) FROM message_likes ml JOIN messages mm ON mm.id = ml.message_id
      WHERE mm.sender_id = auth.uid() AND mm.receiver_id = l.other_id AND ml.user_id = l.other_id
        AND ml.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz))
  FROM last l
  JOIN users_profile u ON u.id = l.other_id
  LEFT JOIN conversation_reads r ON r.user_id = auth.uid() AND r.partner_id = l.other_id
  ORDER BY greatest(l.created_at, coalesce((SELECT max(ml.created_at) FROM message_likes ml JOIN messages mm ON mm.id = ml.message_id
             WHERE mm.sender_id = auth.uid() AND mm.receiver_id = l.other_id AND ml.user_id = l.other_id), l.created_at)) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_conversations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_circles();
CREATE FUNCTION public.get_my_circles()
RETURNS TABLE (
  id uuid, name text, created_by uuid, invite_code text, created_at timestamptz, photo_url text,
  last_activity_at timestamptz, last_message jsonb, unread_count bigint, member_count bigint,
  muted boolean, has_mention boolean, unread_likes bigint
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.created_by, c.invite_code, c.created_at, c.photo_url,
         coalesce(lm.created_at, c.created_at) AS last_activity_at,
         CASE WHEN lm.id IS NULL THEN NULL ELSE jsonb_build_object(
           'id', lm.id, 'sender_id', lm.sender_id, 'text', lm.text, 'track_name', lm.track_name,
           'image_url', lm.image_url, 'kind', lm.kind, 'created_at', lm.created_at, 'deleted_at', lm.deleted_at,
           'sender_username', u.username) END AS last_message,
         (SELECT count(*) FROM circle_messages x
           WHERE x.circle_id = c.id AND x.sender_id <> auth.uid() AND x.kind IS NULL AND x.deleted_at IS NULL
             AND x.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS unread_count,
         (SELECT count(*) FROM circle_members y WHERE y.circle_id = c.id) AS member_count,
         EXISTS (SELECT 1 FROM chat_mutes cm WHERE cm.user_id = auth.uid() AND cm.kind = 'circle' AND cm.target_id = c.id) AS muted,
         EXISTS (SELECT 1 FROM circle_messages z
           WHERE z.circle_id = c.id AND z.deleted_at IS NULL AND auth.uid() = ANY (z.mentioned_ids)
             AND z.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS has_mention,
         (SELECT count(*) FROM circle_message_likes ml JOIN circle_messages mm ON mm.id = ml.message_id
           WHERE mm.circle_id = c.id AND mm.sender_id = auth.uid() AND ml.user_id <> auth.uid()
             AND ml.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS unread_likes
  FROM circle_members me
  JOIN circles c ON c.id = me.circle_id
  LEFT JOIN circle_reads r ON r.user_id = auth.uid() AND r.circle_id = c.id
  LEFT JOIN LATERAL (
    SELECT m.* FROM circle_messages m WHERE m.circle_id = c.id ORDER BY m.created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN users_profile u ON u.id = lm.sender_id
  WHERE me.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.created_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_circles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_circles() TO authenticated;

CREATE FUNCTION public.unread_inbox_count()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'dms', (SELECT count(*) FROM get_conversations() c WHERE (c.unread_count > 0 OR c.unread_likes > 0) AND NOT c.muted),
    'circles', (SELECT count(*) FROM get_my_circles() g WHERE ((g.unread_count > 0 OR g.unread_likes > 0) AND NOT g.muted) OR g.has_mention));
$$;
REVOKE ALL ON FUNCTION public.unread_inbox_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unread_inbox_count() TO authenticated;
