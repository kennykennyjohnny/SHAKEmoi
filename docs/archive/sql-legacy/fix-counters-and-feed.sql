-- ============================================
-- CORRECTION DES COMPTEURS ET DU FEED
-- ============================================

-- 1. Corriger les compteurs feels_count et feelings_count
UPDATE users_profile u
SET
  feels_count = (SELECT COUNT(*) FROM follows WHERE following_id = u.id),
  feelings_count = (SELECT COUNT(*) FROM follows WHERE follower_id = u.id);

-- 2. Corriger les compteurs de likes sur les posts
UPDATE posts p
SET likes_count = (
  SELECT COUNT(*)
  FROM likes
  WHERE post_id = p.id
);

-- 3. Vérifier les résultats
SELECT
  username,
  feels_count,
  feelings_count,
  (SELECT COUNT(*) FROM follows WHERE following_id = id) as actual_feels,
  (SELECT COUNT(*) FROM follows WHERE follower_id = id) as actual_feelings
FROM users_profile
ORDER BY created_at DESC;

-- 4. Afficher les posts avec leurs compteurs de likes corrects
SELECT
  p.id,
  p.track_name,
  p.likes_count,
  (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as actual_likes
FROM posts p
WHERE p.likes_count != (SELECT COUNT(*) FROM likes WHERE post_id = p.id)
LIMIT 10;
