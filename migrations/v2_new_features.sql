-- SHAKEMOI V2 — New Features Migration
-- Run this in Supabase SQL Editor
-- Tables: messages, shake_du_jour, music_reactions, circles, circle_members, weekly_wraps, taste_match_cache

-- ==================== MESSAGES (Messagerie musicale) ====================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  -- Track data (if sending a song)
  track_name TEXT,
  artist TEXT,
  cover_url TEXT,
  track_id TEXT,
  spotify_url TEXT,
  spotify_embed_url TEXT,
  apple_music_url TEXT,
  deezer_url TEXT,
  youtube_url TEXT,
  youtube_music_url TEXT,
  tidal_url TEXT,
  odesli_page_url TEXT,
  -- Meta
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- RLS for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- ==================== SHAKE DU JOUR ====================
CREATE TABLE IF NOT EXISTS shake_du_jour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, created_date)
);

CREATE INDEX IF NOT EXISTS idx_shake_du_jour_user_date ON shake_du_jour(user_id, created_date);

ALTER TABLE shake_du_jour ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all shake du jour" ON shake_du_jour
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own shake du jour" ON shake_du_jour
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==================== MUSIC REACTIONS ====================
CREATE TABLE IF NOT EXISTS music_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  -- Track data for the reaction
  track_name TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT,
  track_id TEXT,
  spotify_url TEXT,
  spotify_embed_url TEXT,
  apple_music_url TEXT,
  deezer_url TEXT,
  youtube_url TEXT,
  youtube_music_url TEXT,
  tidal_url TEXT,
  odesli_page_url TEXT,
  text TEXT, -- optional comment
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_reactions_post ON music_reactions(post_id);

ALTER TABLE music_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions" ON music_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can create reactions" ON music_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON music_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ==================== CIRCLES ====================
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read circles" ON circles
  FOR SELECT USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM circle_members WHERE circle_id = circles.id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create circles" ON circles
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update circle" ON circles
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete circle" ON circles
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Members can read circle members" ON circle_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circle_members.circle_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Circle creator can manage members" ON circle_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM circles WHERE id = circle_members.circle_id AND created_by = auth.uid())
  );

CREATE POLICY "Circle creator can remove members" ON circle_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM circles WHERE id = circle_members.circle_id AND created_by = auth.uid())
    OR auth.uid() = user_id
  );

-- ==================== TASTE MATCH CACHE ====================
CREATE TABLE IF NOT EXISTS taste_match_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  user_b_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  match_percent INTEGER DEFAULT 0,
  common_artists TEXT[] DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id)
);

ALTER TABLE taste_match_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their taste matches" ON taste_match_cache
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ==================== WEEKLY WRAPS ====================
CREATE TABLE IF NOT EXISTS weekly_wraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  shakes_count INTEGER DEFAULT 0,
  top_genre TEXT,
  most_active_friend TEXT,
  most_reshaked_track TEXT,
  avg_taste_match INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_wraps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own wraps" ON weekly_wraps
  FOR SELECT USING (auth.uid() = user_id);

-- ==================== PRIVATE POSTS (Shake de la semaine) ====================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_is_private ON posts(is_private) WHERE is_private = true;

-- ==================== HELPER RPC: increment_reshakes_count ====================
-- (ensure it exists)
CREATE OR REPLACE FUNCTION increment_reshakes_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET reshakes_count = COALESCE(reshakes_count, 0) + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
