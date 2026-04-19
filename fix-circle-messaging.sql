-- ============================================
-- SHAKEMOI — Fix Circle Messaging (complet)
-- Les cercles = messagerie de groupe, PAS des posts/shakes
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. S'assurer que les tables circles/circle_members existent
-- ============================================
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- ============================================
-- 2. Créer la table circle_messages (messagerie de groupe)
-- Structure identique à messages mais avec circle_id au lieu de receiver_id
-- ============================================
CREATE TABLE IF NOT EXISTS circle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users_profile(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  -- Track data (si partage de son)
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
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_circle_messages_circle ON circle_messages(circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_messages_sender ON circle_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_circles_invite_code ON circles(invite_code) WHERE invite_code IS NOT NULL;

-- ============================================
-- 3. RLS sur circle_messages
-- ============================================
ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;

-- Seuls les membres du cercle peuvent lire les messages
DROP POLICY IF EXISTS "circle_messages_select" ON circle_messages;
CREATE POLICY "circle_messages_select" ON circle_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_messages.circle_id
        AND cm.user_id = auth.uid()
    )
  );

-- Seuls les membres du cercle peuvent envoyer des messages
DROP POLICY IF EXISTS "circle_messages_insert" ON circle_messages;
CREATE POLICY "circle_messages_insert" ON circle_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_messages.circle_id
        AND cm.user_id = auth.uid()
    )
  );

-- On peut supprimer ses propres messages
DROP POLICY IF EXISTS "circle_messages_delete" ON circle_messages;
CREATE POLICY "circle_messages_delete" ON circle_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- ============================================
-- 4. RLS sur circles et circle_members
-- ============================================
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circles_select" ON circles;
DROP POLICY IF EXISTS "circles_insert" ON circles;
DROP POLICY IF EXISTS "circles_update" ON circles;
DROP POLICY IF EXISTS "circles_delete" ON circles;
DROP POLICY IF EXISTS "Members can read circles" ON circles;
DROP POLICY IF EXISTS "Authenticated can read circles" ON circles;
DROP POLICY IF EXISTS "Users can create circles" ON circles;
DROP POLICY IF EXISTS "Creator can update circle" ON circles;
DROP POLICY IF EXISTS "Creator can delete circle" ON circles;

CREATE POLICY "circles_select" ON circles FOR SELECT TO authenticated USING (true);
CREATE POLICY "circles_insert" ON circles FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "circles_update" ON circles FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "circles_delete" ON circles FOR DELETE TO authenticated USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "circle_members_select" ON circle_members;
DROP POLICY IF EXISTS "circle_members_insert" ON circle_members;
DROP POLICY IF EXISTS "circle_members_delete" ON circle_members;
DROP POLICY IF EXISTS "Members can read circle members" ON circle_members;
DROP POLICY IF EXISTS "Authenticated can read circle members" ON circle_members;
DROP POLICY IF EXISTS "Circle creator can manage members" ON circle_members;
DROP POLICY IF EXISTS "Authenticated can join circles" ON circle_members;
DROP POLICY IF EXISTS "Circle creator can remove members" ON circle_members;
DROP POLICY IF EXISTS "Members can leave circles" ON circle_members;

CREATE POLICY "circle_members_select" ON circle_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "circle_members_insert" ON circle_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "circle_members_delete" ON circle_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM circles WHERE id = circle_members.circle_id AND created_by = auth.uid())
  );

-- ============================================
-- 5. Activer Realtime sur circle_messages
-- ============================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circle_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 6. Générer les invite_code manquants
-- ============================================
UPDATE circles 
SET invite_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE invite_code IS NULL;

-- ============================================
-- 7. Migrer les anciens messages de cercle (posts avec circle_id) vers circle_messages
-- ============================================
INSERT INTO circle_messages (circle_id, sender_id, text, track_name, artist, cover_url, track_id, spotify_url, spotify_embed_url, created_at)
SELECT p.circle_id, p.user_id, p.text, p.track_name, p.artist, p.cover_url, p.track_id, p.spotify_url, p.spotify_embed_url, p.created_at
FROM posts p
WHERE p.circle_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT 'circle_messages' as table_name, COUNT(*) as total FROM circle_messages
UNION ALL
SELECT 'circles', COUNT(*) FROM circles
UNION ALL
SELECT 'circle_members', COUNT(*) FROM circle_members;