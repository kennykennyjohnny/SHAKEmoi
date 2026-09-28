-- SHAKEMOI - Épingler une story sur son profil.
-- La table stories n'avait aucune règle UPDATE : l'épinglage (is_pinned)
-- était silencieusement ignoré (0 ligne modifiée, pas d'erreur).
-- Seul l'auteur peut modifier sa story.

drop policy if exists stories_update_own on public.stories;
create policy stories_update_own on public.stories
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
