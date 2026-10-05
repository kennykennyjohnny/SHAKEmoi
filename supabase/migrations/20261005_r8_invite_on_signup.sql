-- R8 : l'invitation est enregistrée PAR LA BASE dès la création du compte si
-- l'inscription porte le parrain (options.data.referrer), même si l'appli ne
-- va pas au bout (navigateur d'Instagram fermé, confirmation par mail ailleurs…).
-- Appliquée et vérifiée sur la vraie base le 05/10/2026 (inscription simulée
-- puis annulée) : parrain « Kenny » → invitation + abonnement mutuel + notif
-- invite_joined ; parrain inconnu → le compte et le profil sont créés quand même ;
-- accept_invite rappelé ensuite → renvoie le parrain sans rien doubler.
CREATE OR REPLACE FUNCTION public._accept_invite_for(p_me uuid, p_inviter text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inviter uuid;
BEGIN
  IF p_me IS NULL OR coalesce(btrim(p_inviter), '') = '' THEN RETURN NULL; END IF;
  SELECT id INTO v_inviter FROM users_profile WHERE lower(username) = lower(btrim(p_inviter));
  IF v_inviter IS NULL THEN
    SELECT user_id INTO v_inviter FROM old_usernames WHERE lower(old_username) = lower(btrim(p_inviter)) ORDER BY changed_at DESC LIMIT 1;
  END IF;
  IF v_inviter IS NULL OR v_inviter = p_me OR is_blocked_between(p_me, v_inviter) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM invites WHERE invitee_id = p_me) THEN RETURN v_inviter; END IF;
  IF (SELECT created_at FROM users_profile WHERE id = p_me) < now() - interval '2 days' THEN RETURN NULL; END IF;
  INSERT INTO invites (inviter_id, invitee_id) VALUES (v_inviter, p_me);
  INSERT INTO follows (follower_id, following_id) VALUES (p_me, v_inviter) ON CONFLICT DO NOTHING;
  INSERT INTO follows (follower_id, following_id) VALUES (v_inviter, p_me) ON CONFLICT DO NOTHING;
  DELETE FROM notifications WHERE user_id = v_inviter AND from_user_id = p_me AND type = 'feel';
  INSERT INTO notifications (user_id, type, from_user_id) VALUES (v_inviter, 'invite_joined', p_me);
  RETURN v_inviter;
END $$;
REVOKE ALL ON FUNCTION public._accept_invite_for(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_invite(p_inviter text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN _accept_invite_for(auth.uid(), p_inviter);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  wanted text := lower(trim(coalesce(NEW.raw_user_meta_data->>'username', '')));
  display text := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name', '')), '');
BEGIN
  IF wanted = '' THEN RETURN NEW; END IF;
  IF wanted !~ '^[a-z0-9._-]{3,20}$' OR EXISTS (SELECT 1 FROM users_profile WHERE lower(username) = wanted) THEN
    wanted := left(regexp_replace(wanted, '[^a-z0-9._-]', '', 'g'), 14);
    IF length(wanted) < 3 THEN wanted := 'shaker'; END IF;
    wanted := wanted || floor(random() * 90000 + 10000)::int::text;
  END IF;
  INSERT INTO users_profile (id, username, display_name, color, feels_count, feelings_count)
  VALUES (NEW.id, wanted, coalesce(display, wanted), '#B4A7D6', 0, 0)
  ON CONFLICT (id) DO NOTHING;
  -- R8 : parrain transmis à l'inscription. Jamais bloquant pour l'inscription.
  IF coalesce(NEW.raw_user_meta_data->>'referrer', '') <> '' THEN
    BEGIN
      PERFORM _accept_invite_for(NEW.id, NEW.raw_user_meta_data->>'referrer');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'invitation à l''inscription : %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $function$;
