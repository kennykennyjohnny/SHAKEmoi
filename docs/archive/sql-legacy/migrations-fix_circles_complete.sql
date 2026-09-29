-- SHAKEMOI — Fix Circles Complete
-- Run this in Supabase SQL Editor AFTER v2_new_features.sql

-- 1. Add invite_code to circles
ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_circles_invite_code ON circles(invite_code) WHERE invite_code IS NOT NULL;

-- 2. Add circle_id to posts (for circle-specific posts)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES circles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id) WHERE circle_id IS NOT NULL;

-- 3. Fix RLS on circles — anyone authenticated can SELECT circles (needed to join by code)
DROP POLICY IF EXISTS "Members can read circles" ON circles;
CREATE POLICY "Authenticated can read circles" ON circles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Fix RLS on circle_members — allow reading + inserting for any authenticated user
-- (the circle creator invites people, but also people can join by code)
DROP POLICY IF EXISTS "Members can read circle members" ON circle_members;
CREATE POLICY "Authenticated can read circle members" ON circle_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Circle creator can manage members" ON circle_members;
CREATE POLICY "Authenticated can join circles" ON circle_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Keep the delete policy (creator or self can leave)
-- Already exists: "Circle creator can remove members"

-- 5. Add notification types for circles 
-- (notifications table should already exist, this just ensures circle notif types work)
-- No schema change needed, just use type = 'circle_invite', 'circle_join', 'circle_post'

-- 6. Generate invite codes for existing circles that don't have one
UPDATE circles 
SET invite_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE invite_code IS NULL;
