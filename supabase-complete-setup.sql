-- ============================================
-- SHAKEMOI - Configuration complète de la base de données
-- ============================================
-- Ce fichier contient toutes les requêtes SQL nécessaires pour configurer SHAKEMOI
-- Exécutez ces requêtes dans l'ordre dans le SQL Editor de Supabase

-- ============================================
-- 1. MIGRATION: Ajouter preview_url aux posts
-- ============================================

-- Ajouter la colonne preview_url à la table posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_posts_preview_url ON posts(preview_url) WHERE preview_url IS NOT NULL;

-- ============================================
-- 2. VÉRIFICATIONS ET INDEX ADDITIONNELS
-- ============================================

-- Index pour améliorer les performances des requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ============================================
-- 3. FONCTIONS RPC POUR LES COMPTEURS
-- ============================================

-- Fonction pour incrémenter le compteur de likes
CREATE OR REPLACE FUNCTION increment_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET likes_count = likes_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour décrémenter le compteur de likes
CREATE OR REPLACE FUNCTION decrement_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour incrémenter le compteur de commentaires
CREATE OR REPLACE FUNCTION increment_comments(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET comments_count = comments_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VUES UTILES (OPTIONNEL)
-- ============================================

-- Vue pour obtenir les posts avec toutes les informations nécessaires
CREATE OR REPLACE VIEW posts_with_user AS
SELECT
  p.*,
  u.username,
  u.color,
  u.feels_count,
  u.feelings_count
FROM posts p
JOIN users_profile u ON p.user_id = u.id
ORDER BY p.created_at DESC;

-- Vue pour les statistiques des utilisateurs
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.username,
  u.email,
  u.color,
  u.feels_count,
  u.feelings_count,
  COUNT(DISTINCT p.id) as posts_count,
  COUNT(DISTINCT l.id) as total_likes_received
FROM users_profile u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN likes l ON p.id = l.post_id
GROUP BY u.id, u.username, u.email, u.color, u.feels_count, u.feelings_count;

-- ============================================
-- 5. NETTOYAGE DES DONNÉES (OPTIONNEL)
-- ============================================

-- Nettoyer les likes orphelins (posts supprimés)
-- ATTENTION: Décommentez seulement si vous voulez nettoyer
-- DELETE FROM likes WHERE post_id NOT IN (SELECT id FROM posts);

-- Nettoyer les commentaires orphelins
-- DELETE FROM comments WHERE post_id NOT IN (SELECT id FROM posts);

-- ============================================
-- 6. VÉRIFICATIONS
-- ============================================

-- Vérifier que la colonne preview_url existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts' AND column_name = 'preview_url';

-- Vérifier les index
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('posts', 'likes', 'comments', 'follows', 'users_profile')
ORDER BY tablename, indexname;

-- Vérifier les fonctions RPC
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('increment_likes', 'decrement_likes', 'increment_comments')
ORDER BY routine_name;

-- ============================================
-- 7. STATISTIQUES (POUR INFORMATION)
-- ============================================

-- Compter les posts par utilisateur
SELECT
  u.username,
  COUNT(p.id) as posts_count,
  SUM(p.likes_count) as total_likes
FROM users_profile u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.username
ORDER BY posts_count DESC
LIMIT 10;

-- Compter les posts avec preview_url
SELECT
  COUNT(*) as total_posts,
  COUNT(preview_url) as posts_with_preview,
  ROUND(COUNT(preview_url)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as percentage_with_preview
FROM posts;
