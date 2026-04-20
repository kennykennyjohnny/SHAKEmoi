-- SHAKEMOI V3 - Message Likes (DMs + Circles)
-- Execute this in Supabase SQL Editor to add likes to individual messages

-- =====================================================
-- 1. MESSAGE LIKES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.message_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  emoji TEXT DEFAULT '❤️' CHECK (char_length(emoji) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_likes_message ON public.message_likes(message_id);
CREATE INDEX IF NOT EXISTS idx_message_likes_user ON public.message_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_message_likes_created ON public.message_likes(created_at DESC);

-- =====================================================
-- 2. RLS ON MESSAGE LIKES
-- =====================================================

ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_likes_select" ON public.message_likes;
CREATE POLICY "message_likes_select" ON public.message_likes FOR SELECT TO authenticated
  USING (
    -- Can see likes on messages you're part of (sender or receiver)
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_likes_insert" ON public.message_likes;
CREATE POLICY "message_likes_insert" ON public.message_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_likes_delete" ON public.message_likes;
CREATE POLICY "message_likes_delete" ON public.message_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 3. REALTIME PUBLICATIONS
-- =====================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_likes;
EXCEPTION WHEN duplicate_object OR others THEN NULL;
END $$;
