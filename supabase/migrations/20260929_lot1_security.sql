-- LOT 1 — Sécurité (audit B1, B2, B3, B5, B6, B7 + A2 côté base)
-- Idempotent : peut être relancé sans risque. Aucune table ni donnée supprimée.

-- =====================================================================
-- B1 / B7 — Cercles : seuls les membres voient le cercle, ses membres,
-- et on n'y entre plus sans invitation.
-- =====================================================================

DROP POLICY IF EXISTS circles_select ON public.circles;
CREATE POLICY circles_select ON public.circles FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_circle_member(id, auth.uid()));

DROP POLICY IF EXISTS circle_members_select ON public.circle_members;
CREATE POLICY circle_members_select ON public.circle_members FOR SELECT TO authenticated
  USING (public.is_circle_member(circle_id, auth.uid()));

-- Ajout direct : le créateur s'ajoute à la création, ou un membre ajoute
-- quelqu'un. Rejoindre soi-même passe par join_circle (lien ou code).
DROP POLICY IF EXISTS circle_members_insert ON public.circle_members;
CREATE POLICY circle_members_insert ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.created_by = auth.uid()))
    OR public.is_circle_member(circle_id, auth.uid())
  );

-- Rejoindre via le lien d'invitation (l'id du cercle, non devinable, est la clé).
CREATE OR REPLACE FUNCTION public.join_circle(p_circle_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = p_circle_id) THEN
    RAISE EXCEPTION 'circle not found';
  END IF;
  INSERT INTO circle_members (circle_id, user_id) VALUES (p_circle_id, uid)
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.join_circle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_circle(uuid) TO authenticated;

-- Trouver un cercle par son code exact (recherche « Cercles »).
CREATE OR REPLACE FUNCTION public.find_circle_by_code(p_code text)
RETURNS TABLE (id uuid, name text, photo_url text, member_count bigint, is_member boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.photo_url,
         (SELECT count(*) FROM circle_members m WHERE m.circle_id = c.id),
         EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = auth.uid())
  FROM circles c
  WHERE auth.uid() IS NOT NULL
    AND length(trim(p_code)) >= 4
    AND upper(c.invite_code) = upper(trim(p_code))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_circle_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_circle_by_code(text) TO authenticated;

-- =====================================================================
-- B2 — Posts : public = ni privé ni dans un cercle. Les posts privés
-- (Shake de la semaine non publié) restent à leur auteur, les posts de
-- cercle aux membres du cercle.
-- =====================================================================

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR (circle_id IS NULL AND is_private IS NOT TRUE)
    OR (circle_id IS NOT NULL AND public.is_circle_member(circle_id, auth.uid()))
  );

-- =====================================================================
-- B3 / A2 — Notifications : plus aucune création depuis l'appli.
-- Elles viennent toutes de déclencheurs en base (impossible d'en fabriquer
-- une fausse au nom de quelqu'un). La cloche = social uniquement.
-- =====================================================================

DROP POLICY IF EXISTS notifications_insert ON public.notifications;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES public.circles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'feel','like','comment','reshake','message','song_share','follow','circle_post','circle_invite',
  'story_like','story_comment','comment_like','circle_join','circle_add'
]));

-- Les déclencheurs existants tournaient avec les droits de l'utilisateur et
-- dépendaient de la règle d'insertion ouverte : on les passe en SECURITY DEFINER.
ALTER FUNCTION public.create_feel_notification() SECURITY DEFINER;
ALTER FUNCTION public.create_like_notification() SECURITY DEFINER;
ALTER FUNCTION public.create_comment_notification() SECURITY DEFINER;
ALTER FUNCTION public.create_reshake_notification() SECURITY DEFINER;

