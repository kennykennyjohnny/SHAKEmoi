-- Fix infinite recursion in circle policies

-- Create helper function
CREATE OR REPLACE FUNCTION is_circle_member(circle_id UUID, user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old policies
DROP POLICY IF EXISTS "Members can read circles" ON circles;
DROP POLICY IF EXISTS "Members can read circle members" ON circle_members;

-- Update policies to avoid recursion
CREATE POLICY "Members can read circles" ON circles
  FOR SELECT USING (
    auth.uid() = created_by OR
    is_circle_member(id, auth.uid())
  );

CREATE POLICY "Members can read circle members" ON circle_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM circles c WHERE c.id = circle_members.circle_id AND c.created_by = auth.uid()) OR
    user_id = auth.uid()
  );