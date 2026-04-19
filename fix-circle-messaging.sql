-- ============================================
-- SHAKEMOI — Fix Circle Messaging (complet)
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. S'assurer que les tables existent
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

-- ============================================
-- 2. Colonnes manquantes
-- ============================================
ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES circles(id) ON DELETE SET NULL;

-- ============================================
-- 3. Index
-- ============================================
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id) WHERE circle_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_circles_invite_code ON circles(invite_code) WHERE invite_code IS NOT NULL;

-- ============================================
-- 4. Activer RLS
-- ============================================
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Supprimer TOUTES les anciennes policies (nettoyage)
-- ============================================
DROP POLICY IF EXISTS "Members can read circles" ON circles;
DROP POLICY IF EXISTS "Authenticated can read circles" ON circles;
DROP POLICY IF EXISTS "Users can create circles" ON circles;
DROP POLICY IF EXISTS "Creator can update circle" ON circles;
DROP POLICY IF EXISTS "Creator can delete circle" ON circles;

DROP POLICY IF EXISTS "Members can read circle members" ON circle_members;
DROP POLICY IF EXISTS "Authenticated can read circle members" ON circle_members;
DROP POLICY IF EXISTS "Circle creator can manage members" ON circle_members;
DROP POLICY IF EXISTS "Authenticated can join circles" ON circle_members;
DROP POLICY IF EXISTS "Circle creator can remove members" ON circle_members;
DROP POLICY IF EXISTS "Members can leave circles" ON circle_members;

-- Supprimer aussi les nouvelles si elles existent deja (idempotent)
DROP POLICY IF EXISTS "circles_select" ON circles;
DROP POLICY IF EXISTS "circles_insert" ON circles;
DROP POLICY IF EXISTS "circles_update" ON circles;
DROP POLICY IF EXISTS "circles_delete" ON circles;
DROP POLICY IF EXISTS "circle_members_select" ON circle_members;
DROP POLICY IF EXISTS "circle_members_insert" ON circle_members;
DROP POLICY IF EXISTS "circle_members_delete" ON circle_members;

-- ============================================
-- 6. Recréer les policies PROPREMENT
-- ============================================

-- CIRCLES : tout utilisateur authentifié peut lire (nécessaire pour rejoindre par code)
CREATE POLICY "circles_select" ON circles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "circles_insert" ON circles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "circles_update" ON circles
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "circles_delete" ON circles
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- CIRCLE_MEMBERS : lecture ouverte, insertion libre (join par code), suppression par créateur ou soi-même
CREATE POLICY "circle_members_select" ON circle_members
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "circle_members_insert" ON circle_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "circle_members_delete" ON circle_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM circles WHERE id = circle_members.circle_id AND created_by = auth.uid())
  );

-- ============================================
-- 7. Vérifier que les posts peuvent être lus/écrits
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_select') THEN
    CREATE POLICY "posts_select" ON posts FOR SELECT TO public USING (true);
  END IF;
END $$;

-- ============================================
-- 8. Activer Realtime sur posts (nécessaire pour les circle messages en temps réel)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- ============================================
-- 9. Générer les invite_code manquants
-- ============================================
UPDATE circles 
SET invite_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE invite_code IS NULL;

-- ============================================
-- 10. Helper function pour éviter les récursions RLS
-- ============================================
DROP FUNCTION IF EXISTS is_circle_member(UUID, UUID);
CREATE OR REPLACE FUNCTION is_circle_member(p_circle_id UUID, p_user_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VÉRIFICATION : lister les cercles et membres
-- ============================================
SELECT c.id, c.name, c.invite_code, c.created_by, 
       COUNT(cm.id) as member_count
FROM circles c 
LEFT JOIN circle_members cm ON cm.circle_id = c.id 
GROUP BY c.id, c.name, c.invite_code, c.created_by;