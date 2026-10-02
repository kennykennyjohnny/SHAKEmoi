-- Q8 : réglages après évaluation et contrôle humain (appliqués en base le 02/10).
-- (Les fichiers 3_engine / 4_eval / 5_eval_v2 contiennent déjà les deux
-- premiers points ; ce fichier rejoue les suivants sur la fonction en place.)
--  1. Signal « potes » (social + artistes du réseau) : mémoire de 120 jours au
--     lieu de 60 (petite communauté, on poste peu).
--  2. Poids exposés comme réglages (SET LOCAL reco.w_content…) pour la
--     recherche de poids ; valeurs retenues : goût 0,40 · potes 0,35 ·
--     source 0,15 · tendances 0,05 · artistes du réseau ×0,5.
--  3. Catalogue : titres phares de TOUS les artistes partagés en public (pas
--     seulement les 6 plus forts de chacun).
--  4. Contrôle humain : 1 seul titre par artiste déjà bien connu dans une série
--     de 20 (moins de « Plus de X »), et l'exploration exclut les artistes
--     déjà aimés.
DO $do$
DECLARE d text; a text; b text;
BEGIN
  d := pg_get_functiondef('public.reco_rank(uuid, timestamptz, int, boolean)'::regprocedure);
  -- 1
  d := replace(d, '/ 86400.0 / 60),
         act.uid', '/ 86400.0 / 120),
         act.uid');
  d := replace(d, 'extract(epoch FROM (v_cut - p.created_at))) / 86400.0 / 60) AS w', 'extract(epoch FROM (v_cut - p.created_at))) / 86400.0 / 120) AS w');
  -- 2
  IF position('reco.w_content' in d) = 0 THEN
    d := replace(d, $x$  ELSE w_content := 0.40; w_social := 0.35; w_src := 0.15; w_trend := 0.05; END IF;$x$,
      $x$  ELSE w_content := 0.40; w_social := 0.35; w_src := 0.15; w_trend := 0.05; END IF;
  w_content := coalesce(nullif(current_setting('reco.w_content', true), '')::float8, w_content);
  w_social := coalesce(nullif(current_setting('reco.w_social', true), '')::float8, w_social);
  w_src := coalesce(nullif(current_setting('reco.w_src', true), '')::float8, w_src);
  w_trend := coalesce(nullif(current_setting('reco.w_trend', true), '')::float8, w_trend);
  w_crowd := coalesce(nullif(current_setting('reco.w_crowd', true), '')::float8, 0.5);$x$);
    d := replace(d, 'w_content float8; w_social float8; w_src float8; w_trend float8;', 'w_content float8; w_social float8; w_src float8; w_trend float8; w_crowd float8;');
    d := replace(d, '+ w_social * (coalesce(s.social, 0) + 0.5 * s.crowd) / nullif(mx.so, 0)', '+ w_social * (coalesce(s.social, 0) + w_crowd * s.crowd) / nullif(mx.so, 0)');
    d := replace(d, 'greatest(max(coalesce(social, 0) + 0.5 * crowd), 1e-9) so,', 'greatest(max(coalesce(social, 0) + w_crowd * crowd), 1e-9) so,');
  END IF;
  -- 4
  IF position('t.raw > 0.1)' in d) = 0 THEN
    d := replace(d, $x$SELECT * INTO c FROM rk_scored s WHERE NOT s.picked AND s.fam = ANY (v_neigh)$x$,
      $x$SELECT * INTO c FROM rk_scored s WHERE NOT s.picked AND s.fam = ANY (v_neigh)
        AND NOT EXISTS (SELECT 1 FROM rk_taste t WHERE t.typ = 'a' AND t.feat = s.akey AND t.raw > 0.1)$x$);
    d := replace(d, $x$AND (s.akey IS NULL OR (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.akey = s.akey) < 2)$x$,
      $x$AND (s.akey IS NULL OR (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.akey = s.akey)
             < CASE WHEN EXISTS (SELECT 1 FROM rk_taste t WHERE t.typ = 'a' AND t.feat = s.akey AND t.raw > 0.3) THEN 1 ELSE 2 END)$x$);
  END IF;
  EXECUTE d;
  -- 3
  d := pg_get_functiondef('public.reco_artist_seeds(int)'::regprocedure);
  IF position('Tous les artistes partagés' in d) = 0 THEN
    d := replace(d, $x$    UNION SELECT ap.artist_key FROM artist_picks ap$x$, $x$    UNION SELECT ap.artist_key FROM artist_picks ap
    -- Tous les artistes partagés en public sur SHAKEmoi (« ce que mes potes écoutent »).
    UNION SELECT DISTINCT artist_key(p.artist) FROM posts p WHERE p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL$x$);
    EXECUTE d;
  END IF;
END $do$;
