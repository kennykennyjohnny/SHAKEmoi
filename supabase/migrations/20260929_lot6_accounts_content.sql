-- LOT 6 — Comptes et contenus (audit G2, G3, G4, F1, F3, F5). Idempotent.
-- Aucune donnée existante n'est modifiée ici (les pseudos hors règle et les
-- reshakes en double sont traités par un script séparé, à valider).

-- =====================================================================
-- G2 / G3 — Règle des pseudos, vérifiée en base : 3 à 20 caractères,
-- a-z 0-9 . _ -, mis en minuscules, uniques sans distinction de casse.
-- Seulement pour les nouveaux comptes et les changements de pseudo : les
-- pseudos existants continuent de marcher tels quels.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.users_profile_check_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;
  NEW.username := lower(trim(NEW.username));
  IF NEW.username !~ '^[a-z0-9._-]{3,20}$' THEN
    RAISE EXCEPTION 'username_invalid' USING ERRCODE = '23514',
      HINT = 'Pseudo : 3 à 20 caractères, lettres minuscules, chiffres, point, tiret, tiret bas.';
  END IF;
  IF EXISTS (SELECT 1 FROM users_profile WHERE lower(username) = NEW.username AND id <> NEW.id) THEN
    RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_profile_check_username ON public.users_profile;
CREATE TRIGGER users_profile_check_username BEFORE INSERT OR UPDATE OF username ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.users_profile_check_username();

-- Recherche rapide des pseudos sans casse.
CREATE INDEX IF NOT EXISTS users_profile_username_lower_idx ON public.users_profile (lower(username));

-- Le pseudo est-il libre ? (utilisable avant inscription, sans compte)
CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM users_profile WHERE lower(username) = lower(trim(p_username)));
$$;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- =====================================================================
-- G4 — Le profil est créé EN MÊME TEMPS que le compte (déclencheur sur
-- auth.users), avec le pseudo passé à l'inscription. Plus de compte créé
-- sans profil si la 2e étape échoue.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wanted text := lower(trim(coalesce(NEW.raw_user_meta_data->>'username', '')));
  display text := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name', '')), '');
BEGIN
  IF wanted = '' THEN RETURN NEW; END IF;  -- ancien parcours : le profil est créé par l'appli
  IF wanted !~ '^[a-z0-9._-]{3,20}$' OR EXISTS (SELECT 1 FROM users_profile WHERE lower(username) = wanted) THEN
    -- Pseudo refusé entre la vérification et l'inscription : on le rend
    -- unique plutôt que de bloquer l'inscription (modifiable ensuite).
    wanted := left(regexp_replace(wanted, '[^a-z0-9._-]', '', 'g'), 14);
    IF length(wanted) < 3 THEN wanted := 'shaker'; END IF;
    wanted := wanted || floor(random() * 90000 + 10000)::int::text;
  END IF;
  INSERT INTO users_profile (id, username, display_name, color, feels_count, feelings_count)
  VALUES (NEW.id, wanted, coalesce(display, wanted), '#B4A7D6', 0, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- =====================================================================
-- F1 — Un seul reshake par personne et par post, jamais le sien.
-- (Contrôle à l'insertion : les doublons existants ne sont pas touchés.)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.posts_check_reshake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_reshake IS TRUE AND NEW.original_post_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM posts WHERE id = NEW.original_post_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'reshake_own_post' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM posts WHERE is_reshake AND user_id = NEW.user_id AND original_post_id = NEW.original_post_id) THEN
      RAISE EXCEPTION 'reshake_duplicate' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS posts_check_reshake ON public.posts;
CREATE TRIGGER posts_check_reshake BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_check_reshake();

-- =====================================================================
-- F3 — Compteur de reshakes recalculé en base (comme les likes hier).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_reshake_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid uuid := coalesce(NEW.original_post_id, OLD.original_post_id);
BEGIN
  IF oid IS NOT NULL AND coalesce(NEW.is_reshake, OLD.is_reshake) THEN
    UPDATE posts SET reshakes_count = (SELECT count(*) FROM posts r WHERE r.is_reshake AND r.original_post_id = oid)
    WHERE id = oid;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trigger_update_reshake_counts ON public.posts;
CREATE TRIGGER trigger_update_reshake_counts AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_reshake_counts();

-- L'appli n'ajoute plus +1 elle-même ; l'ancienne fonction recalcule.
CREATE OR REPLACE FUNCTION public.increment_reshakes_count(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE posts SET reshakes_count = (SELECT count(*) FROM posts r WHERE r.is_reshake AND r.original_post_id = increment_reshakes_count.post_id)
  WHERE id = increment_reshakes_count.post_id;
$$;

-- Remise à plat des compteurs (valeur calculée, pas une donnée utilisateur).
UPDATE posts p SET reshakes_count = c.n
FROM (SELECT o.id, (SELECT count(*) FROM posts r WHERE r.is_reshake AND r.original_post_id = o.id) n FROM posts o) c
WHERE c.id = p.id AND coalesce(p.reshakes_count, 0) <> c.n;

-- =====================================================================
-- F5 — Un commentaire peut être supprimé par son auteur ET par l'auteur du post.
-- =====================================================================

DROP POLICY IF EXISTS comments_delete_by_post_owner ON public.comments;
CREATE POLICY comments_delete_by_post_owner ON public.comments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = comments.post_id AND p.user_id = auth.uid()));
