-- Function to increment reshakes count
CREATE OR REPLACE FUNCTION increment_reshakes_count(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET reshakes_count = COALESCE(reshakes_count, 0) + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_reshakes_count(UUID) TO authenticated;

-- Add isFollowing helper function if not exists
CREATE OR REPLACE FUNCTION is_following(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = auth.uid()
    AND following_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_following(UUID) TO authenticated;

COMMENT ON FUNCTION increment_reshakes_count IS 'Increments the reshakes_count for a post';
COMMENT ON FUNCTION is_following IS 'Checks if current user is following target user';
