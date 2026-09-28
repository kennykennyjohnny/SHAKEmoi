-- SHAKEMOI - Les emails ne sont plus exposés via users_profile.
-- users_profile est lisible par tout le monde (profils publics) : la colonne
-- email y rendait l'adresse de chaque compte lisible par n'importe quel
-- visiteur. L'email vit déjà dans auth.users (vérifié : 29/29 identiques),
-- on vide donc la copie publique et on empêche qu'elle se remplisse à nouveau
-- (y compris par une ancienne version de l'app encore en cache).

alter table public.users_profile alter column email drop not null;

create or replace function public.users_profile_strip_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := null;
  return new;
end;
$$;

drop trigger if exists users_profile_strip_email on public.users_profile;
create trigger users_profile_strip_email
  before insert or update on public.users_profile
  for each row execute function public.users_profile_strip_email();

update public.users_profile set email = null where email is not null;
