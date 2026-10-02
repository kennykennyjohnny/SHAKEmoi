-- Q7 : la photo d'un cercle « ne restait pas ».
-- Cause : la règle UPDATE de `circles` est réservée au créateur. Quand un
-- autre membre changeait la photo, la base modifiait 0 ligne SANS erreur :
-- la photo s'affichait sur le moment puis disparaissait au rechargement.
-- Vu en base : @raph a mis 2 fois une photo sur « J B L » (créé par @kenny)
-- le 01/10, toutes deux refusées en silence.
--
-- Correctif : comme `rename_circle` (P8), une fonction qui laisse TOUT membre
-- changer SEULEMENT la photo, et ajoute « X a changé la photo du cercle ».

ALTER TABLE public.circle_messages DROP CONSTRAINT IF EXISTS circle_messages_kind_check;
ALTER TABLE public.circle_messages ADD CONSTRAINT circle_messages_kind_check CHECK (kind IS NULL OR kind IN ('rename', 'photo'));

CREATE OR REPLACE FUNCTION public.set_circle_photo(p_circle_id uuid, p_photo_url text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_photo_url, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi pour changer la photo du cercle.'; END IF;
  IF NOT public.is_circle_member(p_circle_id, uid) THEN
    RAISE EXCEPTION 'Seuls les membres du cercle peuvent changer sa photo.';
  END IF;
  -- Seulement une photo de notre espace public d'avatars (pas d'adresse externe).
  IF v_url IS NOT NULL AND v_url !~ '^https://vbjmhtwrfboqziwibsut\.supabase\.co/storage/v1/object/public/avatars/' THEN
    RAISE EXCEPTION 'Photo refusée.';
  END IF;
  UPDATE public.circles SET photo_url = v_url WHERE id = p_circle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cercle introuvable.'; END IF;
  INSERT INTO public.circle_messages (circle_id, sender_id, text, kind)
  VALUES (p_circle_id, uid, CASE WHEN v_url IS NULL THEN 'removed' END, 'photo');
  RETURN v_url;
END $$;
REVOKE ALL ON FUNCTION public.set_circle_photo(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_circle_photo(uuid, text) TO authenticated;

-- Rattrapage : la dernière photo envoyée par @raph pour « J B L » (toujours
-- dans le stockage) devient la photo du cercle.
UPDATE public.circles
SET photo_url = 'https://vbjmhtwrfboqziwibsut.supabase.co/storage/v1/object/public/avatars/9a598e97-a3e8-4ce7-99c7-3a34517f88ce/circle-7ac3def5-b5ed-4794-bb15-b82306e5da10-1790887671488.jpg'
WHERE id = '7ac3def5-b5ed-4794-bb15-b82306e5da10' AND photo_url IS NULL;

-- Q10 : le titre de la notif ne répète plus « SHAKEmoi » (déjà affiché par le téléphone).
CREATE OR REPLACE FUNCTION public.send_streak_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_pushes jsonb;
  v_n int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
           'userId', u.id, 'pref', 'streak', 'title', 'Ta flamme est en jeu 🔥',
           'body', format('Série de %s semaine%s · publie un Shake avant mardi matin', (s->>'current'), CASE WHEN (s->>'current')::int > 1 THEN 's' ELSE '' END),
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
END $fn$;
REVOKE ALL ON FUNCTION public.send_streak_reminders() FROM public, anon, authenticated;
