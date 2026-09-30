-- O1 — Tuto et appli d'écoute enregistrés dans le PROFIL (plus dans le
-- téléphone) : jamais rejoué après une déconnexion ou sur un autre appareil.
-- Idempotent, ajouts seulement.

ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS preferred_streaming_app text;

-- Ancien nom de colonne (preferred_platform) : valeurs historiques 'apple', 'youtube'…
CREATE OR REPLACE FUNCTION public.normalize_streaming_app(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(coalesce(p, ''))
    WHEN 'spotify' THEN 'spotify'
    WHEN 'apple' THEN 'apple_music' WHEN 'apple_music' THEN 'apple_music' WHEN 'itunes' THEN 'apple_music'
    WHEN 'deezer' THEN 'deezer'
    WHEN 'youtube' THEN 'youtube_music' WHEN 'youtube_music' THEN 'youtube_music'
    WHEN 'soundcloud' THEN 'soundcloud'
    WHEN 'amazon' THEN 'amazon_music' WHEN 'amazon_music' THEN 'amazon_music'
    WHEN 'tidal' THEN 'tidal'
    ELSE NULL END;
$$;

-- Les deux colonnes restent synchronisées (une appli pas encore mise à jour
-- sur un téléphone écrit encore preferred_platform).
CREATE OR REPLACE FUNCTION public.sync_streaming_app()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.preferred_streaming_app IS DISTINCT FROM OLD.preferred_streaming_app THEN
    NEW.preferred_streaming_app := normalize_streaming_app(NEW.preferred_streaming_app);
    IF NEW.preferred_streaming_app IS NOT NULL THEN NEW.preferred_platform := NEW.preferred_streaming_app; END IF;
  ELSIF NEW.preferred_platform IS DISTINCT FROM OLD.preferred_platform THEN
    NEW.preferred_streaming_app := normalize_streaming_app(NEW.preferred_platform);
  END IF;
  IF NEW.preferred_streaming_app IS NULL AND NEW.preferred_platform IS NOT NULL THEN
    NEW.preferred_streaming_app := normalize_streaming_app(NEW.preferred_platform);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_sync_streaming_app ON public.users_profile;
CREATE TRIGGER trigger_sync_streaming_app BEFORE INSERT OR UPDATE OF preferred_streaming_app, preferred_platform
  ON public.users_profile FOR EACH ROW EXECUTE FUNCTION public.sync_streaming_app();

UPDATE public.users_profile SET preferred_streaming_app = normalize_streaming_app(preferred_platform)
WHERE preferred_streaming_app IS NULL AND preferred_platform IS NOT NULL;

-- Comptes existants : tuto considéré comme fait (une seule fois, à la création de la colonne).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE onboarding_completed_at IS NOT NULL) THEN
    UPDATE public.users_profile SET onboarding_completed_at = coalesce(created_at, now());
  END IF;
END $$;
