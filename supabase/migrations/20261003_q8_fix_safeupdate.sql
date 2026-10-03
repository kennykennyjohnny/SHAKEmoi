-- Correctif 03/10 : les connexions de l'appli (PostgREST) chargent l'extension
-- « safeupdate », qui REFUSE tout DELETE / UPDATE sans WHERE (« DELETE requires
-- a WHERE clause »). build_user_taste (appelée par Découvrir et par « Choisis
-- 3 artistes ») faisait « DELETE FROM user_taste; » → les deux échouaient en
-- vrai. Les tests passaient car faits depuis une connexion sans safeupdate.
-- Règle : dans toute fonction appelable par l'appli, jamais de DELETE/UPDATE
-- sans WHERE (mettre « WHERE true » si on vide tout).
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.build_user_taste()'::regprocedure);
  d := replace(d, 'DELETE FROM user_taste;', 'DELETE FROM user_taste WHERE true;');
  EXECUTE d;
  d := pg_get_functiondef('public.compute_taste_all()'::regprocedure);
  d := replace(d, 'DELETE FROM taste_song_counts;', 'DELETE FROM taste_song_counts WHERE true;');
  d := replace(d, 'DELETE FROM taste_scores;', 'DELETE FROM taste_scores WHERE true;');
  EXECUTE d;
  d := pg_get_functiondef('public.reco_rank(uuid, timestamptz, int, boolean)'::regprocedure);
  d := replace(d, 'greatest(max(trend), 1e-9) tr FROM rk_scored) mx;', 'greatest(max(trend), 1e-9) tr FROM rk_scored) mx WHERE true;');
  d := replace(d, 'UPDATE rk_scored s SET score = coalesce(s.score, 0);', 'UPDATE rk_scored s SET score = coalesce(s.score, 0) WHERE true;');
  EXECUTE d;
END $do$;
