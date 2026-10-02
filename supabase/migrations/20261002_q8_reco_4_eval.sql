-- Q8 : évaluation hors ligne (docs/reco.md § 5). Pour chaque personne avec au
-- moins 5 Shakes : on cache ses 20 % de Shakes les plus récents, on calcule son
-- top 20 « comme à cette date » (signaux d'avant seulement), et on compte
-- combien de sons cachés sont retrouvés : le son lui-même, son artiste, sa
-- famille. Base de comparaison : les tendances Global (avant la même date) pour
-- tout le monde. Rien n'est écrit (lecture seule).

CREATE OR REPLACE FUNCTION public.artist_families(p_akey text) RETURNS text[]
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(array_agg(DISTINCT genre_family(g)) FILTER (WHERE genre_family(g) IS NOT NULL), '{}')
  FROM artist_profiles p, unnest(p.genres) g WHERE p.artist_key = p_akey;
$$;

CREATE OR REPLACE FUNCTION public.eval_recos(p_k int DEFAULT 20)
RETURNS TABLE (username text, n_hidden int, hit_song int, hit_artist int, hit_family int, base_song int, base_artist int, base_family int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE
  u record;
  v_cut timestamptz;
BEGIN
  DROP TABLE IF EXISTS ev_out;
  CREATE TEMP TABLE ev_out (username text, n_hidden int, hit_song int, hit_artist int, hit_family int, base_song int, base_artist int, base_family int) ON COMMIT DROP;
  FOR u IN
    SELECT p.user_id, count(*) AS n FROM posts p
    WHERE p.is_reshake IS NOT TRUE AND p.circle_id IS NULL AND p.track_name IS NOT NULL
    GROUP BY 1 HAVING count(*) >= 5
  LOOP
    SELECT p.created_at INTO v_cut FROM posts p
    WHERE p.user_id = u.user_id AND p.is_reshake IS NOT TRUE AND p.circle_id IS NULL AND p.track_name IS NOT NULL
    ORDER BY p.created_at DESC OFFSET greatest(1, round(u.n * 0.2))::int - 1 LIMIT 1;

    DROP TABLE IF EXISTS ev_hidden, ev_rec, ev_base;
    CREATE TEMP TABLE ev_hidden ON COMMIT DROP AS
    SELECT DISTINCT song_key(p.track_name, p.artist) AS skey, artist_key(p.artist) AS akey, artist_families(artist_key(p.artist)) AS fams
    FROM posts p WHERE p.user_id = u.user_id AND p.is_reshake IS NOT TRUE AND p.circle_id IS NULL AND p.track_name IS NOT NULL AND p.created_at >= v_cut;

    CREATE TEMP TABLE ev_rec ON COMMIT DROP AS
    SELECT r.skey, artist_key(r.track->>'artist') AS akey,
           artist_families(artist_key(r.track->>'artist')) || coalesce(ARRAY[r.components->>'family'], '{}') AS fams
    FROM reco_rank(u.user_id, v_cut, p_k) r;

    -- Base : les sons les plus partagés de SHAKEmoi avant la coupure (pas déjà les miens).
    CREATE TEMP TABLE ev_base ON COMMIT DROP AS
    SELECT t.skey, t.akey, artist_families(t.akey) AS fams FROM (
      SELECT song_key(p.track_name, p.artist) AS skey, min(artist_key(p.artist)) AS akey, count(*) AS n
      FROM posts p WHERE p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL AND p.created_at < v_cut
      GROUP BY 1) t
    WHERE t.skey NOT IN (SELECT s.skey FROM taste_signals(v_cut) s WHERE s.user_id = u.user_id AND s.skey IS NOT NULL)
    ORDER BY t.n DESC, t.skey LIMIT p_k;

    INSERT INTO ev_out
    SELECT (SELECT up.username FROM users_profile up WHERE up.id = u.user_id),
      (SELECT count(*) FROM ev_hidden)::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.skey IN (SELECT skey FROM ev_rec))::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.akey IN (SELECT akey FROM ev_rec WHERE akey IS NOT NULL))::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.fams && (SELECT coalesce(array_agg(f), '{}') FROM ev_rec, unnest(ev_rec.fams) f))::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.skey IN (SELECT skey FROM ev_base))::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.akey IN (SELECT akey FROM ev_base WHERE akey IS NOT NULL))::int,
      (SELECT count(*) FROM ev_hidden h WHERE h.fams && (SELECT coalesce(array_agg(f), '{}') FROM ev_base, unnest(ev_base.fams) f))::int;
  END LOOP;
  RETURN QUERY SELECT * FROM ev_out;
END $$;
REVOKE ALL ON FUNCTION public.eval_recos(int) FROM public, anon, authenticated;
