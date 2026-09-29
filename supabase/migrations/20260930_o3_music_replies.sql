-- O3 — Une réponse en musique compte comme un commentaire. Idempotent.
-- + Sécurité : commentaires, likes et réponses en musique ne sont plus
--   lisibles que si on peut voir le post (avant : lisibles par tous, même
--   sur un post privé ou de cercle).

-- Extrait du son des réponses en musique (M1).
ALTER TABLE public.music_reactions ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.music_reactions ADD COLUMN IF NOT EXISTS preview_source text;

-- Compteur = commentaires texte + réponses en musique.
CREATE OR REPLACE FUNCTION public.recount_comments(p_post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE posts SET comments_count =
    (SELECT count(*) FROM comments WHERE post_id = p_post_id)
    + (SELECT count(*) FROM music_reactions WHERE post_id = p_post_id)
  WHERE id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION public.update_comment_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM recount_comments(NEW.post_id); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.post_id IS DISTINCT FROM coalesce(NEW.post_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM recount_comments(OLD.post_id);
  END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE users_profile u SET feelings_count = feelings_count + 1 FROM posts p WHERE p.id = NEW.post_id AND u.id = p.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users_profile u SET feelings_count = greatest(feelings_count - 1, 0) FROM posts p WHERE p.id = OLD.post_id AND u.id = p.user_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trigger_update_comments ON public.comments;
CREATE TRIGGER trigger_update_comments AFTER INSERT OR DELETE OR UPDATE OF post_id ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_counts();
DROP TRIGGER IF EXISTS trigger_update_music_reaction_counts ON public.music_reactions;
CREATE TRIGGER trigger_update_music_reaction_counts AFTER INSERT OR DELETE ON public.music_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_counts();

-- Notification à l'auteur du post (type dédié, texte « a répondu en musique »).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'feel','like','comment','reshake','message','song_share','follow','circle_post','circle_invite',
  'story_like','story_comment','comment_like','circle_join','circle_add','music_reaction'
]));
CREATE OR REPLACE FUNCTION public.create_music_reaction_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, from_user_id, post_id)
  SELECT p.user_id, 'music_reaction', NEW.user_id, NEW.post_id
  FROM posts p WHERE p.id = NEW.post_id AND p.user_id <> NEW.user_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trigger_music_reaction_notification ON public.music_reactions;
CREATE TRIGGER trigger_music_reaction_notification AFTER INSERT ON public.music_reactions
  FOR EACH ROW EXECUTE FUNCTION public.create_music_reaction_notification();

-- Suppression d'une réponse en musique : son auteur ou l'auteur du post (comme F5).
DROP POLICY IF EXISTS music_reactions_delete_by_post_owner ON public.music_reactions;
CREATE POLICY music_reactions_delete_by_post_owner ON public.music_reactions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = music_reactions.post_id AND p.user_id = auth.uid()));

-- Lecture : seulement si le post est visible (la règle des posts s'applique dans la sous-requête).
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
DROP POLICY IF EXISTS comments_select_visible_post ON public.comments;
CREATE POLICY comments_select_visible_post ON public.comments FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = comments.post_id));
DROP POLICY IF EXISTS "Users can comment" ON public.comments;
DROP POLICY IF EXISTS comments_insert_visible_post ON public.comments;
CREATE POLICY comments_insert_visible_post ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = comments.post_id));

DROP POLICY IF EXISTS "Anyone can read reactions" ON public.music_reactions;
DROP POLICY IF EXISTS music_reactions_select_visible_post ON public.music_reactions;
CREATE POLICY music_reactions_select_visible_post ON public.music_reactions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = music_reactions.post_id));
DROP POLICY IF EXISTS "Users can create reactions" ON public.music_reactions;
DROP POLICY IF EXISTS music_reactions_insert_visible_post ON public.music_reactions;
CREATE POLICY music_reactions_insert_visible_post ON public.music_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = music_reactions.post_id));

DROP POLICY IF EXISTS "Anyone can view likes" ON public.likes;
DROP POLICY IF EXISTS "Users can view likes" ON public.likes;
DROP POLICY IF EXISTS likes_select_visible_post ON public.likes;
CREATE POLICY likes_select_visible_post ON public.likes FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = likes.post_id));
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
DROP POLICY IF EXISTS likes_insert_visible_post ON public.likes;
CREATE POLICY likes_insert_visible_post ON public.likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM posts p WHERE p.id = likes.post_id));
DROP POLICY IF EXISTS "Users can unlike" ON public.likes; -- doublon de « Users can delete their own likes »

DROP POLICY IF EXISTS comment_likes_select_all ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_select_visible ON public.comment_likes;
CREATE POLICY comment_likes_select_visible ON public.comment_likes FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM comments c WHERE c.id = comment_likes.comment_id));

-- Recalcul de tous les compteurs de commentaires.
UPDATE public.posts p SET comments_count = x.n
FROM (SELECT o.id,
        (SELECT count(*) FROM comments c WHERE c.post_id = o.id) + (SELECT count(*) FROM music_reactions m WHERE m.post_id = o.id) AS n
      FROM posts o) x
WHERE x.id = p.id AND coalesce(p.comments_count, 0) <> x.n;
