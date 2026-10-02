-- P25 / N6 (1/2) : profils d'artistes (genres fins + familles + artistes proches).

-- Clé d'un artiste : premier artiste crédité, sans « feat. », en minuscules.
CREATE OR REPLACE FUNCTION public.artist_key(p_artist text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(lower(btrim(regexp_replace(split_part(split_part(split_part(coalesce(p_artist, ''), ',', 1), ' & ', 1), ' x ', 1), '\s+(feat\.?|ft\.?|featuring)\s+.*$', '', 'i'))), '');
$$;

CREATE TABLE IF NOT EXISTS public.artist_profiles (
  artist_key text PRIMARY KEY,
  name text NOT NULL,
  spotify_id text,
  deezer_id text,
  genres text[] NOT NULL DEFAULT '{}',
  related text[] NOT NULL DEFAULT '{}',   -- artistes proches (clés), Deezer
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS artist_profiles_read ON public.artist_profiles;
CREATE POLICY artist_profiles_read ON public.artist_profiles FOR SELECT TO anon, authenticated USING (true);

-- Grandes familles : « rap français », « trap », « drill » → Rap ; etc.
CREATE OR REPLACE FUNCTION public.genre_family(g text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN g ~* '(afro|amapiano|coupe|zouk|kompa|bongo|ndombolo|highlife|musique africaine|afrobeat|afroswing|gqom|bouyon|shatta)' THEN 'Afro'
    WHEN g ~* '(rap|hip hop|hip-hop|trap|drill|grime|pop urbaine|boom bap|phonk|plugg|cloud)' THEN 'Rap'
    WHEN g ~* '(r&b|rnb|soul|neo soul|new jack)' THEN 'R&B / Soul'
    WHEN g ~* '(reggaeton|latin|dembow|urbano|bachata|salsa|cumbia|corrido|mambo|perreo|baile funk|funk carioca)' THEN 'Latin'
    WHEN g ~* '(dancehall|reggae|ska)' THEN 'Reggae / Dancehall'
    WHEN g ~* '(house|techno|edm|electro|dance|disco|trance|dubstep|drum and bass|dnb|garage|bass music|hardstyle|lo-fi|lofi|ambient|french touch)' THEN 'Électro'
    WHEN g ~* '(rock|indie|metal|punk|grunge|alternative|alternatif|shoegaze|emo|post-)' THEN 'Rock / Indé'
    WHEN g ~* '(jazz|blues|funk|gospel|swing|bossa)' THEN 'Jazz / Funk'
    WHEN g ~* '(chanson|variete|variété|french pop|nouvelle scene|nouvelle scène)' THEN 'Chanson / Variété'
    WHEN g ~* '(k-pop|kpop|j-pop|jpop|anime)' THEN 'K-pop / J-pop'
    WHEN g ~* '(country|folk|americana|bluegrass)' THEN 'Folk / Country'
    WHEN g ~* '(classical|classique|opera|orchestra|soundtrack|film|bande originale)' THEN 'Classique / BO'
    WHEN g ~* '(pop)' THEN 'Pop'
    ELSE NULL END;
$$;

-- Artistes partagés dans l'appli mais pas encore enrichis.
CREATE OR REPLACE FUNCTION public.artists_to_enrich(p_limit int DEFAULT 25)
RETURNS TABLE (artist_key text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH a AS (
    SELECT artist FROM posts UNION ALL SELECT artist FROM stories
    UNION ALL SELECT artist FROM music_reactions UNION ALL SELECT artist FROM pinned_songs
    UNION ALL SELECT artist FROM messages UNION ALL SELECT artist FROM circle_messages
  )
  SELECT artist_key(artist) AS k, min(btrim(split_part(split_part(artist, ',', 1), ' & ', 1)))
  FROM a WHERE artist_key(artist) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM artist_profiles p WHERE p.artist_key = artist_key(a.artist))
  GROUP BY 1 ORDER BY count(*) DESC LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.artists_to_enrich(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artists_to_enrich(int) TO service_role;

-- Enrichissement automatique toutes les 15 min (nouveaux artistes partagés).
CREATE OR REPLACE FUNCTION public.run_enrich_artists()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM artists_to_enrich(1)) THEN
    PERFORM net.http_post(
      url := 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/enrich-artists',
      body := jsonb_build_object('limit', 25),
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret')),
      timeout_milliseconds := 60000);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.run_enrich_artists() FROM public, anon, authenticated;
SELECT cron.unschedule('shakemoi-enrich-artists') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shakemoi-enrich-artists');
SELECT cron.schedule('shakemoi-enrich-artists', '*/15 * * * *', $$ SELECT public.run_enrich_artists() $$);
