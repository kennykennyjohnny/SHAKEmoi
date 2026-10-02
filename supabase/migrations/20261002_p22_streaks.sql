-- P22 : séries de Shakes. Une série = nombre de SEMAINES d'affilée avec au moins
-- un vrai Shake publié (post normal, y compris le Shake de la semaine, même
-- non publié sur le profil). Les Shakes éphémères et les reshakes ne comptent
-- pas, ni les posts de cercle. Semaines : remise à zéro le mardi à 9 h UTC.

-- L'ancien déclencheur comptait des JOURS et se déclenchait à chaque
-- modification du profil (série gonflée en changeant sa bio) : retiré.
DROP TRIGGER IF EXISTS streak_update_trigger ON public.users_profile;

-- Numéro de semaine SHAKEmoi (0 = semaine du mardi 2 janvier 2024, 9 h UTC).
CREATE OR REPLACE FUNCTION public.shake_week(ts timestamptz)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT floor((extract(epoch FROM ts) - extract(epoch FROM timestamptz '2024-01-02 09:00:00+00')) / 604800)::int;
$$;

CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts (user_id, created_at DESC);

-- Série d'une personne : en cours, meilleure, déjà publié cette semaine ?, fin de la semaine.
CREATE OR REPLACE FUNCTION public.get_streak(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH w AS (
    SELECT DISTINCT shake_week(created_at) AS w FROM posts
    WHERE user_id = p_user AND is_reshake IS NOT TRUE AND circle_id IS NULL
  ),
  runs AS (
    SELECT min(w) AS a, max(w) AS b, count(*) AS len FROM (SELECT w, w - row_number() OVER (ORDER BY w) AS g FROM w) x GROUP BY g
  ),
  cur AS (SELECT shake_week(now()) AS w)
  SELECT jsonb_build_object(
    'current', coalesce((SELECT len FROM runs, cur WHERE runs.b = cur.w OR runs.b = cur.w - 1 ORDER BY runs.b DESC LIMIT 1), 0),
    'best', coalesce((SELECT max(len) FROM runs), 0),
    'this_week', EXISTS (SELECT 1 FROM w, cur WHERE w.w = cur.w),
    'week_ends_at', timestamptz '2024-01-02 09:00:00+00' + make_interval(weeks => (SELECT w FROM cur) + 1)
  );
$$;
REVOKE ALL ON FUNCTION public.get_streak(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_streak(uuid) TO anon, authenticated;

-- Copie dans le profil (pour les listes) : recalculée à chaque post ajouté / supprimé.
CREATE OR REPLACE FUNCTION public.recompute_streak(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s jsonb := public.get_streak(p_user);
BEGIN
  UPDATE users_profile SET current_streak = (s->>'current')::int, longest_streak = (s->>'best')::int WHERE id = p_user;
END $$;
REVOKE ALL ON FUNCTION public.recompute_streak(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.posts_streak_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_streak(CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.posts_streak_trigger() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS posts_streak ON public.posts;
CREATE TRIGGER posts_streak AFTER INSERT OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.posts_streak_trigger();

-- Recalcul de toutes les séries à partir des posts réels.
SELECT public.recompute_streak(id) FROM public.users_profile;

-- Rappel du lundi soir (~19 h Paris) : série ≥ 1 et pas encore de vrai Shake
-- cette semaine → « Ta série de 5 semaines est en jeu ! » (réglage « streak »).
CREATE OR REPLACE FUNCTION public.send_streak_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pushes jsonb;
  v_n int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
           'userId', u.id, 'pref', 'streak', 'title', 'SHAKEmoi',
           'body', format('Ta série de %s semaine%s est en jeu ! Publie un Shake avant mardi matin.', (s->>'current'), CASE WHEN (s->>'current')::int > 1 THEN 's' ELSE '' END),
           'url', '/?open=streak:1', 'tag', 'streak-reminder')), count(*)
    INTO v_pushes, v_n
  FROM users_profile u
  CROSS JOIN LATERAL (SELECT public.get_streak(u.id) AS s) x
  WHERE (s->>'current')::int >= 1 AND NOT (s->>'this_week')::boolean
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id);
  IF v_n > 0 THEN
    PERFORM net.http_post(
      url := 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/push',
      body := jsonb_build_object('action', 'direct', 'pushes', v_pushes),
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret')),
      timeout_milliseconds := 15000);
  END IF;
  RETURN coalesce(v_n, 0);
END $$;
REVOKE ALL ON FUNCTION public.send_streak_reminders() FROM public, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Toutes les heures le lundi ; n'envoie qu'à 19 h heure de Paris (gère l'heure d'été).
SELECT cron.unschedule('shakemoi-streak-reminder') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shakemoi-streak-reminder');
SELECT cron.schedule('shakemoi-streak-reminder', '0 * * * 1',
  $$ SELECT public.send_streak_reminders() WHERE extract(hour FROM now() AT TIME ZONE 'Europe/Paris') = 19 $$);
