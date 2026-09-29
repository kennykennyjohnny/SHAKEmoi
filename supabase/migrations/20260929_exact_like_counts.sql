-- SHAKEMOI - Compteurs de likes / commentaires toujours exacts.
-- Un like de post était compté deux fois : le trigger update_like_counts ET
-- l'appel increment_likes de l'app (ex. 4 affichés pour 2 likes réels).
-- Désormais chaque mise à jour RECOMPTE au lieu de faire +1 / -1 : trigger et
-- anciennes fonctions (encore appelées par les versions de l'app en cache)
-- convergent vers la même valeur exacte.

-- Posts : likes
create or replace function public.update_like_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update posts set likes_count = (select count(*) from likes where post_id = pid) where id = pid;
  if tg_op = 'INSERT' then
    update users_profile u set feelings_count = feelings_count + 1 from posts p where p.id = new.post_id and u.id = p.user_id;
  elsif tg_op = 'DELETE' then
    update users_profile u set feelings_count = greatest(feelings_count - 1, 0) from posts p where p.id = old.post_id and u.id = p.user_id;
  end if;
  return null;
end $$;

create or replace function public.increment_likes(post_id uuid)
returns void language sql security definer set search_path = public as $$
  update posts set likes_count = (select count(*) from likes l where l.post_id = increment_likes.post_id)
  where id = increment_likes.post_id;
$$;

create or replace function public.decrement_likes(post_id uuid)
returns void language sql security definer set search_path = public as $$
  update posts set likes_count = (select count(*) from likes l where l.post_id = decrement_likes.post_id)
  where id = decrement_likes.post_id;
$$;

-- Posts : commentaires
create or replace function public.update_comment_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update posts set comments_count = (select count(*) from comments where post_id = pid) where id = pid;
  if tg_op = 'INSERT' then
    update users_profile u set feelings_count = feelings_count + 1 from posts p where p.id = new.post_id and u.id = p.user_id;
  elsif tg_op = 'DELETE' then
    update users_profile u set feelings_count = greatest(feelings_count - 1, 0) from posts p where p.id = old.post_id and u.id = p.user_id;
  end if;
  return null;
end $$;

-- Stories : un trigger qui recompte, les anciennes fonctions recomptent aussi.
create or replace function public.update_story_like_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.story_id, old.story_id);
begin
  update stories set likes_count = (select count(*) from story_likes where story_id = sid) where id = sid;
  return null;
end $$;

drop trigger if exists trigger_update_story_likes on public.story_likes;
create trigger trigger_update_story_likes
  after insert or delete on public.story_likes
  for each row execute function public.update_story_like_counts();

create or replace function public.increment_story_likes(story_id uuid)
returns void language sql security definer set search_path = public as $$
  update stories set likes_count = (select count(*) from story_likes l where l.story_id = increment_story_likes.story_id)
  where id = increment_story_likes.story_id;
$$;

create or replace function public.decrement_story_likes(story_id uuid)
returns void language sql security definer set search_path = public as $$
  update stories set likes_count = (select count(*) from story_likes l where l.story_id = decrement_story_likes.story_id)
  where id = decrement_story_likes.story_id;
$$;

-- Remise à niveau de tous les compteurs existants.
update posts p set
  likes_count = (select count(*) from likes l where l.post_id = p.id),
  comments_count = (select count(*) from comments c where c.post_id = p.id);
update stories s set likes_count = (select count(*) from story_likes l where l.story_id = s.id);
