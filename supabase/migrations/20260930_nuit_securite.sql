-- NUIT — Sécurité et compteurs. Idempotent. Aucune donnée utilisateur supprimée.
-- (Les fonctions serveur make-server-7dbfc935 et calculate-compatibility ont
--  été neutralisées à part : elles répondent 410.)

-- 1. Compteurs de commentaires : l'appli appelait increment_comments APRÈS le
--    déclencheur qui recompte déjà → chaque commentaire texte comptait double.
--    Ces fonctions recomptent maintenant (sans danger pour une vieille version
--    de l'appli restée en cache), idem pour likes et reshakes.
CREATE OR REPLACE FUNCTION public.increment_comments(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT recount_comments(post_id) $$;
CREATE OR REPLACE FUNCTION public.decrement_comments(post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT recount_comments(post_id) $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_likes' AND pronargs = 1) THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.increment_likes(post_id uuid)
      RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
      $b$ UPDATE posts p SET likes_count = (SELECT count(*) FROM likes l WHERE l.post_id = p.id) WHERE p.id = $1 $b$$f$;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_likes' AND pronargs = 1) THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION public.decrement_likes(post_id uuid)
      RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
      $b$ UPDATE posts p SET likes_count = (SELECT count(*) FROM likes l WHERE l.post_id = p.id) WHERE p.id = $1 $b$$f$;
  END IF;
END $$;

-- 2. Abonnés : 4 déclencheurs se superposaient (sans droits suffisants) →
--    colonnes feels_count / feelings_count fausses. Un seul, qui recompte.
--    feels_count = abonnés, feelings_count = abonnements.
CREATE OR REPLACE FUNCTION public.recount_follows(p_user uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE users_profile u SET
    feels_count = (SELECT count(*) FROM follows f WHERE f.following_id = u.id),
    feelings_count = (SELECT count(*) FROM follows f WHERE f.follower_id = u.id)
  WHERE u.id = p_user;
$$;
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM recount_follows(NEW.follower_id); PERFORM recount_follows(NEW.following_id); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN PERFORM recount_follows(OLD.follower_id); PERFORM recount_follows(OLD.following_id); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trigger_update_feels ON public.follows;
DROP TRIGGER IF EXISTS update_feels_counts_trigger ON public.follows;
DROP TRIGGER IF EXISTS update_feels_feelings_on_follow ON public.follows;
DROP TRIGGER IF EXISTS update_feels_feelings_on_unfollow ON public.follows;
DROP TRIGGER IF EXISTS trigger_update_follow_counts ON public.follows;
CREATE TRIGGER trigger_update_follow_counts AFTER INSERT OR DELETE OR UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Le compteur de commentaires ne touche plus feelings_count (vieux reste).
CREATE OR REPLACE FUNCTION public.update_comment_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM recount_comments(NEW.post_id); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.post_id IS DISTINCT FROM coalesce(NEW.post_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM recount_comments(OLD.post_id);
  END IF;
  RETURN NULL;
END $$;

-- Likes : doublon sans droits (le vrai compteur est trigger_update_likes).
DROP TRIGGER IF EXISTS feelings_count_trigger ON public.likes;

-- Likes de commentaires : recompte avec les bons droits.
CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.comment_id ELSE NEW.comment_id END;
BEGIN
  UPDATE comments SET likes_count = (SELECT count(*) FROM comment_likes WHERE comment_id = cid) WHERE id = cid;
  RETURN NULL;
END $$;

UPDATE public.users_profile u SET
  feels_count = (SELECT count(*) FROM follows f WHERE f.following_id = u.id),
  feelings_count = (SELECT count(*) FROM follows f WHERE f.follower_id = u.id);

-- 3. Colonnes modifiables par l'appli : plus les compteurs ni les séries.
REVOKE UPDATE ON public.users_profile FROM anon, authenticated;
GRANT UPDATE (username, display_name, bio, color, profile_color, profile_album_cover_url, profile_album_id,
  profile_album_name, profile_album_artist, preferred_platform, preferred_streaming_app, onboarding_completed_at)
  ON public.users_profile TO authenticated;
-- À la création : compteurs à zéro quoi qu'envoie l'appli.
CREATE OR REPLACE FUNCTION public.users_profile_reset_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.feels_count := 0; NEW.feelings_count := 0;
  NEW.current_streak := 0; NEW.longest_streak := 0; NEW.streak_shields := 0; NEW.last_post_date := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_profile_reset_counters ON public.users_profile;
CREATE TRIGGER users_profile_reset_counters BEFORE INSERT ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.users_profile_reset_counters();

-- Posts : l'appli ne les modifie jamais ; seuls le texte, l'humeur et la
-- visibilité restent modifiables par leur auteur (pas les compteurs).
REVOKE UPDATE ON public.posts FROM anon, authenticated;
GRANT UPDATE (text, mood_emoji, is_private) ON public.posts TO authenticated;

-- TRUNCATE n'est pas soumis aux règles d'accès : retiré partout.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- 4. Cercles : une personne retirée par la créatrice ne peut plus revenir
--    toute seule avec l'ancien lien (sauf si un membre la rajoute).
CREATE TABLE IF NOT EXISTS public.circle_removals (
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);
ALTER TABLE public.circle_removals ENABLE ROW LEVEL SECURITY; -- aucune règle : invisible depuis l'appli

CREATE OR REPLACE FUNCTION public.track_circle_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Retiré par quelqu'un d'autre (pas un départ volontaire).
    -- (Cercle supprimé en entier : rien à retenir.)
    IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id
       AND EXISTS (SELECT 1 FROM circles WHERE id = OLD.circle_id) THEN
      INSERT INTO circle_removals (circle_id, user_id) VALUES (OLD.circle_id, OLD.user_id) ON CONFLICT DO NOTHING;
    END IF;
    RETURN OLD;
  ELSE
    -- Rajouté par un membre : la personne peut de nouveau utiliser le lien.
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id THEN
      DELETE FROM circle_removals WHERE circle_id = NEW.circle_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
END $$;
DROP TRIGGER IF EXISTS trigger_track_circle_removal ON public.circle_members;
CREATE TRIGGER trigger_track_circle_removal AFTER INSERT OR DELETE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.track_circle_removal();

CREATE OR REPLACE FUNCTION public.join_circle(p_circle_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = p_circle_id) THEN
    RAISE EXCEPTION 'circle not found';
  END IF;
  IF EXISTS (SELECT 1 FROM circle_removals WHERE circle_id = p_circle_id AND user_id = uid) THEN
    RAISE EXCEPTION 'removed from circle';
  END IF;
  INSERT INTO circle_members (circle_id, user_id) VALUES (p_circle_id, uid)
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN true;
END $$;

-- 5. Liens « Écouter sur … » : seulement vers les vraies plateformes
--    (avant, n'importe qui pouvait créer une page shakemoi.fr/s/… menant
--    vers un faux site). Un lien hors liste est simplement retiré.
CREATE OR REPLACE FUNCTION public.is_music_link(u text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT u IS NULL
    OR u ~* '^(spotify:(track|album|artist):[A-Za-z0-9]+|deezer://[^\s]+|tidal://[^\s]+)$'
    OR u ~* '^https?://([a-z0-9-]+\.)*(spotify\.com|spotify\.link|apple\.com|deezer\.com|deezer\.page\.link|dzr\.page\.link|youtube\.com|youtu\.be|tidal\.com|song\.link|album\.link|odesli\.co|soundcloud\.com|amazon\.[a-z.]+|shakemoi\.fr)(:[0-9]+)?([/?#]|$)';
$$;
CREATE OR REPLACE FUNCTION public.sanitize_music_links()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT is_music_link(NEW.spotify_url) THEN NEW.spotify_url := NULL; END IF;
  IF NOT is_music_link(NEW.apple_music_url) THEN NEW.apple_music_url := NULL; END IF;
  IF NOT is_music_link(NEW.deezer_url) THEN NEW.deezer_url := NULL; END IF;
  IF NOT is_music_link(NEW.youtube_url) THEN NEW.youtube_url := NULL; END IF;
  IF NOT is_music_link(NEW.youtube_music_url) THEN NEW.youtube_music_url := NULL; END IF;
  IF NOT is_music_link(NEW.tidal_url) THEN NEW.tidal_url := NULL; END IF;
  IF NOT is_music_link(NEW.odesli_page_url) THEN NEW.odesli_page_url := NULL; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['songs','posts','messages','circle_messages','music_reactions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_sanitize_music_links ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trigger_sanitize_music_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sanitize_music_links()', t);
  END LOOP;
END $$;

-- 6. Règles trop larges.
DROP POLICY IF EXISTS "System can insert mood history" ON public.mood_history; -- le déclencheur suffit
DROP POLICY IF EXISTS artists_insert ON public.artists;   -- table inutilisée par l'appli
DROP POLICY IF EXISTS artists_update ON public.artists;
DROP POLICY IF EXISTS tcp_insert ON public.time_capsule_participants;
CREATE POLICY tcp_insert ON public.time_capsule_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM time_capsules tc WHERE tc.id = capsule_id AND tc.user_id = auth.uid()));
-- Vues de story : seulement une story qu'on a le droit de voir.
DROP POLICY IF EXISTS story_views_insert ON public.story_views;
CREATE POLICY story_views_insert ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM stories s WHERE s.id = story_views.story_id AND s.user_id <> auth.uid()));

-- log_mood_on_post écrivait dans mood_history avec les droits de l'appli.
CREATE OR REPLACE FUNCTION public.log_mood_on_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mood_emoji IS NOT NULL THEN
    INSERT INTO mood_history (user_id, mood_emoji, post_id) VALUES (NEW.user_id, NEW.mood_emoji, NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- 7. Stockage : taille et types limités (plus de SVG, HTML, gros fichiers),
--    et chacun n'écrit que dans SON dossier.
UPDATE storage.buckets SET file_size_limit = 5242880,
  allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif}'
  WHERE id = 'avatars';
UPDATE storage.buckets SET file_size_limit = 10485760,
  allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif}'
  WHERE id IN ('shake-media', 'story-media');
DROP POLICY IF EXISTS "Avatar authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS avatars_auth_upload ON storage.objects;
CREATE POLICY avatars_auth_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS shake_media_auth_upload ON storage.objects;
CREATE POLICY shake_media_auth_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shake-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS story_media_auth_upload ON storage.objects;
CREATE POLICY story_media_auth_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Fonctions de déclencheur : pas appelables directement depuis l'API.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.recount_comments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recount_follows(uuid) FROM PUBLIC, anon, authenticated;
