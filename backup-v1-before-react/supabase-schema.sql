-- SHAKEMOI - Supabase Database Schema
-- Copie-colle tout ce code dans le SQL Editor de Supabase

-- =====================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Activer RLS sur auth.users (si pas déjà fait)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CREATE TABLES
-- =====================================================

-- Table: users_profile
-- Profils utilisateurs avec infos additionnelles
CREATE TABLE IF NOT EXISTS public.users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  email TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#B4A7D6',
  feels_count INTEGER DEFAULT 0 CHECK (feels_count >= 0),
  feelings_count INTEGER DEFAULT 0 CHECK (feelings_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: posts
-- Posts musicaux des utilisateurs
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover TEXT NOT NULL,
  text TEXT DEFAULT '',
  likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INTEGER DEFAULT 0 CHECK (comments_count >= 0),
  is_reshake BOOLEAN DEFAULT FALSE,
  original_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: likes
-- Likes sur les posts
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Table: comments
-- Commentaires sur les posts
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: follows
-- Relations de suivi entre utilisateurs (max 100 par user)
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_username ON public.users_profile(username);

-- =====================================================
-- 4. CREATE FUNCTIONS FOR COUNTERS
-- =====================================================

-- Function: increment_likes
CREATE OR REPLACE FUNCTION public.increment_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = likes_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: decrement_likes
CREATE OR REPLACE FUNCTION public.decrement_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: increment_comments
CREATE OR REPLACE FUNCTION public.increment_comments(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET comments_count = comments_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: decrement_comments
CREATE OR REPLACE FUNCTION public.decrement_comments(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET comments_count = GREATEST(comments_count - 1, 0)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE TRIGGERS
-- =====================================================

-- Trigger: Auto-update likes_count
CREATE OR REPLACE FUNCTION public.handle_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.increment_likes(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.decrement_likes(OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_like_count ON public.likes;
CREATE TRIGGER trigger_like_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_count();

-- Trigger: Auto-update comments_count
CREATE OR REPLACE FUNCTION public.handle_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.increment_comments(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.decrement_comments(OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_comment_count ON public.comments;
CREATE TRIGGER trigger_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count();

-- Trigger: Auto-update feels_count and feelings_count
CREATE OR REPLACE FUNCTION public.handle_follow_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment feels_count for follower
    UPDATE public.users_profile
    SET feels_count = feels_count + 1
    WHERE id = NEW.follower_id;

    -- Increment feelings_count for following
    UPDATE public.users_profile
    SET feelings_count = feelings_count + 1
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement feels_count for follower
    UPDATE public.users_profile
    SET feels_count = GREATEST(feels_count - 1, 0)
    WHERE id = OLD.follower_id;

    -- Decrement feelings_count for following
    UPDATE public.users_profile
    SET feelings_count = GREATEST(feelings_count - 1, 0)
    WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_follow_count ON public.follows;
CREATE TRIGGER trigger_follow_count
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_count();

-- Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_profile_updated_at ON public.users_profile;
CREATE TRIGGER trigger_users_profile_updated_at
BEFORE UPDATE ON public.users_profile
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ============ USERS_PROFILE POLICIES ============

-- Everyone can read profiles
CREATE POLICY "users_profile_select"
ON public.users_profile FOR SELECT
TO public
USING (true);

-- Users can insert their own profile
CREATE POLICY "users_profile_insert"
ON public.users_profile FOR INSERT
TO public
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_profile_update"
ON public.users_profile FOR UPDATE
TO public
USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "users_profile_delete"
ON public.users_profile FOR DELETE
TO public
USING (auth.uid() = id);

-- ============ POSTS POLICIES ============

-- Everyone can read posts
CREATE POLICY "posts_select"
ON public.posts FOR SELECT
TO public
USING (true);

-- Authenticated users can insert posts
CREATE POLICY "posts_insert"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "posts_update"
ON public.posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "posts_delete"
ON public.posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============ LIKES POLICIES ============

-- Everyone can read likes
CREATE POLICY "likes_select"
ON public.likes FOR SELECT
TO public
USING (true);

-- Authenticated users can insert likes
CREATE POLICY "likes_insert"
ON public.likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "likes_delete"
ON public.likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============ COMMENTS POLICIES ============

-- Everyone can read comments
CREATE POLICY "comments_select"
ON public.comments FOR SELECT
TO public
USING (true);

-- Authenticated users can insert comments
CREATE POLICY "comments_insert"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "comments_update"
ON public.comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "comments_delete"
ON public.comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============ FOLLOWS POLICIES ============

-- Everyone can read follows
CREATE POLICY "follows_select"
ON public.follows FOR SELECT
TO public
USING (true);

-- Authenticated users can follow others (max 100)
CREATE POLICY "follows_insert"
ON public.follows FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = follower_id AND
  follower_id != following_id AND
  (SELECT COUNT(*) FROM public.follows WHERE follower_id = auth.uid()) < 100
);

-- Users can unfollow
CREATE POLICY "follows_delete"
ON public.follows FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- 8. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ SHAKEMOI database schema created successfully!';
  RAISE NOTICE '📝 Tables: users_profile, posts, likes, comments, follows';
  RAISE NOTICE '🔐 RLS enabled on all tables';
  RAISE NOTICE '⚡ Triggers configured for auto-counters';
  RAISE NOTICE '🎵 Ready to shake!';
END $$;
