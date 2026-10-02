-- Q8 (2/3) : la compatibilité (P25) et les suggestions « mêmes goûts » (P18)
-- lisent maintenant le MÊME profil de goût que Découvrir (user_taste).
-- Même formule qu'avant (cosinus par type, 35 % familles / 25 % genres /
-- 25 % artistes / 15 % titres, étalement sur 0-100), seules les entrées
-- changent : tous les gestes pondérés (docs/reco.md) au lieu des seuls sons partagés.
CREATE OR REPLACE FUNCTION public.compute_taste_all()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n_pairs int;
BEGIN
  PERFORM build_user_taste();

  -- Sons distincts aimés (au moins 5 pour avoir un score).
  CREATE TEMP TABLE t_items ON COMMIT DROP AS SELECT * FROM taste_signals(NULL) WHERE w > 0;
  DELETE FROM taste_song_counts;
  INSERT INTO taste_song_counts (user_id, songs) SELECT user_id, count(DISTINCT skey) FROM t_items GROUP BY user_id;
  CREATE TEMP TABLE t_users ON COMMIT DROP AS SELECT user_id FROM taste_song_counts WHERE songs >= 5;

  CREATE TEMP TABLE t_vec ON COMMIT DROP AS
  SELECT t.user_id, t.typ, t.feat, t.v FROM user_taste t JOIN t_users u USING (user_id);
  CREATE INDEX ON t_vec (typ, feat);

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

  -- Explications : familles et artistes en commun, artistes proches.
  UPDATE taste_scores s SET
    families = (SELECT coalesce(jsonb_agg(feat ORDER BY m DESC), '[]') FROM (
      SELECT a.feat, least(a.v, b.v) AS m FROM t_vec a JOIN t_vec b ON a.typ = 'f' AND b.typ = 'f' AND a.feat = b.feat
      WHERE a.user_id = s.user_a AND b.user_id = s.user_b ORDER BY m DESC LIMIT 3) x),
    artists = (SELECT coalesce(jsonb_agg(coalesce(p.name, x.k) ORDER BY m DESC), '[]') FROM (
      SELECT a.k, least(a.w, b.w) AS m
      FROM (SELECT akey k, sum(w) w FROM t_items WHERE user_id = s.user_a GROUP BY 1) a
      JOIN (SELECT akey k, sum(w) w FROM t_items WHERE user_id = s.user_b GROUP BY 1) b ON a.k = b.k
      WHERE a.k IS NOT NULL ORDER BY m DESC LIMIT 3) x
      LEFT JOIN artist_profiles p ON p.artist_key = x.k),
    close_artists = (SELECT coalesce(jsonb_agg(pair), '[]') FROM (
      SELECT DISTINCT ON (pa.name) jsonb_build_array(pa.name, coalesce(pb.name, rel)) AS pair
      FROM (SELECT DISTINCT akey k FROM t_items WHERE user_id = s.user_a) ia
      JOIN artist_profiles pa ON pa.artist_key = ia.k
      CROSS JOIN LATERAL unnest(pa.related) rel
      JOIN (SELECT DISTINCT akey k FROM t_items WHERE user_id = s.user_b) ib ON ib.k = rel
      LEFT JOIN artist_profiles pb ON pb.artist_key = rel
      WHERE ia.k <> ib.k LIMIT 2) z);
  RETURN n_pairs;
END $$;
REVOKE ALL ON FUNCTION public.compute_taste_all() FROM public, anon, authenticated;
