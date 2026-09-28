-- SHAKEMOI - Suppression de compte par l'utilisateur lui-même (RGPD, et exigé
-- par Google Play pour toute app qui crée des comptes).
-- Tout ce qui appartient au compte part en cascade (auth.users → users_profile
-- → posts, stories, messages, likes, follows…). Seule exception : les reshakes
-- d'autres personnes pointent vers l'auteur d'origine sans cascade ; on les
-- détache d'abord pour ne pas bloquer la suppression.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  update public.posts set original_user_id = null where original_user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
