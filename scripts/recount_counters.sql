-- N3 : recalcul de tous les compteurs des posts à partir des vraies lignes.
-- À coller dans Supabase → SQL Editor si un compteur semble faux. Rejouable.
-- Règle : commentaires = commentaires texte + réponses en musique ;
-- likes = likes ; reshakes = reshakes de ce post.
-- Renvoie combien de compteurs étaient faux avant correction.

WITH real AS (
  SELECT p.id,
    (SELECT count(*) FROM comments c WHERE c.post_id = p.id)
      + (SELECT count(*) FROM music_reactions m WHERE m.post_id = p.id) AS c,
    (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS l,
    (SELECT count(*) FROM posts r WHERE r.is_reshake AND r.original_post_id = p.id) AS r
  FROM posts p
),
fixed AS (
  UPDATE posts p SET comments_count = real.c, likes_count = real.l, reshakes_count = real.r
  FROM real
  WHERE p.id = real.id
    AND (coalesce(p.comments_count, 0) <> real.c OR coalesce(p.likes_count, 0) <> real.l OR coalesce(p.reshakes_count, 0) <> real.r)
  RETURNING p.id
)
SELECT (SELECT count(*) FROM fixed) AS posts_corriges;
