-- Fix infinite recursion in circle policies

-- Drop the old policy
DROP POLICY IF EXISTS "Members can read circle members" ON circle_members;

-- Create new policy to avoid recursion
CREATE POLICY "Members can read circle members" ON circle_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM circles c WHERE c.id = circle_members.circle_id AND c.created_by = auth.uid()) OR
    user_id = auth.uid()
  );