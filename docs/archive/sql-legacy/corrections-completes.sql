-- =====================================================
-- CORRECTIONS COMPLETES SHAKEMOI
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- 1. RECALCULER TOUS LES COMPTEURS
-- =====================================================

-- Recalculer likes_count
UPDATE posts
SET likes_count = (
  SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id
);

-- Recalculer comments_count
UPDATE posts
SET comments_count = (
  SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id
);

-- Recalculer feels_count (personnes qui me follow)
UPDATE users_profile
SET feels_count = (
  SELECT COUNT(*) FROM follows WHERE follows.following_id = users_profile.id
);

-- Recalculer feelings_count (personnes que je follow)
UPDATE users_profile
SET feelings_count = (
  SELECT COUNT(*) FROM follows WHERE follows.follower_id = users_profile.id
);

-- 2. CRÉER TRIGGERS AUTOMATIQUES
-- =====================================================

-- Trigger pour follows
CREATE OR REPLACE FUNCTION update_feels_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Incrémenter feels de celui qui est suivi
    UPDATE users_profile SET feels_count = COALESCE(feels_count, 0) + 1 WHERE id = NEW.following_id;
    -- Incrémenter feelings de celui qui suit
    UPDATE users_profile SET feelings_count = COALESCE(feelings_count, 0) + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Décrémenter feels
    UPDATE users_profile SET feels_count = GREATEST(COALESCE(feels_count, 0) - 1, 0) WHERE id = OLD.following_id;
    -- Décrémenter feelings
    UPDATE users_profile SET feelings_count = GREATEST(COALESCE(feelings_count, 0) - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_feels_counts_trigger ON follows;
CREATE TRIGGER update_feels_counts_trigger
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_feels_counts();

-- 3. AJOUTER COLONNE POUR RESHAKES
-- =====================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_user_id UUID REFERENCES users_profile(id);

-- Mettre à jour les reshakes existants
UPDATE posts
SET original_user_id = (SELECT user_id FROM posts AS orig WHERE orig.id = posts.original_post_id)
WHERE is_reshake = true AND original_user_id IS NULL;

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Voir les compteurs
SELECT
  username,
  feels_count,
  feelings_count,
  (SELECT COUNT(*) FROM follows WHERE following_id = users_profile.id) as actual_feels,
  (SELECT COUNT(*) FROM follows WHERE follower_id = users_profile.id) as actual_feelings
FROM users_profile
LIMIT 10;
