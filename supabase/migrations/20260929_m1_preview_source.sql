-- M1 — Extrait de chaque son enregistré avec sa source, pour ne pas le
-- rechercher à chaque lecture. Idempotent, colonnes ajoutées seulement.
--   preview_url    : extrait Spotify / iTunes, ou adresse stable
--                    https://www.shakemoi.fr/api/preview?deezer=<id>
--   preview_source : 'spotify' | 'deezer' | 'itunes' | 'none' (aucun extrait trouvé)

ALTER TABLE public.posts           ADD COLUMN IF NOT EXISTS preview_source text;
ALTER TABLE public.stories         ADD COLUMN IF NOT EXISTS preview_source text;
ALTER TABLE public.messages        ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.messages        ADD COLUMN IF NOT EXISTS preview_source text;
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS preview_source text;
