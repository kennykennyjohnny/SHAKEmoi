-- P24 : jusqu'à 3 sons épinglés en haut du profil (« En ce moment j'écoute »).
-- Visibles par tous ceux qui voient le profil ; seul le propriétaire modifie.
CREATE TABLE IF NOT EXISTS public.pinned_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  track_name text NOT NULL,
  artist text,
  cover_url text,
  track_id text,
  spotify_url text,
  preview_url text,
  preview_source text,
  apple_music_url text, deezer_url text, youtube_url text, youtube_music_url text, tidal_url text, odesli_page_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, position) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.pinned_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pinned_songs_read ON public.pinned_songs;
CREATE POLICY pinned_songs_read ON public.pinned_songs FOR SELECT TO anon, authenticated
  USING (NOT public.is_blocked_between(auth.uid(), user_id));
DROP POLICY IF EXISTS pinned_songs_owner ON public.pinned_songs;
CREATE POLICY pinned_songs_owner ON public.pinned_songs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Liens douteux filtrés comme partout (N-S6).
DROP TRIGGER IF EXISTS trigger_sanitize_music_links ON public.pinned_songs;
CREATE TRIGGER trigger_sanitize_music_links BEFORE INSERT OR UPDATE ON public.pinned_songs
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_music_links();

-- Réordonner d'un coup (ordre = liste d'ids), pour le propriétaire.
CREATE OR REPLACE FUNCTION public.reorder_pinned_songs(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  UPDATE pinned_songs p SET position = x.pos
  FROM (SELECT id, ordinality::smallint AS pos FROM unnest(p_ids) WITH ORDINALITY AS t(id, ordinality)) x
  WHERE p.id = x.id AND p.user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.reorder_pinned_songs(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reorder_pinned_songs(uuid[]) TO authenticated;
