-- M4 — Vues des stories. Idempotent.
-- Cause : la règle de lecture ne laissait chacun voir QUE ses propres vues :
-- la propriétaire d'une story ne voyait jamais qui l'avait regardée.
-- Et elle s'enregistrait comme « vue » de sa propre story (16 sur 31).

-- La propriétaire lit les vues de ses stories (et chacun garde les siennes).
DROP POLICY IF EXISTS story_views_select ON public.story_views;
CREATE POLICY story_views_select ON public.story_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  );

-- Une vue = une autre personne que la propriétaire.
DROP POLICY IF EXISTS story_views_insert ON public.story_views;
CREATE POLICY story_views_insert ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
  );

-- Nombre de vues (sans la propriétaire), pour le compteur de la story.
CREATE OR REPLACE FUNCTION public.story_view_count(p_story_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(*) FROM story_views v JOIN stories s ON s.id = v.story_id
  WHERE v.story_id = p_story_id AND v.viewer_id <> s.user_id;
$$;
GRANT EXECUTE ON FUNCTION public.story_view_count(uuid) TO authenticated;
