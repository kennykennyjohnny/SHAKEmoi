-- =====================================================
-- FIX COMPLET POUR LES LIKES
-- Résout les erreurs 406 et problèmes de comptage
-- =====================================================

-- 1. Drop les anciennes policies
DROP POLICY IF EXISTS "Users can view likes" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.likes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.likes;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.likes;

-- 2. Drop et recréer les fonctions RPC si elles existent
DROP FUNCTION IF EXISTS increment_likes(uuid);
DROP FUNCTION IF EXISTS decrement_likes(uuid);

-- 3. Créer les fonctions RPC pour increment/decrement
CREATE OR REPLACE FUNCTION increment_likes(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = post_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_likes(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = post_id;
END;
$$;

-- 4. Activer RLS sur la table likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 5. Créer des policies TRÈS permissives pour éviter les 406
-- Policy de lecture : TOUT LE MONDE peut lire (nécessaire pour le comptage)
CREATE POLICY "Anyone can view likes"
  ON public.likes
  FOR SELECT
  USING (true);

-- Policy d'insertion : users authentifiés peuvent liker
CREATE POLICY "Authenticated users can insert likes"
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy de suppression : users peuvent unlike leurs propres likes
CREATE POLICY "Users can delete their own likes"
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Vérifier que la table posts a bien la colonne likes_count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 7. Recalculer tous les compteurs de likes (pour être sûr)
UPDATE posts
SET likes_count = (
  SELECT COUNT(*)
  FROM likes
  WHERE likes.post_id = posts.id
);

-- 8. Grant des permissions sur les fonctions RPC
GRANT EXECUTE ON FUNCTION increment_likes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_likes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_likes(uuid) TO anon;
GRANT EXECUTE ON FUNCTION decrement_likes(uuid) TO anon;

-- 9. Vérification finale - afficher le nombre de likes par post
SELECT
  p.id,
  p.track_name,
  p.likes_count as "Count in posts table",
  COUNT(l.id) as "Actual likes count"
FROM posts p
LEFT JOIN likes l ON l.post_id = p.id
GROUP BY p.id, p.track_name, p.likes_count
HAVING p.likes_count IS NOT NULL
ORDER BY p.created_at DESC
LIMIT 10;
