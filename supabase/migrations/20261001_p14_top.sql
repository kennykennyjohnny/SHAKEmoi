-- P14 : le TOP calculé en base, en une seule requête, pour « Amis » (moi + les
-- gens que je suis) et « Tout SHAKEMOI ». Périodes : 7 j, 30 j, 0 = depuis toujours.
-- Jamais de post privé ni de cercle. Ne renvoie que des agrégats publics.
--
-- Un « même son » = même titre (sans les mentions entre parenthèses, « feat. »,
-- « remastered »…) + même premier artiste : un titre partagé depuis l'album et
-- depuis le single ne compte qu'une fois (l'ISRC n'est pas enregistré sur les posts).

CREATE OR REPLACE FUNCTION public.song_key(p_title text, p_artist text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(regexp_replace(coalesce(p_title, ''), '\s*[\(\[][^\)\]]*[\)\]]|\s+-\s+.*$', '', 'g')))
      || '|' || lower(btrim(split_part(split_part(coalesce(p_artist, ''), ',', 1), '&', 1)));
$$;

CREATE OR REPLACE FUNCTION public.get_top(p_scope text DEFAULT 'friends', p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH me AS (SELECT auth.uid() AS id),
  people AS (
    SELECT following_id AS id FROM follows, me WHERE follower_id = me.id
    UNION SELECT id FROM me
  ),
  p AS (
    SELECT po.*, public.song_key(po.track_name, po.artist) AS skey
    FROM posts po
    WHERE po.circle_id IS NULL AND po.is_private IS NOT TRUE AND po.track_name IS NOT NULL
      AND (p_days <= 0 OR po.created_at >= now() - make_interval(days => p_days))
      AND (p_scope = 'all' OR po.user_id IN (SELECT id FROM people))
  ),
  -- Sons les plus shakés : posts + reshakes, toutes personnes confondues.
  shaked AS (
    SELECT skey, count(*) AS shakes, count(DISTINCT user_id) AS people,
           (array_agg(id ORDER BY (is_reshake IS TRUE), created_at DESC))[1] AS post_id,
           (array_agg(id ORDER BY created_at DESC))[1:30] AS post_ids,
           max(created_at) AS last_at
    FROM p GROUP BY skey
  ),
  -- Sons les plus likés : likes des posts d'origine de la période.
  liked AS (
    SELECT skey, sum(likes_count) AS likes,
           (array_agg(id ORDER BY likes_count DESC, created_at DESC))[1] AS post_id,
           (array_agg(id ORDER BY created_at DESC))[1:30] AS post_ids
    FROM p WHERE is_reshake IS NOT TRUE GROUP BY skey HAVING sum(likes_count) > 0
  ),
  song AS (  -- infos d'affichage : le post d'origine le plus récent du son
    SELECT DISTINCT ON (skey) skey, id, track_name, artist, cover_url, track_id, spotify_url, preview_url,
           apple_music_url, deezer_url, youtube_url, youtube_music_url, tidal_url, odesli_page_url
    FROM p ORDER BY skey, (is_reshake IS TRUE), created_at DESC
  ),
  sharers AS (
    SELECT skey, jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'avatar', u.profile_album_cover_url) ORDER BY last DESC) AS list
    FROM (SELECT skey, user_id, max(created_at) AS last FROM p GROUP BY skey, user_id) x
    JOIN users_profile u ON u.id = x.user_id
    GROUP BY skey
  ),
  artists AS (
    SELECT lower(btrim(split_part(artist, ',', 1))) AS akey, (array_agg(btrim(split_part(artist, ',', 1)) ORDER BY created_at DESC))[1] AS name,
           count(*) AS shakes, count(DISTINCT user_id) AS people, (array_agg(cover_url ORDER BY created_at DESC))[1] AS cover
    FROM p GROUP BY 1
  ),
  active AS (
    SELECT user_id, count(*) FILTER (WHERE is_reshake IS NOT TRUE) AS shakes, count(*) FILTER (WHERE is_reshake) AS reshakes
    FROM p GROUP BY user_id
  )
  SELECT jsonb_build_object(
    'shaked', coalesce((SELECT jsonb_agg(r ORDER BY (r->>'shakes')::int DESC, (r->>'people')::int DESC, r->>'last_at' DESC) FROM (
      SELECT to_jsonb(s.*) - 'skey' - 'id' || jsonb_build_object('key', sh.skey, 'shakes', sh.shakes, 'people', sh.people,
             'post_id', sh.post_id, 'post_ids', to_jsonb(sh.post_ids), 'last_at', sh.last_at, 'sharers', coalesce(sr.list, '[]'::jsonb)) AS r
      FROM shaked sh JOIN song s USING (skey) LEFT JOIN sharers sr USING (skey)
      ORDER BY sh.shakes DESC, sh.people DESC, sh.last_at DESC LIMIT 20) t), '[]'::jsonb),
    'liked', coalesce((SELECT jsonb_agg(r ORDER BY (r->>'likes')::int DESC) FROM (
      SELECT to_jsonb(s.*) - 'skey' - 'id' || jsonb_build_object('key', l.skey, 'likes', l.likes, 'post_id', l.post_id, 'post_ids', to_jsonb(l.post_ids)) AS r
      FROM liked l JOIN song s USING (skey) ORDER BY l.likes DESC LIMIT 10) t), '[]'::jsonb),
    'artists', coalesce((SELECT jsonb_agg(to_jsonb(a.*) - 'akey' ORDER BY a.shakes DESC, a.people DESC) FROM (
      SELECT * FROM artists WHERE akey <> '' ORDER BY shakes DESC, people DESC LIMIT 10) a), '[]'::jsonb),
    'people', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar', u.profile_album_cover_url, 'shakes', a.shakes, 'reshakes', a.reshakes) ORDER BY a.shakes DESC, a.reshakes DESC)
      FROM (SELECT * FROM active ORDER BY shakes DESC, reshakes DESC LIMIT 10) a JOIN users_profile u ON u.id = a.user_id), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_top(text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_top(text, int) TO authenticated;
