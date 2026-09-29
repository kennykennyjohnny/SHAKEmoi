-- =====================================================
-- SHAKEMOI - MISES À JOUR DATABASE
-- Tables: artists, notifications
-- Triggers: notifications automatiques, feels realtime
-- =====================================================

-- =====================================================
-- 1. TABLE ARTISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.artists (
  id TEXT PRIMARY KEY, -- Spotify artist ID
  name TEXT NOT NULL,
  image_url TEXT,
  genres TEXT[], -- Array de genres
  popularity INTEGER,
  followers INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_popularity ON public.artists(popularity DESC);

-- RLS pour artists
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les artistes
CREATE POLICY "artists_select"
ON public.artists FOR SELECT
TO public
USING (true);

-- Seuls les utilisateurs authentifiés peuvent insérer/modifier
CREATE POLICY "artists_insert"
ON public.artists FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "artists_update"
ON public.artists FOR UPDATE
TO authenticated
USING (true);

-- =====================================================
-- 2. TABLE NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('feel', 'like', 'comment', 'reshake')),
  from_user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- RLS pour notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres notifications
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres notifications
CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Tout le monde peut insérer des notifications (via triggers)
CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- 3. TRIGGERS POUR NOTIFICATIONS
-- =====================================================

-- Fonction pour créer notification quand quelqu'un te feel
CREATE OR REPLACE FUNCTION public.create_feel_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, from_user_id)
  VALUES (NEW.following_id, 'feel', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_feel_notification ON public.follows;
CREATE TRIGGER trigger_feel_notification
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.create_feel_notification();

-- Fonction pour créer notification quand quelqu'un like ton post
CREATE OR REPLACE FUNCTION public.create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne pas créer de notification si c'est son propre post
  INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
  SELECT p.user_id, 'like', NEW.user_id, NEW.post_id
  FROM public.posts p
  WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_like_notification ON public.likes;
CREATE TRIGGER trigger_like_notification
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.create_like_notification();

-- Fonction pour créer notification quand quelqu'un commente ton post
CREATE OR REPLACE FUNCTION public.create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne pas créer de notification si c'est son propre post
  INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
  SELECT p.user_id, 'comment', NEW.user_id, NEW.post_id
  FROM public.posts p
  WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_comment_notification ON public.comments;
CREATE TRIGGER trigger_comment_notification
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.create_comment_notification();

-- Fonction pour créer notification quand quelqu'un re-shake ton post
CREATE OR REPLACE FUNCTION public.create_reshake_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si c'est un reshake et créer la notification
  IF NEW.is_reshake = TRUE AND NEW.original_post_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, from_user_id, post_id)
    SELECT p.user_id, 'reshake', NEW.user_id, NEW.original_post_id
    FROM public.posts p
    WHERE p.id = NEW.original_post_id AND p.user_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_reshake_notification ON public.posts;
CREATE TRIGGER trigger_reshake_notification
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.create_reshake_notification();

-- =====================================================
-- 4. PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.artists TO anon, authenticated;
GRANT INSERT, UPDATE ON public.artists TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ SHAKEMOI updates applied successfully!';
  RAISE NOTICE '📝 New tables: artists, notifications';
  RAISE NOTICE '🔔 Notification triggers: feel, like, comment, reshake';
  RAISE NOTICE '🎵 Ready to rock!';
END $$;
