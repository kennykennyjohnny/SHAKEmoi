-- P18 / P25 : « Personnes que tu pourrais connaître » et « Mêmes goûts que toi ».
-- P19 : invitations (qui a invité qui, abonnement mutuel, notif « a rejoint grâce à toi »).

-- Suggestions masquées (la croix sur une carte).
CREATE TABLE IF NOT EXISTS public.suggestion_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dismissed_id)
);
ALTER TABLE public.suggestion_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suggestion_dismissals_own ON public.suggestion_dismissals;
CREATE POLICY suggestion_dismissals_own ON public.suggestion_dismissals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- p_mode : 'mixed' (amis d'amis + goûts + cercles + activité),
--          'taste' (mêmes goûts, même sans ami en commun, compatibilité ≥ 75),
--          'popular' (comptes les plus suivis, pour un nouvel inscrit).
CREATE OR REPLACE FUNCTION public.get_suggestions(p_mode text DEFAULT 'mixed', p_limit int DEFAULT 12)
RETURNS TABLE (id uuid, username text, display_name text, avatar text, mutual int, taste int,
               taste_families jsonb, taste_artists jsonb, circles int, score numeric, streak int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT auth.uid() AS id),
  following AS (SELECT following_id AS id FROM follows, me WHERE follower_id = me.id),
  cand AS (
    SELECT u.id FROM users_profile u, me
    WHERE u.id <> me.id
      AND u.id NOT IN (SELECT id FROM following)
      AND NOT is_blocked_between(me.id, u.id)
      AND NOT EXISTS (SELECT 1 FROM suggestion_dismissals d WHERE d.user_id = me.id AND d.dismissed_id = u.id)
  ),
  mutual AS (
    SELECT f2.following_id AS id, count(*)::int AS n
    FROM follows f2 WHERE f2.follower_id IN (SELECT id FROM following) GROUP BY 1
  ),
  taste AS (
    SELECT CASE WHEN user_a = (SELECT id FROM me) THEN user_b ELSE user_a END AS id, score, families, artists
    FROM taste_scores WHERE (SELECT id FROM me) IN (user_a, user_b)
  ),
  circ AS (
    SELECT o.user_id AS id, count(*)::int AS n FROM circle_members mine
    JOIN circle_members o ON o.circle_id = mine.circle_id AND o.user_id <> mine.user_id
    WHERE mine.user_id = (SELECT id FROM me) GROUP BY 1
  ),
  active AS (SELECT DISTINCT user_id AS id FROM posts WHERE created_at > now() - interval '14 days'),
  pop AS (SELECT following_id AS id, count(*) AS n FROM follows GROUP BY 1),
  scored AS (
    SELECT c.id, coalesce(m.n, 0) AS mutual, t.score AS taste, t.families, t.artists, coalesce(ci.n, 0) AS circles,
      -- Poids : amis en commun (fort), goûts (fort, P25), cercles (moyen), actif (bonus).
      least(coalesce(m.n, 0), 5) * 12
      + coalesce(t.score, 0) * 0.5
      + coalesce(ci.n, 0) * 8
      + CASE WHEN c.id IN (SELECT id FROM active) THEN 6 ELSE 0 END
      + CASE WHEN p_mode = 'popular' THEN coalesce(pp.n, 0) * 2 ELSE 0 END AS score
    FROM cand c
    LEFT JOIN mutual m ON m.id = c.id
    LEFT JOIN taste t ON t.id = c.id
    LEFT JOIN circ ci ON ci.id = c.id
    LEFT JOIN pop pp ON pp.id = c.id
  )
  SELECT s.id, u.username, u.display_name, u.profile_album_cover_url, s.mutual, s.taste, s.families, s.artists, s.circles, s.score, u.current_streak
  FROM scored s JOIN users_profile u ON u.id = s.id
  WHERE CASE p_mode
    WHEN 'taste' THEN coalesce(s.taste, 0) >= 75
    WHEN 'popular' THEN true
    ELSE s.mutual > 0 OR coalesce(s.taste, 0) >= 60 OR s.circles > 0 END
  ORDER BY CASE WHEN p_mode = 'taste' THEN s.taste ELSE s.score END DESC NULLS LAST, u.created_at DESC
  LIMIT greatest(1, least(p_limit, 50));
$$;
REVOKE ALL ON FUNCTION public.get_suggestions(text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_suggestions(text, int) TO authenticated;

-- ---------- Invitations (P19) ----------
CREATE TABLE IF NOT EXISTS public.invites (
  inviter_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invitee_id)
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invites_read_own ON public.invites;
CREATE POLICY invites_read_own ON public.invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin());

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'feel', 'like', 'comment', 'reshake', 'message', 'song_share', 'follow', 'circle_post', 'circle_invite',
  'story_like', 'story_comment', 'comment_like', 'circle_join', 'circle_add', 'music_reaction', 'invite_joined']));

-- Nouveau compte arrivé par un lien /i/<pseudo> : on se suit mutuellement, on
-- garde la trace, et l'inviteur reçoit « Léa a rejoint SHAKEMOI grâce à toi ».
-- Une seule fois par compte, et seulement pour un compte récent (< 2 jours).
CREATE OR REPLACE FUNCTION public.accept_invite(p_inviter text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  me uuid := auth.uid();
  v_inviter uuid;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_inviter FROM users_profile WHERE lower(username) = lower(btrim(p_inviter));
  IF v_inviter IS NULL THEN
    SELECT user_id INTO v_inviter FROM old_usernames WHERE lower(old_username) = lower(btrim(p_inviter)) ORDER BY changed_at DESC LIMIT 1;
  END IF;
  IF v_inviter IS NULL OR v_inviter = me OR is_blocked_between(me, v_inviter) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM invites WHERE invitee_id = me) THEN RETURN v_inviter; END IF;
  IF (SELECT created_at FROM users_profile WHERE id = me) < now() - interval '2 days' THEN RETURN NULL; END IF;
  INSERT INTO invites (inviter_id, invitee_id) VALUES (v_inviter, me);
  INSERT INTO follows (follower_id, following_id) VALUES (me, v_inviter) ON CONFLICT DO NOTHING;
  INSERT INTO follows (follower_id, following_id) VALUES (v_inviter, me) ON CONFLICT DO NOTHING;
  -- Une seule notif pour l'inviteur : « a rejoint grâce à toi » (pas aussi « s'est abonné·e »).
  DELETE FROM notifications WHERE user_id = v_inviter AND from_user_id = me AND type = 'feel';
  INSERT INTO notifications (user_id, type, from_user_id) VALUES (v_inviter, 'invite_joined', me);
  RETURN v_inviter;
END $$;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- Page d'arrivée d'une invitation : 3 derniers sons publics de l'inviteur.
CREATE OR REPLACE FUNCTION public.get_invite_card(p_username text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar', u.profile_album_cover_url,
    'songs', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT id, track_name, artist, cover_url, preview_url, track_id, spotify_url FROM posts
      WHERE user_id = u.id AND circle_id IS NULL AND is_private IS NOT TRUE AND is_reshake IS NOT TRUE AND track_name IS NOT NULL
      ORDER BY created_at DESC LIMIT 3) x), '[]'::jsonb))
  FROM users_profile u WHERE lower(u.username) = lower(btrim(p_username));
$$;
REVOKE ALL ON FUNCTION public.get_invite_card(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invite_card(text) TO anon, authenticated;
