-- ============================================
-- SYSTÈME DE NOTIFICATIONS SHAKEMOI
-- ============================================

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('feel', 'like', 'comment', 'reshake')),
  from_user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS POUR CRÉER LES NOTIFICATIONS
-- ============================================

-- Fonction pour créer notification quand quelqu'un te feel
CREATE OR REPLACE FUNCTION create_feel_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, from_user_id)
  VALUES (NEW.following_id, 'feel', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feel_notification ON follows;
CREATE TRIGGER trigger_feel_notification
AFTER INSERT ON follows
FOR EACH ROW EXECUTE FUNCTION create_feel_notification();

-- Fonction pour créer notification quand quelqu'un like ton post
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, from_user_id, post_id)
  SELECT p.user_id, 'like', NEW.user_id, NEW.post_id
  FROM posts p
  WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_like_notification ON likes;
CREATE TRIGGER trigger_like_notification
AFTER INSERT ON likes
FOR EACH ROW EXECUTE FUNCTION create_like_notification();

-- Fonction pour créer notification quand quelqu'un commente ton post
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, from_user_id, post_id)
  SELECT p.user_id, 'comment', NEW.user_id, NEW.post_id
  FROM posts p
  WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comment_notification ON comments;
CREATE TRIGGER trigger_comment_notification
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION create_comment_notification();

-- Fonction pour créer notification quand quelqu'un re-shake ton post
CREATE OR REPLACE FUNCTION create_reshake_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_reshake = TRUE AND NEW.original_post_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, from_user_id, post_id)
    SELECT p.user_id, 'reshake', NEW.user_id, NEW.original_post_id
    FROM posts p
    WHERE p.id = NEW.original_post_id AND p.user_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reshake_notification ON posts;
CREATE TRIGGER trigger_reshake_notification
AFTER INSERT ON posts
FOR EACH ROW EXECUTE FUNCTION create_reshake_notification();
