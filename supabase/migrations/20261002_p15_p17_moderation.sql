-- P17 : bloquer et signaler (exigé par les stores). P15 : signaler un bug.
-- Le blocage est imposé PAR LA BASE (règles d'accès), pas seulement à l'écran.

-- ---------- Administrateurs (Kenny) ----------
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_admins_self ON public.app_admins;
CREATE POLICY app_admins_self ON public.app_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.app_admins (user_id) SELECT id FROM public.users_profile WHERE username = 'kenny' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- Blocages ----------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_own ON public.blocks;
CREATE POLICY blocks_own ON public.blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- Y a-t-il un blocage entre ces deux personnes (dans un sens ou dans l'autre) ?
CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM blocks WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a));
$$;
REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO anon, authenticated;

-- Bloquer : les abonnements dans les deux sens sont retirés.
CREATE OR REPLACE FUNCTION public.on_block_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM follows WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
                         OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_block_cleanup() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS blocks_cleanup ON public.blocks;
CREATE TRIGGER blocks_cleanup AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.on_block_cleanup();

-- Statut vu depuis l'appli : 'none', 'i_blocked' ou 'blocked_me'.
CREATE OR REPLACE FUNCTION public.get_block_status(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM blocks WHERE blocker_id = auth.uid() AND blocked_id = p_user) THEN 'i_blocked'
    WHEN EXISTS (SELECT 1 FROM blocks WHERE blocker_id = p_user AND blocked_id = auth.uid()) THEN 'blocked_me'
    ELSE 'none' END;
$$;
REVOKE ALL ON FUNCTION public.get_block_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_block_status(uuid) TO authenticated;

-- Posts : ni elle ne voit les miens, ni je ne vois les siens (likes, commentaires,
-- réponses en musique suivent : ils exigent de pouvoir voir le post).
DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT TO anon, authenticated USING (
  (user_id = auth.uid())
  OR ((circle_id IS NULL) AND (is_private IS NOT TRUE) AND NOT public.is_blocked_between(auth.uid(), user_id))
  OR ((circle_id IS NOT NULL) AND am_circle_member(circle_id))
);

-- Ses commentaires disparaissent pour moi (et les miens pour elle).
DROP POLICY IF EXISTS comments_select_visible_post ON public.comments;
CREATE POLICY comments_select_visible_post ON public.comments FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = comments.post_id) AND NOT public.is_blocked_between(auth.uid(), user_id)
);
DROP POLICY IF EXISTS music_reactions_select_visible_post ON public.music_reactions;
CREATE POLICY music_reactions_select_visible_post ON public.music_reactions FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = music_reactions.post_id) AND NOT public.is_blocked_between(auth.uid(), user_id)
);

-- Plus de suivi possible.
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = follower_id AND NOT public.is_blocked_between(follower_id, following_id)
);

-- Plus de message privé dans un sens ni dans l'autre.
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND NOT public.is_blocked_between(sender_id, receiver_id)
);

-- On ne peut pas ajouter à un cercle quelqu'un avec qui il y a un blocage.
DROP POLICY IF EXISTS circle_members_insert ON public.circle_members;
CREATE POLICY circle_members_insert ON public.circle_members FOR INSERT TO authenticated WITH CHECK (
  ((user_id = auth.uid()) AND EXISTS (SELECT 1 FROM circles c WHERE c.id = circle_members.circle_id AND c.created_by = auth.uid()))
  OR (is_circle_member(circle_id, auth.uid()) AND NOT public.is_blocked_between(auth.uid(), user_id))
);

-- Liste des personnes bloquées (Paramètres).
CREATE OR REPLACE FUNCTION public.get_my_blocks()
RETURNS TABLE (id uuid, username text, display_name text, profile_album_cover_url text, blocked_at timestamptz)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT u.id, u.username, u.display_name, u.profile_album_cover_url, b.created_at
  FROM blocks b JOIN users_profile u ON u.id = b.blocked_id
  WHERE b.blocker_id = auth.uid() ORDER BY b.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_blocks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocks() TO authenticated;

-- ---------- Signalements (P17) ----------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('user', 'post', 'comment', 'message', 'circle_message', 'story')),
  target_id uuid NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harcelement', 'choquant', 'faux_compte', 'autre')),
  details text CHECK (char_length(details) <= 1000),
  snapshot jsonb,
  status text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'masque', 'ignore')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_kind, target_id)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_admin_read ON public.reports;
