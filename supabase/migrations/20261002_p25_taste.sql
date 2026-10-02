-- P25 / N6 (2/2) : compatibilité musicale calculée en base, avec cache.
-- Recalcul de toutes les paires toutes les 30 min (léger tant qu'on est < 1000).

CREATE TABLE IF NOT EXISTS public.taste_scores (
  user_a uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  score int NOT NULL,
  raw numeric NOT NULL,
  fam numeric, gen numeric, art numeric, trk numeric,
  families jsonb, artists jsonb, close_artists jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
ALTER TABLE public.taste_scores ENABLE ROW LEVEL SECURITY;
-- Lu seulement via get_taste / suggestions (fonctions), pas directement.

CREATE TABLE IF NOT EXISTS public.taste_song_counts (
  user_id uuid PRIMARY KEY REFERENCES public.users_profile(id) ON DELETE CASCADE,
  songs int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taste_song_counts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.compute_taste_all()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n_users int; n_pairs int;
BEGIN
  -- 1. Les sons de chacun, pondérés (épinglés ×2, reshake ×0,6, éphémère / réponse ×0,7, récents ×1,5).
  CREATE TEMP TABLE t_items ON COMMIT DROP AS
  SELECT user_id, artist, song_key(track_name, artist) AS skey,
         w * CASE WHEN created_at > now() - interval '30 days' THEN 1.5 ELSE 1 END AS w
  FROM (
    SELECT user_id, track_name, artist, created_at, CASE WHEN is_reshake THEN 0.6 ELSE 1.0 END AS w
      FROM posts WHERE circle_id IS NULL AND track_name IS NOT NULL
    UNION ALL SELECT user_id, track_name, artist, created_at, 0.7 FROM stories WHERE track_name IS NOT NULL
    UNION ALL SELECT user_id, track_name, artist, created_at, 0.7 FROM music_reactions WHERE track_name IS NOT NULL
    UNION ALL SELECT user_id, track_name, artist, created_at, 2.0 FROM pinned_songs
  ) s;

  DELETE FROM taste_song_counts;
  INSERT INTO taste_song_counts (user_id, songs)
  SELECT user_id, count(DISTINCT skey) FROM t_items GROUP BY user_id;

  -- Seuil : au moins 5 sons différents.
  CREATE TEMP TABLE t_users ON COMMIT DROP AS SELECT user_id FROM taste_song_counts WHERE songs >= 5;
  SELECT count(*) INTO n_users FROM t_users;

  -- 2. Caractéristiques : familles (f), genres fins (g), artistes (a, + proches à 35 %), titres (t).
  CREATE TEMP TABLE t_feat ON COMMIT DROP AS
  WITH it AS (
    SELECT i.* , artist_key(i.artist) AS akey FROM t_items i JOIN t_users u USING (user_id)
  ), raw AS (
    SELECT user_id, 'a' AS typ, akey AS feat, w FROM it WHERE akey IS NOT NULL
    UNION ALL
    SELECT it.user_id, 'a', r.rel, it.w * 0.35 FROM it JOIN artist_profiles p ON p.artist_key = it.akey CROSS JOIN LATERAL unnest(p.related) AS r(rel)
    UNION ALL
    SELECT it.user_id, 'g', g.genre, it.w FROM it JOIN artist_profiles p ON p.artist_key = it.akey CROSS JOIN LATERAL unnest(p.genres) AS g(genre)
    UNION ALL
    SELECT it.user_id, 'f', fam, it.w FROM it JOIN artist_profiles p ON p.artist_key = it.akey
      CROSS JOIN LATERAL (SELECT DISTINCT genre_family(x) AS fam FROM unnest(p.genres) x WHERE genre_family(x) IS NOT NULL) f
    UNION ALL
    SELECT user_id, 't', skey, w FROM it
  )
  SELECT user_id, typ, feat, sum(w) AS w FROM raw GROUP BY 1, 2, 3;

  -- 3. TF-IDF : un genre que tout le monde a (« pop ») pèse moins qu'un genre distinctif.
  CREATE TEMP TABLE t_vec ON COMMIT DROP AS
  WITH df AS (SELECT typ, feat, count(DISTINCT user_id) AS df FROM t_feat GROUP BY 1, 2),
  tf AS (
    SELECT f.user_id, f.typ, f.feat, f.w * (ln((1.0 + n_users) / (1.0 + df.df)) + 1) AS v
    FROM t_feat f JOIN df USING (typ, feat)
  ),
  nrm AS (SELECT user_id, typ, sqrt(sum(v * v)) AS n FROM tf GROUP BY 1, 2)
  -- 4. Normalisation : 200 sons n'écrasent plus 10 sons.
  SELECT tf.user_id, tf.typ, tf.feat, tf.v / nullif(nrm.n, 0) AS v
  FROM tf JOIN nrm USING (user_id, typ);
  CREATE INDEX ON t_vec (typ, feat);

  -- 5. Cosinus par type, pour chaque paire.
  CREATE TEMP TABLE t_pairs ON COMMIT DROP AS
  WITH dots AS (
    SELECT a.user_id AS ua, b.user_id AS ub, a.typ, sum(a.v * b.v) AS cos
    FROM t_vec a JOIN t_vec b ON a.typ = b.typ AND a.feat = b.feat AND a.user_id < b.user_id
    GROUP BY 1, 2, 3
  ), allpairs AS (
    SELECT a.user_id AS ua, b.user_id AS ub FROM t_users a JOIN t_users b ON a.user_id < b.user_id
  )
  SELECT p.ua, p.ub,
         coalesce(max(cos) FILTER (WHERE typ = 'f'), 0) AS fam,
         coalesce(max(cos) FILTER (WHERE typ = 'g'), 0) AS gen,
         coalesce(max(cos) FILTER (WHERE typ = 'a'), 0) AS art,
         coalesce(max(cos) FILTER (WHERE typ = 't'), 0) AS trk
  FROM allpairs p LEFT JOIN dots d ON d.ua = p.ua AND d.ub = p.ub
  GROUP BY p.ua, p.ub;

  -- 6. Score brut puis étalé sur 0-100 selon le rang parmi toutes les paires
  --    (90+ = 3 % des paires), mélangé à 30 % avec la valeur absolue.
  DELETE FROM taste_scores;
  INSERT INTO taste_scores (user_a, user_b, score, raw, fam, gen, art, trk)
  SELECT ua, ub,
    least(100, greatest(0, round(0.7 * (CASE
      WHEN pr < 0.5 THEN 10 + 70 * pr
      WHEN pr < 0.9 THEN 45 + (pr - 0.5) / 0.4 * 35
      WHEN pr < 0.97 THEN 80 + (pr - 0.9) / 0.07 * 10
      ELSE 90 + (pr - 0.97) / 0.03 * 10 END) + 0.3 * 100 * raw)))::int,
    raw, fam, gen, art, trk
  FROM (
    SELECT *, percent_rank() OVER (ORDER BY raw) AS pr
    FROM (SELECT *, 0.35 * fam + 0.25 * gen + 0.25 * art + 0.15 * trk AS raw FROM t_pairs) x
  ) y;
  GET DIAGNOSTICS n_pairs = ROW_COUNT;

  -- 7. Explications : familles et artistes en commun, artistes proches.
  UPDATE taste_scores s SET
    families = (SELECT coalesce(jsonb_agg(feat ORDER BY m DESC), '[]') FROM (
      SELECT a.feat, least(a.v, b.v) AS m FROM t_vec a JOIN t_vec b ON a.typ = 'f' AND b.typ = 'f' AND a.feat = b.feat
      WHERE a.user_id = s.user_a AND b.user_id = s.user_b ORDER BY m DESC LIMIT 3) x),
    artists = (SELECT coalesce(jsonb_agg(coalesce(p.name, x.k) ORDER BY m DESC), '[]') FROM (
      SELECT a.k, least(a.w, b.w) AS m
      FROM (SELECT artist_key(artist) k, sum(w) w FROM t_items WHERE user_id = s.user_a GROUP BY 1) a
      JOIN (SELECT artist_key(artist) k, sum(w) w FROM t_items WHERE user_id = s.user_b GROUP BY 1) b ON a.k = b.k
      WHERE a.k IS NOT NULL ORDER BY m DESC LIMIT 3) x
      LEFT JOIN artist_profiles p ON p.artist_key = x.k),
    close_artists = (SELECT coalesce(jsonb_agg(pair), '[]') FROM (
      SELECT DISTINCT ON (pa.name) jsonb_build_array(pa.name, coalesce(pb.name, rel)) AS pair
      FROM (SELECT DISTINCT artist_key(artist) k FROM t_items WHERE user_id = s.user_a) ia
      JOIN artist_profiles pa ON pa.artist_key = ia.k
      CROSS JOIN LATERAL unnest(pa.related) rel
      JOIN (SELECT DISTINCT artist_key(artist) k FROM t_items WHERE user_id = s.user_b) ib ON ib.k = rel
      LEFT JOIN artist_profiles pb ON pb.artist_key = rel
      WHERE ia.k <> ib.k LIMIT 2) z);
  RETURN n_pairs;
END $$;
REVOKE ALL ON FUNCTION public.compute_taste_all() FROM public, anon, authenticated;

-- Compatibilité entre moi et quelqu'un (profil, aperçu, suggestions).
CREATE OR REPLACE FUNCTION public.get_taste(p_other uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN coalesce((SELECT songs FROM taste_song_counts WHERE user_id = auth.uid()), 0) < 5
      OR coalesce((SELECT songs FROM taste_song_counts WHERE user_id = p_other), 0) < 5
    THEN jsonb_build_object('status', 'not_enough',
      'mine', coalesce((SELECT songs FROM taste_song_counts WHERE user_id = auth.uid()), 0),
      'theirs', coalesce((SELECT songs FROM taste_song_counts WHERE user_id = p_other), 0))
    ELSE (SELECT jsonb_build_object('status', 'ok', 'score', score, 'families', families, 'artists', artists, 'close', close_artists)
          FROM taste_scores WHERE user_a = least(auth.uid(), p_other) AND user_b = greatest(auth.uid(), p_other))
  END;
$$;
REVOKE ALL ON FUNCTION public.get_taste(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_taste(uuid) TO authenticated;

SELECT cron.unschedule('shakemoi-taste') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shakemoi-taste');
SELECT cron.schedule('shakemoi-taste', '*/30 * * * *', $$ SELECT public.compute_taste_all() $$);
