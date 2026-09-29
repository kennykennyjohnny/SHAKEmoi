-- M10 — Like de story dans la cloche, GROUPÉ : une seule notification par
-- story (« Léa et 4 autres ont aimé ta story »). Chaque NOUVELLE personne la
-- met à jour, la remonte en haut et la repasse en non lue. Retirer puis
-- remettre un like ne crée rien. Idempotent.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE;
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_ids uuid[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_per_story_like
  ON public.notifications (user_id, story_id) WHERE type = 'story_like' AND story_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_story_like_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM stories WHERE id = NEW.story_id;
  IF owner IS NULL OR owner = NEW.user_id THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, from_user_id, story_id, actor_ids, is_read, created_at)
  VALUES (owner, 'story_like', NEW.user_id, NEW.story_id, ARRAY[NEW.user_id], false, now())
  ON CONFLICT (user_id, story_id) WHERE type = 'story_like' AND story_id IS NOT NULL
  DO UPDATE SET
    from_user_id = EXCLUDED.from_user_id,
    actor_ids = notifications.actor_ids || EXCLUDED.from_user_id,
    created_at = now(),
    is_read = false
  -- Déjà comptée (a retiré puis remis son like) : rien ne bouge.
  WHERE NOT (EXCLUDED.from_user_id = ANY (notifications.actor_ids));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_story_like_notification ON public.story_likes;
CREATE TRIGGER trigger_story_like_notification AFTER INSERT ON public.story_likes
  FOR EACH ROW EXECUTE FUNCTION public.create_story_like_notification();
