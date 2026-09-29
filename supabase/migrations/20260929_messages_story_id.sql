-- SHAKEMOI - Réponses et likes de stories dans les messages privés.
-- sendMessage() envoyait un story_id, mais la colonne n'existait pas :
-- l'insertion échouait en silence et les commentaires de story n'arrivaient
-- jamais dans les DM.

alter table public.messages
  add column if not exists story_id uuid references public.stories(id) on delete set null;

create index if not exists messages_story_id_idx on public.messages(story_id);