-- Like de commentaire (D2) : n'a jamais marché (colonne comment_id absente).
CREATE OR REPLACE FUNCTION public.create_comment_like_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, from_user_id, post_id, comment_id)
  SELECT c.user_id, 'comment_like', NEW.user_id, c.post_id, c.id
  FROM comments c
  WHERE c.id = NEW.comment_id AND c.user_id <> NEW.user_id
    -- une seule notif par commentaire et par personne (retirer/remettre ne spamme pas)
    AND NOT EXISTS (SELECT 1 FROM notifications n
                    WHERE n.type = 'comment_like' AND n.comment_id = c.id AND n.from_user_id = NEW.user_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_comment_like_notification ON public.comment_likes;
CREATE TRIGGER trigger_comment_like_notification AFTER INSERT ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.create_comment_like_notification();

-- Cercles : « a rejoint ton cercle » (au créateur) / « t'a ajouté à un cercle ».
-- Pas de notif à soi-même quand on crée son cercle (D3).
CREATE OR REPLACE FUNCTION public.create_circle_member_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid; actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RETURN NEW; END IF;
  SELECT created_by INTO owner FROM circles WHERE id = NEW.circle_id;
  IF NEW.user_id = actor THEN
    IF owner IS NOT NULL AND owner <> actor THEN
      INSERT INTO notifications (user_id, type, from_user_id, circle_id)
      VALUES (owner, 'circle_join', actor, NEW.circle_id);
    END IF;
  ELSE
    INSERT INTO notifications (user_id, type, from_user_id, circle_id)
    VALUES (NEW.user_id, 'circle_add', actor, NEW.circle_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_circle_member_notification ON public.circle_members;
CREATE TRIGGER trigger_circle_member_notification AFTER INSERT ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.create_circle_member_notification();

-- =====================================================================
-- B6 — Messages : les règles existent. Seul défaut : le destinataire
-- pouvait réécrire le texte d'un message reçu. Il ne peut plus modifier
-- que « lu / non lu ».
-- =====================================================================

REVOKE UPDATE ON public.messages FROM authenticated, anon;
GRANT UPDATE (is_read) ON public.messages TO authenticated;

-- =====================================================================
-- B5 — Photos des messages privés et des cercles : espace privé,
-- affichées par liens signés (valables 1 h).
-- =====================================================================

-- Qui peut lire un fichier de circle-media :
--  - son auteur ;
--  - dm/<a>/<b>/… : les deux personnes de la conversation ;
--  - circle-<id>/… et circle-avatars/<id>-… : les membres du cercle ;
--  - anciens fichiers <uid>/… : les deux personnes du message qui l'utilise.
CREATE OR REPLACE FUNCTION public.can_read_circle_media(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  parts text[] := string_to_array(p_name, '/');
  cid text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF parts[1] = uid::text THEN RETURN true; END IF;
  IF parts[1] = 'dm' THEN RETURN uid::text IN (parts[2], parts[3]); END IF;
  IF parts[1] = 'circle-avatars' THEN
    cid := substr(parts[2], 1, 36);
  ELSIF parts[1] LIKE 'circle-%' THEN
    cid := substr(parts[1], 8);
  END IF;
  IF cid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN is_circle_member(cid::uuid, uid);
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM messages m
    WHERE m.image_url LIKE '%/circle-media/' || p_name
      AND uid IN (m.sender_id, m.receiver_id));
END $$;

-- Qui peut déposer : dans son dossier, dans dm/<soi>/…, ou dans un cercle dont on est membre.
CREATE OR REPLACE FUNCTION public.can_write_circle_media(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  parts text[] := string_to_array(p_name, '/');
  cid text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF parts[1] = uid::text THEN RETURN true; END IF;
  IF parts[1] = 'dm' THEN RETURN parts[2] = uid::text; END IF;
  IF parts[1] = 'circle-avatars' THEN
    cid := substr(parts[2], 1, 36);
  ELSIF parts[1] LIKE 'circle-%' THEN
    cid := substr(parts[1], 8);
  END IF;
  IF cid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN is_circle_member(cid::uuid, uid);
  END IF;
  RETURN false;
END $$;

UPDATE storage.buckets SET public = false WHERE id = 'circle-media';

DROP POLICY IF EXISTS "Public read access for circle media" ON storage.objects;
DROP POLICY IF EXISTS "Public read circle media" ON storage.objects;
DROP POLICY IF EXISTS circle_media_public_read ON storage.objects;
DROP POLICY IF EXISTS circle_media_private_read ON storage.objects;
CREATE POLICY circle_media_private_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'circle-media' AND public.can_read_circle_media(name));

DROP POLICY IF EXISTS "Authenticated users can upload circle media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload circle media" ON storage.objects;
DROP POLICY IF EXISTS circle_media_auth_upload ON storage.objects;
CREATE POLICY circle_media_auth_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'circle-media' AND public.can_write_circle_media(name));

-- Espaces publics (avatars, photos de posts, stories) : les fichiers restent
-- visibles par leur lien, mais plus personne ne peut LISTER tous les fichiers,
-- ni écraser l'avatar de quelqu'un d'autre.
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS shake_media_public_read ON storage.objects;
DROP POLICY IF EXISTS story_media_public_read ON storage.objects;
DROP POLICY IF EXISTS public_media_owner_read ON storage.objects;
CREATE POLICY public_media_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('avatars', 'shake-media', 'story-media') AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Avatar authenticated update" ON storage.objects;
DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND owner_id = auth.uid()::text);

-- Suppression de ses propres fichiers, où qu'ils soient rangés (utile pour
-- supprimer la photo d'un post, B9/F6).
DROP POLICY IF EXISTS media_owner_delete ON storage.objects;
CREATE POLICY media_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars', 'shake-media', 'story-media', 'circle-media') AND owner_id = auth.uid()::text);

-- Correctif : les visiteurs (anon) n'ont pas le droit d'appeler
-- is_circle_member (retiré le 16/09) → la règle des posts échouait pour eux.
-- Fonction dédiée, sans paramètre utilisateur, utilisable par anon.
CREATE OR REPLACE FUNCTION public.am_circle_member(p_circle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.am_circle_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.am_circle_member(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR (circle_id IS NULL AND is_private IS NOT TRUE)
    OR (circle_id IS NOT NULL AND public.am_circle_member(circle_id))
  );
