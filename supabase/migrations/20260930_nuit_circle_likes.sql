-- NUIT — Likes des messages de cercle : le compteur restait à 0 (mise à jour
-- faite avec les droits de l'appli, refusée sans bruit). Un déclencheur recompte.
CREATE OR REPLACE FUNCTION public.recount_circle_message_likes(p_message uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE circle_messages SET likes_count = (SELECT count(*) FROM circle_message_likes WHERE message_id = p_message)
  WHERE id = p_message;
$$;
CREATE OR REPLACE FUNCTION public.update_circle_message_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM recount_circle_message_likes(CASE WHEN TG_OP = 'DELETE' THEN OLD.message_id ELSE NEW.message_id END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trigger_circle_message_like_counts ON public.circle_message_likes;
CREATE TRIGGER trigger_circle_message_like_counts AFTER INSERT OR DELETE ON public.circle_message_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_circle_message_like_counts();
REVOKE EXECUTE ON FUNCTION public.update_circle_message_like_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recount_circle_message_likes(uuid) FROM PUBLIC, anon, authenticated;

-- Anciennes versions de l'appli : ces appels recomptent au lieu de +1/-1.
CREATE OR REPLACE FUNCTION public.increment_circle_message_likes(message_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT recount_circle_message_likes($1) $$;
CREATE OR REPLACE FUNCTION public.decrement_circle_message_likes(message_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT recount_circle_message_likes($1) $$;

UPDATE public.circle_messages m SET likes_count = x.n
FROM (SELECT cm.id, (SELECT count(*) FROM circle_message_likes l WHERE l.message_id = cm.id) AS n FROM circle_messages cm) x
WHERE x.id = m.id AND coalesce(m.likes_count, 0) <> x.n;
