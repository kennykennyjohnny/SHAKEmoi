-- Q11 (remplace P24) : on épingle SES PROPRES Shakes déjà publiés, en haut de
-- la grille du profil (comme Instagram), 3 au maximum, le dernier épinglé en
-- premier. Plus de rubrique « sons épinglés » à part.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts (user_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

-- Épingler : seulement un de mes Shakes visibles sur mon profil (pas un
-- reshake, pas un post privé ni de cercle). Au-delà de 3 : refus, sauf si on
-- demande de remplacer le plus ancien épinglé.
CREATE OR REPLACE FUNCTION public.pin_post(p_post uuid, p_replace_oldest boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_n int;
  v_oldest uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post AND user_id = uid AND is_reshake IS NOT TRUE
                 AND circle_id IS NULL AND is_private IS NOT TRUE) THEN
    RAISE EXCEPTION 'Tu ne peux épingler que tes propres Shakes publiés sur ton profil.';
  END IF;
  IF EXISTS (SELECT 1 FROM posts WHERE id = p_post AND pinned_at IS NOT NULL) THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;
  SELECT count(*) INTO v_n FROM posts WHERE user_id = uid AND pinned_at IS NOT NULL;
  IF v_n >= 3 THEN
    IF NOT p_replace_oldest THEN RETURN jsonb_build_object('status', 'full'); END IF;
    SELECT id INTO v_oldest FROM posts WHERE user_id = uid AND pinned_at IS NOT NULL ORDER BY pinned_at ASC LIMIT 1;
    UPDATE posts SET pinned_at = NULL WHERE id = v_oldest;
  END IF;
  UPDATE posts SET pinned_at = now() WHERE id = p_post;
  RETURN jsonb_build_object('status', 'pinned', 'replaced', v_oldest);
END $$;

CREATE OR REPLACE FUNCTION public.unpin_post(p_post uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connecte-toi.'; END IF;
  UPDATE posts SET pinned_at = NULL WHERE id = p_post AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.pin_post(uuid, boolean), public.unpin_post(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pin_post(uuid, boolean), public.unpin_post(uuid) TO authenticated;

-- Personne ne change pinned_at à la main (seulement par ces fonctions).
CREATE OR REPLACE FUNCTION public.posts_lock_pinned()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Dans pin_post / unpin_post (SECURITY DEFINER), current_user est le propriétaire.
  IF current_user IN ('authenticated', 'anon') AND NEW.pinned_at IS DISTINCT FROM OLD.pinned_at THEN
    NEW.pinned_at := OLD.pinned_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS posts_lock_pinned ON public.posts;
CREATE TRIGGER posts_lock_pinned BEFORE UPDATE OF pinned_at ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_lock_pinned();

-- Reprise des sons épinglés (P24) : ceux qui correspondent à un Shake de la
-- personne deviennent des Shakes épinglés (même ordre) ; les autres sont
-- abandonnés (la table reste, plus rien ne l'affiche).
UPDATE posts p SET pinned_at = now() - (ps.position || ' seconds')::interval
FROM pinned_songs ps
WHERE p.id = coalesce(ps.post_id, (
        SELECT x.id FROM posts x WHERE x.user_id = ps.user_id AND x.is_reshake IS NOT TRUE AND x.circle_id IS NULL
          AND x.is_private IS NOT TRUE AND lower(x.track_name) = lower(ps.track_name) ORDER BY x.created_at DESC LIMIT 1))
  AND p.user_id = ps.user_id AND p.is_reshake IS NOT TRUE AND p.circle_id IS NULL AND p.is_private IS NOT TRUE;

-- Compatibilité (P25) : un Shake épinglé garde son poids fort (×2 au total).
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.compute_taste_all'::regproc);
  d := replace(d, 'UNION ALL SELECT user_id, track_name, artist, created_at, 2.0 FROM pinned_songs',
                  'UNION ALL SELECT user_id, track_name, artist, created_at, 1.0 FROM posts WHERE pinned_at IS NOT NULL AND circle_id IS NULL');
  EXECUTE d;
END $do$;
