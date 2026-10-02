-- Q8 : évaluation v2 — les « sons » cachés sont les 20 % de sons les plus
-- récents de TOUS les gestes positifs (Shakes, reshakes, likes, Shakes
-- éphémères, réponses en musique), pas seulement les Shakes publiés : plus de
-- données, chiffres plus fiables. Base : tendances Global (le plus partagé,
-- égalités départagées par le plus récent) avant la même date.
-- n_reach : sons cachés « atteignables » (déjà partagés par quelqu'un d'autre
-- avant la coupure, ou présents au catalogue) ; les autres (ex. un like sur un
-- post publié APRÈS la coupure) ne peuvent être devinés par aucun moteur.
DROP FUNCTION IF EXISTS public.eval_recos(int);
CREATE OR REPLACE FUNCTION public.eval_recos(p_k int DEFAULT 20)
RETURNS TABLE (username text, n_hidden int, n_reach int, hit_song int, hit_artist int, hit_family int, base_song int, base_artist int, base_family int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE
  u record;
  v_cut timestamptz;
BEGIN
  DROP TABLE IF EXISTS ev_out, ev_all;
  CREATE TEMP TABLE ev_out (username text, n_hidden int, n_reach int, hit_song int, hit_artist int, hit_family int, base_song int, base_artist int, base_family int) ON COMMIT DROP;
  -- Premier contact de chacun avec chaque son (geste positif).
  CREATE TEMP TABLE ev_all ON COMMIT DROP AS
  SELECT s.user_id, s.skey, min(s.akey) AS akey, min(s.at) AS first_at FROM taste_signals(NULL) s
  WHERE s.w > 0 AND s.kind <> 'listen' AND s.skey IS NOT NULL GROUP BY 1, 2;
  FOR u IN SELECT a.user_id, count(*) AS n FROM ev_all a GROUP BY 1 HAVING count(*) >= 5 LOOP
    SELECT a.first_at INTO v_cut FROM ev_all a WHERE a.user_id = u.user_id
    ORDER BY a.first_at DESC OFFSET greatest(1, round(u.n * 0.2))::int - 1 LIMIT 1;

    DROP TABLE IF EXISTS ev_hidden, ev_rec, ev_base;
    CREATE TEMP TABLE ev_hidden ON COMMIT DROP AS
    SELECT a.skey, a.akey, artist_families(a.akey) AS fams FROM ev_all a WHERE a.user_id = u.user_id AND a.first_at >= v_cut;

    CREATE TEMP TABLE ev_rec ON COMMIT DROP AS
    SELECT r.skey, artist_key(r.track->>'artist') AS akey,
           artist_families(artist_key(r.track->>'artist')) || coalesce(ARRAY[r.components->>'family'], '{}') AS fams
    FROM reco_rank(u.user_id, v_cut, p_k) r;

    CREATE TEMP TABLE ev_base ON COMMIT DROP AS
    SELECT t.skey, t.akey, artist_families(t.akey) AS fams FROM (
      SELECT song_key(p.track_name, p.artist) AS skey, min(artist_key(p.artist)) AS akey, count(*) AS n, max(p.created_at) AS last_at
      FROM posts p WHERE p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL AND p.created_at < v_cut
      GROUP BY 1) t
    WHERE t.skey NOT IN (SELECT s.skey FROM taste_signals(v_cut) s WHERE s.user_id = u.user_id AND s.skey IS NOT NULL)
    ORDER BY t.n DESC, t.last_at DESC LIMIT p_k;

    INSERT INTO ev_out
    SELECT (SELECT up.username FROM users_profile up WHERE up.id = u.user_id),
      (SELECT count(*) FROM ev_hidden)::int,
      (SELECT count(*) FROM ev_hidden h WHERE EXISTS (SELECT 1 FROM catalog_tracks c WHERE c.song_key = h.skey)
         OR EXISTS (SELECT 1 FROM posts p WHERE p.user_id <> u.user_id AND p.circle_id IS NULL AND p.is_private IS NOT TRUE
                    AND p.created_at < v_cut AND song_key(p.track_name, p.artist) = h.skey))::int,
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
