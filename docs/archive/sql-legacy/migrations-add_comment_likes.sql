-- Comment likes system
-- Run this migration in Supabase SQL editor

-- 1) Table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

-- 2) likes_count on comments (if not exists)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 3) Trigger to keep likes_count in sync
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_likes_count ON comment_likes;
CREATE TRIGGER trg_comment_likes_count
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- 4) RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select_all" ON comment_likes;
CREATE POLICY "comment_likes_select_all" ON comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "comment_likes_insert_self" ON comment_likes;
CREATE POLICY "comment_likes_insert_self" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_likes_delete_self" ON comment_likes;
CREATE POLICY "comment_likes_delete_self" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 5) Broaden notifications CHECK to include 'comment_like'
DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'feel','like','comment','reshake','message','song_share',
      'follow','circle_post','circle_invite','story_like','story_comment','comment_like'
    )
  );
