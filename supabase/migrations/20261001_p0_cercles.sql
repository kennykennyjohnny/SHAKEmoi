-- Étape 0 (01/10) : vérification du patch de Jerry contre la vraie base.
-- P8 renommer un cercle (tous les membres) + message « X a renommé le cercle »,
-- P12 retrait par l'auteur ou le créateur du cercle, P13 tri par dernière
-- activité calculé en base, P26 (fondation) lecture des cercles,
-- + temps réel : `messages` et `notifications` n'étaient pas publiés.

-- Messages « système » dans un cercle (renommage…). NULL = message normal.
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.circle_messages DROP CONSTRAINT IF EXISTS circle_messages_kind_check;
ALTER TABLE public.circle_messages ADD CONSTRAINT circle_messages_kind_check CHECK (kind IS NULL OR kind IN ('rename'));

-- Un membre n'écrit que des messages normaux ; les messages système viennent des fonctions.
DROP POLICY IF EXISTS circle_messages_insert ON public.circle_messages;
CREATE POLICY circle_messages_insert ON public.circle_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND kind IS NULL
    AND EXISTS (SELECT 1 FROM public.circle_members cm WHERE cm.circle_id = circle_messages.circle_id AND cm.user_id = auth.uid())
  );

-- P12 : l'auteur retire son message, le créateur du cercle peut retirer n'importe lequel.
DROP POLICY IF EXISTS circle_messages_delete ON public.circle_messages;
DROP POLICY IF EXISTS circle_messages_delete_own_or_owner ON public.circle_messages;
CREATE POLICY circle_messages_delete ON public.circle_messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_messages.circle_id AND c.created_by = auth.uid())
  );

-- P8 : tout membre peut renommer, et SEULEMENT le nom (la règle UPDATE de la
-- table reste réservée au créateur). Un petit message apparaît dans la discussion.
CREATE OR REPLACE FUNCTION public.rename_circle(p_circle_id uuid, p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_name text := left(btrim(coalesce(p_name, '')), 40);
  v_old text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi pour renommer le cercle.'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'Le nom ne peut pas être vide.'; END IF;
  IF NOT public.is_circle_member(p_circle_id, uid) THEN
    RAISE EXCEPTION 'Seuls les membres du cercle peuvent le renommer.';
  END IF;
  SELECT name INTO v_old FROM public.circles WHERE id = p_circle_id FOR UPDATE;
  IF v_old IS DISTINCT FROM v_name THEN
    UPDATE public.circles SET name = v_name WHERE id = p_circle_id;
    INSERT INTO public.circle_messages (circle_id, sender_id, text, kind)
    VALUES (p_circle_id, uid, v_name, 'rename');
  END IF;
  RETURN v_name;
END $$;
REVOKE ALL ON FUNCTION public.rename_circle(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rename_circle(uuid, text) TO authenticated;

-- P26 (fondation) : date de dernière lecture de chaque cercle.
CREATE TABLE IF NOT EXISTS public.circle_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, circle_id)
);
ALTER TABLE public.circle_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS circle_reads_own ON public.circle_reads;
CREATE POLICY circle_reads_own ON public.circle_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_circle_member(circle_id, auth.uid()));
-- Point de départ : tout ce qui existe déjà est considéré comme lu (pas de pastilles fantômes).
INSERT INTO public.circle_reads (user_id, circle_id, last_read_at)
SELECT user_id, circle_id, now() FROM public.circle_members
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS circle_messages_circle_created_idx ON public.circle_messages (circle_id, created_at DESC);

-- P13 : mes cercles, du plus récemment actif au moins actif, avec le dernier
-- message et le nombre de non-lus. Une seule requête (avant : une par cercle).
CREATE OR REPLACE FUNCTION public.get_my_circles()
RETURNS TABLE (
  id uuid, name text, created_by uuid, invite_code text, created_at timestamptz, photo_url text,
  last_activity_at timestamptz, last_message jsonb, unread_count bigint, member_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT c.id, c.name, c.created_by, c.invite_code, c.created_at, c.photo_url,
         coalesce(lm.created_at, c.created_at) AS last_activity_at,
         CASE WHEN lm.id IS NULL THEN NULL ELSE jsonb_build_object(
           'id', lm.id, 'sender_id', lm.sender_id, 'text', lm.text, 'track_name', lm.track_name,
           'image_url', lm.image_url, 'kind', lm.kind, 'created_at', lm.created_at,
           'sender_username', u.username) END AS last_message,
         (SELECT count(*) FROM public.circle_messages x
           WHERE x.circle_id = c.id AND x.sender_id <> auth.uid() AND x.kind IS NULL
             AND x.created_at > coalesce(r.last_read_at, me.joined_at, '-infinity'::timestamptz)) AS unread_count,
         (SELECT count(*) FROM public.circle_members y WHERE y.circle_id = c.id) AS member_count
  FROM public.circle_members me
  JOIN public.circles c ON c.id = me.circle_id
  LEFT JOIN public.circle_reads r ON r.user_id = auth.uid() AND r.circle_id = c.id
  LEFT JOIN LATERAL (
    SELECT m.* FROM public.circle_messages m WHERE m.circle_id = c.id ORDER BY m.created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN public.users_profile u ON u.id = lm.sender_id
  WHERE me.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.created_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_circles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_circles() TO authenticated;

-- Marquer un cercle lu (P26).
CREATE OR REPLACE FUNCTION public.mark_circle_read(p_circle_id uuid)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  INSERT INTO public.circle_reads (user_id, circle_id, last_read_at)
  VALUES (auth.uid(), p_circle_id, now())
  ON CONFLICT (user_id, circle_id) DO UPDATE SET last_read_at = excluded.last_read_at;
$$;
REVOKE ALL ON FUNCTION public.mark_circle_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_circle_read(uuid) TO authenticated;

-- Temps réel : les messages privés, les notifications et les cercles (renommage)
-- n'étaient pas publiés → rien n'arrivait en direct (liste, pastilles, cloche).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'notifications', 'circles'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
