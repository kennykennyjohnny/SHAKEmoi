-- SHAKEMOI V3 - Story Likes & Comments (DM notification)
-- Execute this in Supabase SQL Editor to add likes and comment reactions to stories
-- Comments are sent as private messages to the story author

-- =====================================================
-- 1. STORY LIKES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  emoji TEXT DEFAULT '❤️' CHECK (char_length(emoji) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_story_likes_story ON public.story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user ON public.story_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_created ON public.story_likes(created_at DESC);

-- Add likes_count to stories if missing
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0);

-- =====================================================
-- 2. RLS ON STORY LIKES
-- =====================================================

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "story_likes_select" ON public.story_likes;
CREATE POLICY "story_likes_select" ON public.story_likes FOR SELECT TO authenticated
  USING (
    -- Can see likes on stories you can view (own or from people you follow)
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_id AND (
        s.user_id = auth.uid() OR 
        s.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "story_likes_insert" ON public.story_likes;
CREATE POLICY "story_likes_insert" ON public.story_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_id AND (
        s.user_id = auth.uid() OR 
        s.user_id IN (
          SELECT following_id FROM follows WHERE follower_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "story_likes_delete" ON public.story_likes;
CREATE POLICY "story_likes_delete" ON public.story_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 3. RPC FUNCTIONS FOR STORY LIKES
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_story_likes(story_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = story_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_story_likes(story_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stories SET likes_count = GREATEST(0, likes_count - 1) WHERE id = story_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. REALTIME PUBLICATIONS
-- =====================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE story_likes;
EXCEPTION WHEN duplicate_object OR others THEN NULL;
END $$;

-- =====================================================
-- NOTES
-- =====================================================
-- Story comments are sent as private messages to the story author
-- via sendMessage() function in the app. Example:
-- 
-- await sendMessage(storyAuthorId, `💭 Comment on your story: "${commentText}"`)
--
-- This creates a notification and private message conversation automatically.
-- No separate table needed - reuse existing messages table with that logic.
