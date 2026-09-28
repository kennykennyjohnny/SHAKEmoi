-- SHAKEMOI - Archives de stories privées.
-- Une story expirée n'est plus visible que par son auteur (ses archives),
-- sauf s'il l'a épinglée « À la une » sur son profil.

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id in (select f.following_id from public.follows f where f.follower_id = auth.uid())
      and (expires_at > now() or is_pinned)
    )
  );
