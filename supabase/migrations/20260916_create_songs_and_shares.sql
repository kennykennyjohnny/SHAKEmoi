-- ============================================================
-- SHAKEmoi — Étape 1 : Fondation data (partage de son sans compte)
-- Appliqué en prod le 2026-09-16
-- ============================================================

-- songs : cache des sons résolus (liens multi-plateformes) = anti-redirect
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'itunes',   -- 'itunes' | 'spotify' | 'odesli'...
  source_id text NOT NULL,                 -- id du son sur la source (ex: iTunes trackId)
  isrc text,                               -- clé universelle inter-plateformes si dispo
  track_name text NOT NULL,
  artist text NOT NULL,
  album text,
  cover_url text,
  preview_url text,                        -- extrait 30s (iTunes)
  duration_ms integer,
  spotify_url text,
  apple_music_url text,
  deezer_url text,
  youtube_url text,
  youtube_music_url text,
  tidal_url text,
  odesli_page_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_songs_isrc ON public.songs(isrc);

-- shares : chaque partage (anonyme autorisé => user_id NULL)
CREATE TABLE IF NOT EXISTS public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,               -- id court pour l'URL publique ?song=<slug>
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = partage anonyme
  channel text,                            -- 'web-share' | 'qr' | 'copy' | 'friend'
  platform_hint text,                      -- plateforme préférée au moment du partage
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shares_song_id ON public.shares(song_id);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);

-- ---------------- RLS ----------------
ALTER TABLE public.songs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "songs_select_public" ON public.songs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "songs_insert_any" ON public.songs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "shares_select_public" ON public.shares
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shares_insert_anon" ON public.shares
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "shares_insert_auth" ON public.shares
  FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Incrément de vues (SECURITY DEFINER, search_path fixé, callable public)
CREATE OR REPLACE FUNCTION public.increment_share_views(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shares SET view_count = view_count + 1 WHERE slug = p_slug;
$$;
