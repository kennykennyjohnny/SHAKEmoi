-- P20 : récap de la semaine (la semaine qui vient de se terminer, remise à
-- zéro le mardi 9 h UTC comme les séries). Seulement pour soi.

CREATE OR REPLACE FUNCTION public.get_weekly_recap()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  me uuid := auth.uid();
  w int := shake_week(now()) - 1;
  w_start timestamptz := timestamptz '2024-01-02 09:00:00+00' + make_interval(weeks => shake_week(now()) - 1);
  w_end timestamptz := timestamptz '2024-01-02 09:00:00+00' + make_interval(weeks => shake_week(now()));
  v_shakes int;
  v_likes int;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_shakes FROM posts
  WHERE user_id = me AND is_reshake IS NOT TRUE AND circle_id IS NULL AND created_at >= w_start AND created_at < w_end;

  SELECT count(*) INTO v_likes FROM likes l JOIN posts p ON p.id = l.post_id
  WHERE p.user_id = me AND l.user_id <> me AND l.created_at >= w_start AND l.created_at < w_end;

  RETURN jsonb_build_object(
    'week', w, 'start', w_start, 'end', w_end,
    'shakes', v_shakes,
    'likes', v_likes,
    'streak', coalesce((get_streak(me)->>'current')::int, 0),
    -- Mes 3 sons les plus likés de la semaine (posts publics seulement : ils peuvent finir dans une vidéo partagée).
    'top', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT p.id, p.track_name AS title, p.artist, p.cover_url AS cover, p.preview_url, p.track_id, p.spotify_url,
             (SELECT count(*) FROM likes l WHERE l.post_id = p.id AND l.user_id <> me)::int AS likes
      FROM posts p
      WHERE p.user_id = me AND p.is_reshake IS NOT TRUE AND p.circle_id IS NULL AND p.is_private IS NOT TRUE
        AND p.track_name IS NOT NULL AND p.created_at >= w_start AND p.created_at < w_end
      ORDER BY likes DESC, p.created_at DESC LIMIT 3) x), '[]'::jsonb),
    -- Genre du moment : la famille (N6) la plus présente dans mes sons de la semaine.
    'genre', (
      SELECT fam FROM (
        SELECT genre_family(g) AS fam, count(*) AS n
        FROM (
          SELECT artist FROM posts WHERE user_id = me AND circle_id IS NULL AND created_at >= w_start AND created_at < w_end AND artist IS NOT NULL
          UNION ALL SELECT artist FROM stories WHERE user_id = me AND created_at >= w_start AND created_at < w_end AND artist IS NOT NULL
          UNION ALL SELECT artist FROM music_reactions WHERE user_id = me AND created_at >= w_start AND created_at < w_end AND artist IS NOT NULL
        ) s
        JOIN artist_profiles ap ON ap.artist_key = artist_key(s.artist)
        CROSS JOIN LATERAL unnest(ap.genres) AS g
        GROUP BY 1
      ) f WHERE fam IS NOT NULL ORDER BY n DESC, fam LIMIT 1),
    -- Meilleur match musical (P25), hors personnes bloquées.
    'match', (
      SELECT jsonb_build_object('id', u.id, 'username', u.username, 'avatar', u.profile_album_cover_url, 'score', t.score)
      FROM taste_scores t
      JOIN users_profile u ON u.id = CASE WHEN t.user_a = me THEN t.user_b ELSE t.user_a END
      WHERE (t.user_a = me OR t.user_b = me) AND NOT is_blocked_between(me, u.id)
      ORDER BY t.score DESC LIMIT 1)
  );
END $$;
REVOKE ALL ON FUNCTION public.get_weekly_recap() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_recap() TO authenticated;