CREATE POLICY reports_admin_read ON public.reports FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS reports_admin_update ON public.reports;
CREATE POLICY reports_admin_update ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Signaler : on garde une copie du contenu signalé (s'il est retiré ensuite,
-- l'admin sait quoi). Seul ce qu'on peut voir peut être signalé.
CREATE OR REPLACE FUNCTION public.report_content(p_kind text, p_id uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_user uuid;
  v_snap jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_kind = 'user' THEN
    SELECT id, jsonb_build_object('username', username, 'display_name', display_name, 'bio', bio, 'avatar', profile_album_cover_url)
      INTO v_user, v_snap FROM users_profile WHERE id = p_id;
  ELSIF p_kind = 'post' THEN
    SELECT user_id, jsonb_build_object('track', track_name, 'artist', artist, 'text', text, 'image_url', image_url)
      INTO v_user, v_snap FROM posts WHERE id = p_id
       AND (user_id = uid OR (circle_id IS NULL AND is_private IS NOT TRUE) OR (circle_id IS NOT NULL AND is_circle_member(circle_id, uid)));
  ELSIF p_kind = 'comment' THEN
    SELECT user_id, jsonb_build_object('text', text, 'post_id', post_id) INTO v_user, v_snap FROM comments WHERE id = p_id;
  ELSIF p_kind = 'message' THEN
    SELECT sender_id, jsonb_build_object('text', text, 'track', track_name, 'image_url', image_url)
      INTO v_user, v_snap FROM messages WHERE id = p_id AND uid IN (sender_id, receiver_id);
  ELSIF p_kind = 'circle_message' THEN
    SELECT sender_id, jsonb_build_object('text', text, 'track', track_name, 'image_url', image_url, 'circle_id', circle_id)
      INTO v_user, v_snap FROM circle_messages WHERE id = p_id AND is_circle_member(circle_id, uid);
  ELSIF p_kind = 'story' THEN
    SELECT user_id, jsonb_build_object('track', track_name, 'text', text, 'image_url', image_url)
      INTO v_user, v_snap FROM stories WHERE id = p_id;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Contenu introuvable.'; END IF;
  INSERT INTO reports (reporter_id, target_kind, target_id, target_user_id, reason, details, snapshot)
  VALUES (uid, p_kind, p_id, v_user, p_reason, nullif(btrim(coalesce(p_details, '')), ''), v_snap)
  ON CONFLICT (reporter_id, target_kind, target_id) DO UPDATE SET reason = excluded.reason, details = excluded.details, status = 'nouveau', created_at = now();
END $$;
REVOKE ALL ON FUNCTION public.report_content(text, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO authenticated;

-- Action rapide de l'admin : « masquer » = retirer le contenu ; « ignorer ».
CREATE OR REPLACE FUNCTION public.admin_moderate(p_report uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'réservé à l''admin'; END IF;
  SELECT * INTO r FROM reports WHERE id = p_report;
  IF r.id IS NULL THEN RAISE EXCEPTION 'introuvable'; END IF;
  IF p_action = 'hide' THEN
    IF r.target_kind = 'post' THEN DELETE FROM posts WHERE id = r.target_id;
    ELSIF r.target_kind = 'comment' THEN DELETE FROM comments WHERE id = r.target_id;
    ELSIF r.target_kind = 'story' THEN DELETE FROM stories WHERE id = r.target_id;
    ELSIF r.target_kind = 'message' THEN
      UPDATE messages SET text = NULL, track_name = NULL, artist = NULL, cover_url = NULL, image_url = NULL, deleted_at = now() WHERE id = r.target_id;
    ELSIF r.target_kind = 'circle_message' THEN
      UPDATE circle_messages SET text = NULL, track_name = NULL, artist = NULL, cover_url = NULL, image_url = NULL, deleted_at = now() WHERE id = r.target_id;
    ELSIF r.target_kind = 'user' THEN
      UPDATE users_profile SET bio = NULL, profile_album_cover_url = NULL WHERE id = r.target_id;
    END IF;
    UPDATE reports SET status = 'masque' WHERE target_kind = r.target_kind AND target_id = r.target_id;
  ELSIF p_action = 'ignore' THEN
    UPDATE reports SET status = 'ignore' WHERE id = p_report;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_moderate(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate(uuid, text) TO authenticated;

-- Cercle : un message signalé par au moins 2 membres → le créateur peut le retirer
-- (il le peut déjà, P12) ; on lui donne le compte des signalements.
CREATE OR REPLACE FUNCTION public.circle_message_report_count(p_message uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM reports r JOIN circle_messages m ON m.id = r.target_id
  WHERE r.target_kind = 'circle_message' AND r.target_id = p_message
    AND EXISTS (SELECT 1 FROM circles c WHERE c.id = m.circle_id AND c.created_by = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.circle_message_report_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.circle_message_report_count(uuid) TO authenticated;

-- ---------- Signaler un bug (P15) ----------
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 4000),
  screenshot_path text,
  info jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'vu', 'regle')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bug_reports_insert_own ON public.bug_reports;
CREATE POLICY bug_reports_insert_own ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'nouveau' AND (screenshot_path IS NULL OR screenshot_path LIKE auth.uid()::text || '/%'));
DROP POLICY IF EXISTS bug_reports_admin_read ON public.bug_reports;
CREATE POLICY bug_reports_admin_read ON public.bug_reports FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS bug_reports_admin_update ON public.bug_reports;
CREATE POLICY bug_reports_admin_update ON public.bug_reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Captures d'écran : espace PRIVÉ, chacun écrit dans son dossier, seul l'admin lit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-screens', 'bug-screens', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS bug_screens_insert_own ON storage.objects;
CREATE POLICY bug_screens_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug-screens' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS bug_screens_admin_read ON storage.objects;
CREATE POLICY bug_screens_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bug-screens' AND public.is_admin());
