-- SHAKEMOI V3 - Database Upgrade Script
-- Execute this in Supabase SQL Editor to upgrade to V3

-- =====================================================
-- 1. ADD NEW COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add preview_url and mood to posts
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS preview_url TEXT,
ADD COLUMN IF NOT EXISTS mood_emoji TEXT,
ADD COLUMN IF NOT EXISTS spotify_url TEXT,
ADD COLUMN IF NOT EXISTS track_id TEXT;

-- Add streak columns to users_profile
ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0),
ADD COLUMN IF NOT EXISTS streak_shields INTEGER DEFAULT 0 CHECK (streak_shields >= 0 AND streak_shields <= 3),
ADD COLUMN IF NOT EXISTS last_post_date DATE;

-- =====================================================
-- 2. CREATE NEW TABLE: interactions
-- =====================================================
-- This replaces the "likes" system with a unified "feelings" system

CREATE TABLE IF NOT EXISTS public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('shake', 'comment', 'reshake')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id, type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_interactions_post ON public.interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON public.interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON public.interactions(type);

-- Enable RLS
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interactions
CREATE POLICY "interactions_select"
ON public.interactions FOR SELECT
TO public
USING (true);

CREATE POLICY "interactions_insert"
ON public.interactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "interactions_delete"
ON public.interactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 3. CREATE TABLE: mood_history
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mood_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  mood_emoji TEXT NOT NULL,
  mood_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_history_user ON public.mood_history(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_history_created ON public.mood_history(created_at DESC);

ALTER TABLE public.mood_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_history_select"
ON public.mood_history FOR SELECT
TO public
USING (true);

CREATE POLICY "mood_history_insert"
ON public.mood_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. CREATE TABLE: streak_rewards
-- =====================================================

CREATE TABLE IF NOT EXISTS public.streak_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  streak_milestone INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_rewards_user ON public.streak_rewards(user_id);

ALTER TABLE public.streak_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streak_rewards_select"
ON public.streak_rewards FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "streak_rewards_insert"
ON public.streak_rewards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 5. UPDATE FUNCTIONS FOR NEW FEELINGS SYSTEM
-- =====================================================

-- Function: Update feelings count based on interactions
CREATE OR REPLACE FUNCTION public.update_feelings_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the post's feelings_count (was likes_count)
  UPDATE public.posts
  SET likes_count = (
    SELECT COUNT(*)
    FROM public.interactions
    WHERE post_id = NEW.post_id OR post_id = OLD.post_id
  )
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  -- Update the post author's total feelings_count
  UPDATE public.users_profile
  SET feelings_count = (
    SELECT COUNT(*)
    FROM public.interactions i
    JOIN public.posts p ON i.post_id = p.id
    WHERE p.user_id = public.users_profile.id
  )
  WHERE id = (
    SELECT user_id FROM public.posts
    WHERE id = COALESCE(NEW.post_id, OLD.post_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_feelings_count ON public.interactions;
CREATE TRIGGER trigger_update_feelings_count
AFTER INSERT OR DELETE ON public.interactions
FOR EACH ROW EXECUTE FUNCTION public.update_feelings_count();

-- =====================================================
-- 6. CREATE FUNCTION: Update Streak
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_streak()
RETURNS TRIGGER AS $$
DECLARE
  days_since INTEGER;
  user_shields INTEGER;
  user_current_streak INTEGER;
BEGIN
  -- Get current user data
  SELECT
    COALESCE(CURRENT_DATE - last_post_date, 0),
    COALESCE(streak_shields, 0),
    COALESCE(current_streak, 0)
  INTO days_since, user_shields, user_current_streak
  FROM public.users_profile
  WHERE id = NEW.user_id;

  -- If first post or consecutive day
  IF days_since <= 1 THEN
    UPDATE public.users_profile
    SET
      current_streak = CASE
        WHEN last_post_date IS NULL THEN 1
        WHEN days_since = 0 THEN current_streak
        ELSE current_streak + 1
      END,
      longest_streak = GREATEST(longest_streak,
        CASE
          WHEN last_post_date IS NULL THEN 1
          WHEN days_since = 0 THEN current_streak
          ELSE current_streak + 1
        END
      ),
      last_post_date = CURRENT_DATE
    WHERE id = NEW.user_id;

  -- If streak broken (more than 1 day)
  ELSIF days_since > 1 THEN
    IF user_shields > 0 THEN
      -- Use a shield to save the streak
      UPDATE public.users_profile
      SET
        streak_shields = streak_shields - 1,
        last_post_date = CURRENT_DATE
      WHERE id = NEW.user_id;

    ELSE
      -- Reset streak
      UPDATE public.users_profile
      SET
        current_streak = 1,
        last_post_date = CURRENT_DATE
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  -- Check for milestone rewards
  SELECT current_streak INTO user_current_streak
  FROM public.users_profile
  WHERE id = NEW.user_id;

  -- Award shield at milestones (7, 30, 100 days)
  IF user_current_streak IN (7, 30, 100) THEN
    UPDATE public.users_profile
    SET streak_shields = LEAST(streak_shields + 1, 3)
    WHERE id = NEW.user_id;

    -- Record the reward
    INSERT INTO public.streak_rewards (user_id, streak_milestone, reward_type)
    VALUES (NEW.user_id, user_current_streak, 'shield');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for streak update
DROP TRIGGER IF EXISTS trigger_update_streak ON public.posts;
CREATE TRIGGER trigger_update_streak
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_streak();

-- =====================================================
-- 7. CREATE FUNCTION: Log Mood
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_mood()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mood_emoji IS NOT NULL THEN
    INSERT INTO public.mood_history (user_id, mood_emoji, mood_label)
    VALUES (
      NEW.user_id,
      NEW.mood_emoji,
      -- Extract mood label from emoji (you can customize this)
      CASE NEW.mood_emoji
        WHEN '😊' THEN 'happy'
        WHEN '😭' THEN 'sad'
        WHEN '⚡' THEN 'energetic'
        WHEN '😌' THEN 'chill'
        WHEN '🥰' THEN 'love'
        WHEN '🌅' THEN 'nostalgic'
        ELSE 'other'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for mood logging
DROP TRIGGER IF EXISTS trigger_log_mood ON public.posts;
CREATE TRIGGER trigger_log_mood
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.log_mood();

-- =====================================================
-- 8. MIGRATE EXISTING LIKES TO INTERACTIONS
-- =====================================================

-- Copy existing likes to interactions as "shake" type
INSERT INTO public.interactions (user_id, post_id, type, created_at)
SELECT user_id, post_id, 'shake', created_at
FROM public.likes
ON CONFLICT (user_id, post_id, type) DO NOTHING;

-- Copy existing comments as interactions
INSERT INTO public.interactions (user_id, post_id, type, created_at)
SELECT DISTINCT user_id, post_id, 'comment', MIN(created_at)
FROM public.comments
GROUP BY user_id, post_id
ON CONFLICT (user_id, post_id, type) DO NOTHING;

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.interactions TO anon, authenticated;
GRANT ALL ON public.mood_history TO anon, authenticated;
GRANT ALL ON public.streak_rewards TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- 10. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ SHAKEMOI V3 database upgraded successfully!';
  RAISE NOTICE '📊 New tables: interactions, mood_history, streak_rewards';
  RAISE NOTICE '🔥 Streaks system enabled';
  RAISE NOTICE '😊 Mood tracking enabled';
  RAISE NOTICE '💯 Feelings system upgraded';
  RAISE NOTICE '🎵 Ready to Shake with V3!';
END $$;
