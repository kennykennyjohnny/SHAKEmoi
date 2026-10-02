-- Q9 : « Choisis au moins 3 artistes que tu aimes ».
-- Les artistes choisis vont dans le profil de goût (poids de départ ~1, qui
-- s'efface avec les vrais usages : voir taste_vectors), donc aussi dans la
-- compatibilité (P25), les suggestions (P18) et Découvrir (Q8).

-- Enregistre MA sélection (remplace la précédente), puis recalcule tout de suite
-- mon goût et ma liste Découvrir ; les genres des nouveaux artistes arrivent
-- par l'enrichissement automatique.
CREATE OR REPLACE FUNCTION public.save_artist_picks(p_picks jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connecte-toi.'; END IF;
  IF jsonb_array_length(coalesce(p_picks, '[]'::jsonb)) > 50 THEN RAISE EXCEPTION 'Trop d''artistes.'; END IF;
  DELETE FROM artist_picks WHERE user_id = me
    AND artist_key NOT IN (SELECT artist_key(x->>'name') FROM jsonb_array_elements(p_picks) x WHERE artist_key(x->>'name') IS NOT NULL);
  INSERT INTO artist_picks (user_id, artist_key, name, deezer_id, picture_url)
  SELECT DISTINCT ON (artist_key(x->>'name')) me, artist_key(x->>'name'), left(x->>'name', 120), nullif(x->>'id', ''), nullif(x->>'picture', '')
  FROM jsonb_array_elements(p_picks) x WHERE artist_key(x->>'name') IS NOT NULL
  ON CONFLICT (user_id, artist_key) DO UPDATE SET name = EXCLUDED.name, deezer_id = coalesce(EXCLUDED.deezer_id, artist_picks.deezer_id), picture_url = coalesce(EXCLUDED.picture_url, artist_picks.picture_url);
  SELECT count(*) INTO n FROM artist_picks WHERE user_id = me;
  PERFORM build_user_taste();
  PERFORM compute_recos(me);
  PERFORM run_enrich_artists();
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.save_artist_picks(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_artist_picks(jsonb) TO authenticated;

-- Les artistes choisis sont enrichis (genres, artistes proches) comme ceux qu'on partage.
CREATE OR REPLACE FUNCTION public.artists_to_enrich(p_limit int DEFAULT 25)
RETURNS TABLE (artist_key text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH a AS (
    SELECT artist FROM posts UNION ALL SELECT artist FROM stories
    UNION ALL SELECT artist FROM music_reactions UNION ALL SELECT artist FROM pinned_songs
    UNION ALL SELECT artist FROM messages UNION ALL SELECT artist FROM circle_messages
    UNION ALL SELECT name FROM artist_picks
  )
  SELECT artist_key(artist) AS k, min(btrim(split_part(split_part(artist, ',', 1), ' & ', 1)))
  FROM a WHERE artist_key(artist) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM artist_profiles p WHERE p.artist_key = artist_key(a.artist))
  GROUP BY 1 ORDER BY count(*) DESC LIMIT p_limit;
$$;

-- Le catalogue ne crée plus de fiche vide pour un artiste choisi (sinon
-- l'enrichissement le croyait déjà fait) : il attend la fiche enrichie.
CREATE OR REPLACE FUNCTION public.reco_artist_seeds(p_limit int DEFAULT 20)
RETURNS TABLE (artist_key text, name text, deezer_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH strong AS (
    SELECT t.feat AS k FROM (
      SELECT ut.feat, row_number() OVER (PARTITION BY ut.user_id ORDER BY ut.raw DESC) AS rn
      FROM user_taste ut WHERE ut.typ = 'a') t WHERE t.rn <= 6
    UNION SELECT ap.artist_key FROM artist_picks ap
    -- Tous les artistes partagés en public sur SHAKEmoi (« ce que mes potes écoutent »).
    UNION SELECT DISTINCT artist_key(p.artist) FROM posts p WHERE p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL
  )
  SELECT p.artist_key, p.name, p.deezer_id FROM artist_profiles p JOIN strong s ON s.k = p.artist_key
  WHERE p.catalog_at IS NULL OR p.catalog_at < now() - interval '30 days'
  ORDER BY p.catalog_at NULLS FIRST LIMIT p_limit;
END $$;
-- Les fiches vides déjà créées pour des artistes choisis (aucune à ce jour) seraient ré-enrichies.
DELETE FROM artist_profiles WHERE source = 'tuto' AND cardinality(genres) = 0;
