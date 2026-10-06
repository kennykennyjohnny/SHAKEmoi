-- Correctif 06/10 (S3) — Une adresse d'extrait morte se répare toute seule.
-- Quand un téléphone n'arrive pas à lire l'extrait d'un son, il relance la
-- résolution complète sans cache ; s'il trouve un extrait qui se lit, il
-- l'écrit ici pour TOUT le monde (posts, stories, messages, cercles, sons
-- épinglés), même sur les sons publiés par d'autres.
--
-- Garde-fous :
--  - réservé aux comptes connectés ;
--  - source = spotify | deezer | itunes, adresse limitée aux 3 formes connues
--    (adresse stable Deezer de SHAKEmoi, extraits iTunes / Spotify) ;
--  - ne remplace QUE une adresse vide, « none », un ancien extrait Deezer signé
--    ou l'adresse exacte qui vient d'échouer : un bon extrait n'est jamais écrasé ;
--  - aucun UPDATE sans WHERE (safeupdate, règle du 03/10).
CREATE OR REPLACE FUNCTION public.repair_song_preview(
  p_track_id text, p_title text, p_artist text, p_old_url text, p_url text, p_source text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  n integer := 0;
  m integer;
  t text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  IF p_source NOT IN ('spotify', 'deezer', 'itunes') THEN RETURN 0; END IF;
  IF NOT (
       p_url ~ '^https://www\.shakemoi\.fr/api/preview\?deezer=[0-9]{1,15}$'
    OR p_url ~ '^https://[a-z0-9.-]+\.(mzstatic\.com|apple\.com)/[^\s]+$'
    OR p_url ~ '^https://p\.scdn\.co/mp3-preview/[A-Za-z0-9]+(\?[^\s]*)?$'
  ) THEN RETURN 0; END IF;
  IF coalesce(p_track_id, '') = '' AND coalesce(p_title, '') = '' THEN RETURN 0; END IF;

  FOREACH t IN ARRAY ARRAY['posts', 'stories', 'messages', 'circle_messages', 'pinned_songs'] LOOP
    EXECUTE format($q$
      UPDATE public.%I x SET preview_url = $1, preview_source = $2
      WHERE (CASE WHEN coalesce($3, '') <> '' THEN x.track_id = $3
                  ELSE x.track_id IS NULL AND lower(x.track_name) = lower($4)
                       AND lower(coalesce(x.artist, '')) = lower(coalesce($5, '')) END)
        AND x.preview_url IS DISTINCT FROM $1
        AND (x.preview_url IS NULL OR x.preview_source = 'none'
             OR x.preview_url LIKE '%%dzcdn.net%%'
             OR ($6 IS NOT NULL AND x.preview_url = $6))
    $q$, t) USING p_url, p_source, p_track_id, p_title, p_artist, p_old_url;
    GET DIAGNOSTICS m = ROW_COUNT;
    n := n + m;
  END LOOP;
  RETURN n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.repair_song_preview(text, text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.repair_song_preview(text, text, text, text, text, text) TO authenticated;
