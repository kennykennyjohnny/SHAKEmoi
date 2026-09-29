-- LOT 3 — Messages privés (audit C6, C9 + A3 côté base). Idempotent.

-- =====================================================================
-- A3 — Date de dernière lecture par personne et par conversation.
-- La pastille Messages compte les CONVERSATIONS non lues ; ouvrir une
-- conversation la marque lue (ouvrir l'onglet ne remet plus rien à zéro).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id)
);
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_reads_own ON public.conversation_reads;
CREATE POLICY conversation_reads_own ON public.conversation_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Point de départ : tout ce qui était déjà marqué « lu » le reste.
INSERT INTO public.conversation_reads (user_id, partner_id, last_read_at)
SELECT receiver_id, sender_id, max(created_at)
FROM public.messages
WHERE is_read IS TRUE
GROUP BY receiver_id, sender_id
ON CONFLICT (user_id, partner_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS messages_receiver_created_idx ON public.messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON public.messages (sender_id, created_at DESC);

-- Marquer une conversation comme lue (et l'ancien drapeau is_read, gardé par compatibilité).
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO conversation_reads (user_id, partner_id, last_read_at)
  VALUES (auth.uid(), p_partner_id, now())
  ON CONFLICT (user_id, partner_id) DO UPDATE SET last_read_at = now();
  UPDATE messages SET is_read = true
  WHERE receiver_id = auth.uid() AND sender_id = p_partner_id AND is_read IS NOT TRUE;
END $$;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- =====================================================================
-- C6 — Liste des conversations : le dernier message de chacune et le
-- nombre de messages non lus, calculés en base (avant : TOUT l'historique
-- téléchargé à chaque ouverture, tronqué au-delà de 1 000 messages).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_conversations()
RETURNS TABLE (partner_id uuid, partner jsonb, last_message jsonb, unread_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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
                       'story_id', l.story_id, 'created_at', l.created_at),
    (SELECT count(*) FROM mine x
      WHERE x.other_id = l.other_id AND x.receiver_id = auth.uid()
        AND x.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz))
  FROM last l
  JOIN users_profile u ON u.id = l.other_id
  LEFT JOIN conversation_reads r ON r.user_id = auth.uid() AND r.partner_id = l.other_id
  ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;

-- Pastille : nombre de conversations avec au moins un message non lu.
CREATE OR REPLACE FUNCTION public.unread_conversations_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(DISTINCT m.sender_id)
  FROM messages m
  LEFT JOIN conversation_reads r ON r.user_id = auth.uid() AND r.partner_id = m.sender_id
  WHERE m.receiver_id = auth.uid()
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;
REVOKE ALL ON FUNCTION public.unread_conversations_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_conversations_count() TO authenticated;

-- =====================================================================
-- C9 — L'expéditeur peut supprimer son message.
-- =====================================================================

DROP POLICY IF EXISTS messages_delete_own ON public.messages;
CREATE POLICY messages_delete_own ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());
GRANT DELETE ON public.messages TO authenticated;

-- Suppressions visibles en direct chez l'autre personne.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
