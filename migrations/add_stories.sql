-- SHAKEMOI Stories (ephemeral)
-- Execute in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  track_name TEXT,
  artist TEXT,
  cover_url TEXT,
  track_id TEXT,
  spotify_url TEXT,
  spotify_embed_url TEXT,
  text TEXT,
  theme_color TEXT DEFAULT '#1D0F3D',
  duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days IN (1, 7, 30)),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_stories_user_created ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views(viewer_id);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select" ON stories;
DROP POLICY IF EXISTS "stories_insert" ON stories;
DROP POLICY IF EXISTS "stories_delete" ON stories;
DROP POLICY IF EXISTS "story_views_select" ON story_views;
DROP POLICY IF EXISTS "story_views_insert" ON story_views;

CREATE POLICY "stories_select" ON stories
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT following_id FROM follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "stories_insert" ON stories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_delete" ON stories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "story_views_select" ON story_views
  FOR SELECT TO authenticated
  USING (viewer_id = auth.uid());

CREATE POLICY "story_views_insert" ON story_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE stories;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
