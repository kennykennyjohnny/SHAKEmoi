-- SHAKEMOI - Configuration complète de la base de données Supabase
-- Copiez et exécutez ce fichier dans le SQL Editor de Supabase

-- ============================================
-- 1. CRÉATION DES TABLES
-- ============================================

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  color TEXT NOT NULL,
  feels_count INTEGER DEFAULT 0,
  feelings_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover TEXT,
  text TEXT CHECK (length(text) <= 444),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des likes
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Table des commentaires
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des follows (feels)
CREATE TABLE IF NOT EXISTS feels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feeler_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  feeling_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feeler_id, feeling_id),
  CHECK (feeler_id != feeling_id)
);

-- ============================================
-- 2. CRÉATION DES INDEX POUR LA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feels_feeler_id ON feels(feeler_id);
CREATE INDEX IF NOT EXISTS idx_feels_feeling_id ON feels(feeling_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_username ON users_profile(username);

-- Index pour les recherches full-text
CREATE INDEX IF NOT EXISTS idx_posts_track_name ON posts USING gin(to_tsvector('french', track_name));
CREATE INDEX IF NOT EXISTS idx_posts_artist_name ON posts USING gin(to_tsvector('french', artist_name));

-- ============================================
-- 3. FONCTIONS RPC
-- ============================================

-- Fonction pour incrémenter les likes
CREATE OR REPLACE FUNCTION increment_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes_count = likes_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour décrémenter les likes
CREATE OR REPLACE FUNCTION decrement_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter les commentaires
CREATE OR REPLACE FUNCTION increment_comments(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. TRIGGERS POUR LES STATS
-- ============================================

-- Fonction pour mettre à jour les compteurs de feels/feelings
CREATE OR REPLACE FUNCTION update_feels_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users_profile SET feels_count = feels_count + 1 WHERE id = NEW.feeler_id;
    UPDATE users_profile SET feelings_count = feelings_count + 1 WHERE id = NEW.feeling_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users_profile SET feels_count = GREATEST(feels_count - 1, 0) WHERE id = OLD.feeler_id;
    UPDATE users_profile SET feelings_count = GREATEST(feelings_count - 1, 0) WHERE id = OLD.feeling_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS feels_count_trigger ON feels;
CREATE TRIGGER feels_count_trigger
AFTER INSERT OR DELETE ON feels
FOR EACH ROW EXECUTE FUNCTION update_feels_count();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feels ENABLE ROW LEVEL SECURITY;

-- Policies pour users_profile
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON users_profile;
CREATE POLICY "Profiles are viewable by everyone"
ON users_profile FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users_profile;
CREATE POLICY "Users can update own profile"
ON users_profile FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users_profile;
CREATE POLICY "Users can insert own profile"
ON users_profile FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policies pour posts
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by everyone"
ON posts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
CREATE POLICY "Users can create their own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
ON posts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- Policies pour likes
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
CREATE POLICY "Likes are viewable by everyone"
ON likes FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create their own likes" ON likes;
CREATE POLICY "Users can create their own likes"
ON likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;
CREATE POLICY "Users can delete their own likes"
ON likes FOR DELETE
USING (auth.uid() = user_id);

-- Policies pour comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
CREATE POLICY "Comments are viewable by everyone"
ON comments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create their own comments" ON comments;
CREATE POLICY "Users can create their own comments"
ON comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments"
ON comments FOR DELETE
USING (auth.uid() = user_id);

-- Policies pour feels
DROP POLICY IF EXISTS "Feels are viewable by everyone" ON feels;
CREATE POLICY "Feels are viewable by everyone"
ON feels FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create their own feels" ON feels;
CREATE POLICY "Users can create their own feels"
ON feels FOR INSERT
WITH CHECK (auth.uid() = feeler_id);

DROP POLICY IF EXISTS "Users can delete their own feels" ON feels;
CREATE POLICY "Users can delete their own feels"
ON feels FOR DELETE
USING (auth.uid() = feeler_id);

-- ============================================
-- 6. DONNÉES DE TEST (OPTIONNEL)
-- ============================================

-- Décommentez les lignes suivantes pour créer des données de test
-- ATTENTION : Remplacez les UUID par des UUID valides de votre table auth.users

/*
-- Exemple d'insertion de profil (à adapter avec vos vrais UUID)
INSERT INTO users_profile (id, username, email, color) VALUES
('00000000-0000-0000-0000-000000000001', 'testuser1', 'test1@example.com', '#FF6B6B'),
('00000000-0000-0000-0000-000000000002', 'testuser2', 'test2@example.com', '#4ECDC4');

-- Exemple d'insertion de posts
INSERT INTO posts (user_id, track_name, artist_name, album_cover, text) VALUES
('00000000-0000-0000-0000-000000000001', 'Bohemian Rhapsody', 'Queen', 'https://via.placeholder.com/300', 'Un chef-d''œuvre absolu !'),
('00000000-0000-0000-0000-000000000002', 'Imagine', 'John Lennon', 'https://via.placeholder.com/300', 'Cette chanson me touche à chaque fois');
*/

-- ============================================
-- 7. VÉRIFICATION DE L'INSTALLATION
-- ============================================

-- Vérifier que toutes les tables existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users_profile', 'posts', 'likes', 'comments', 'feels')
ORDER BY table_name;

-- Vérifier que toutes les fonctions existent
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('increment_likes', 'decrement_likes', 'increment_comments', 'update_feels_count')
ORDER BY routine_name;

-- ============================================
-- INSTALLATION TERMINÉE !
-- ============================================
-- Si vous voyez 5 tables et 4 fonctions, tout est OK.
-- N'oubliez pas d'activer Realtime pour la table posts dans :
-- Database → Replication → Enable Realtime for 'posts'
