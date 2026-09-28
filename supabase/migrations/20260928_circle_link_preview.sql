-- SHAKEMOI - Aperçu des liens de cercle (/c/<id>).
-- Les cercles ne sont lisibles que connecté (RLS). Pour l'aperçu d'un lien
-- d'invitation, on expose uniquement le nom, la photo et le nombre de membres,
-- jamais la liste des membres ni les messages.

create or replace function public.get_circle_preview(p_circle_id uuid)
returns table (name text, photo_url text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.name::text,
         c.photo_url::text,
         (select count(*) from public.circle_members m where m.circle_id = c.id)
  from public.circles c
  where c.id = p_circle_id;
$$;

revoke all on function public.get_circle_preview(uuid) from public;
grant execute on function public.get_circle_preview(uuid) to anon, authenticated;
