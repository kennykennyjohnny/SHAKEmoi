-- Vérification de la section Q en vrai (05/10) : les tâches planifiées de 02:30
-- (shakemoi-taste et shakemoi-reco-nightly) recalculaient les goûts en même temps
-- → « duplicate key value violates unique constraint user_taste_pkey » (échec le
-- 04/10 et le 05/10). Même risque si quelqu'un ouvre Découvrir pendant la tâche.
-- Correctif : verrous (pg_advisory_xact_lock) sur build_user_taste et
-- compute_taste_all, tables de travail nettoyées au début, tâche de nuit à 02:45.
-- Appliqué sur la vraie base et appelé : compute_taste_all, compute_recos_all,
-- get_my_recos et save_artist_picks (en tant qu'utilisateur, limite 8 s) → OK.
-- (build_user_taste et compute_taste_all ont été modifiés en place, voir la base.)
SELECT cron.schedule('shakemoi-reco-nightly', '45 2 * * *', 'SELECT public.compute_recos_all()');

CREATE OR REPLACE FUNCTION public.build_user_taste()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('shakemoi.build_user_taste'));
  DROP TABLE IF EXISTS t_tv;
  CREATE TEMP TABLE t_tv ON COMMIT DROP AS SELECT * FROM taste_vectors(NULL);
  DELETE FROM user_taste WHERE true;
  INSERT INTO user_taste (user_id, typ, feat, v, raw) SELECT user_id, typ, feat, v, raw FROM t_tv WHERE v IS NOT NULL;
  INSERT INTO user_taste_meta (user_id, n_signals, n_songs, built_at)
  SELECT s.user_id, count(*) FILTER (WHERE s.w > 0), count(DISTINCT s.skey) FILTER (WHERE s.w > 0), now()
  FROM taste_signals(NULL) s GROUP BY s.user_id
  ON CONFLICT (user_id) DO UPDATE SET n_signals = EXCLUDED.n_signals, n_songs = EXCLUDED.n_songs, built_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  DROP TABLE t_tv;
  RETURN n;
END $function$;

DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.compute_taste_all()'::regprocedure);
  IF position('shakemoi.compute_taste_all' in d) = 0 THEN
    d := replace(d, E'BEGIN\n  PERFORM build_user_taste();',
      E'BEGIN\n  PERFORM pg_advisory_xact_lock(hashtext(''shakemoi.compute_taste_all''));\n  PERFORM build_user_taste();\n  DROP TABLE IF EXISTS t_items, t_users, t_vec, t_pairs;');
    IF position('shakemoi.compute_taste_all' in d) = 0 THEN RAISE EXCEPTION 'motif introuvable'; END IF;
    EXECUTE d;
  END IF;
END $mig$;
