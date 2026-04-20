-- SHAKEMOI V3 - Buckets & Circle Likes Setup
-- Execute this in Supabase SQL Editor to fix bucket errors and add message likes system
-- This script is SAFE to run multiple times (uses ON CONFLICT / IF NOT EXISTS)

-- =====================================================
-- 1. STORAGE BUCKETS SETUP
-- =====================================================

-- Create/ensure avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, '{"image/*"}')
ON CONFLICT (id) DO NOTHING;

-- Create/ensure shake-media bucket (for ephemeral shakes with photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shake-media', 'shake-media', true, 10485760, '{"image/*"}')
ON CONFLICT (id) DO NOTHING;

-- Create/ensure story-media bucket (for stories)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('story-media', 'story-media', true, 10485760, '{"image/*"}')
ON CONFLICT (id) DO NOTHING;

-- Create/ensure circle-media bucket (for circle messages with photos/GIFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('circle-media', 'circle-media', true, 10485760, '{"image/*","video/mp4"}')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. STORAGE RLS POLICIES FOR ALL BUCKETS
-- =====================================================

-- Reset and recreate all policies with consistent naming

-- Avatars bucket
DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "avatars public" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Shake-media bucket
DROP POLICY IF EXISTS "public read shake-media" ON storage.objects;
DROP POLICY IF EXISTS "shake_media_public_read" ON storage.objects;
CREATE POLICY "shake_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'shake-media');

DROP POLICY IF EXISTS "users upload shake-media" ON storage.objects;
DROP POLICY IF EXISTS "shake_media_auth_upload" ON storage.objects;
CREATE POLICY "shake_media_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shake-media');

DROP POLICY IF EXISTS "users delete shake-media" ON storage.objects;
DROP POLICY IF EXISTS "shake_media_auth_delete" ON storage.objects;
CREATE POLICY "shake_media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shake-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Story-media bucket
DROP POLICY IF EXISTS "public read story-media" ON storage.objects;
DROP POLICY IF EXISTS "story_media_public_read" ON storage.objects;
CREATE POLICY "story_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'story-media');

DROP POLICY IF EXISTS "users upload story-media" ON storage.objects;
DROP POLICY IF EXISTS "story_media_auth_upload" ON storage.objects;
CREATE POLICY "story_media_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-media');

DROP POLICY IF EXISTS "users delete story-media" ON storage.objects;
DROP POLICY IF EXISTS "story_media_auth_delete" ON storage.objects;
CREATE POLICY "story_media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'story-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Circle-media bucket
DROP POLICY IF EXISTS "public read circle-media" ON storage.objects;
DROP POLICY IF EXISTS "circle_media_public_read" ON storage.objects;
CREATE POLICY "circle_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'circle-media');

DROP POLICY IF EXISTS "users upload circle-media" ON storage.objects;
DROP POLICY IF EXISTS "circle_media_auth_upload" ON storage.objects;
CREATE POLICY "circle_media_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'circle-media');

DROP POLICY IF EXISTS "users delete circle-media" ON storage.objects;
DROP POLICY IF EXISTS "circle_media_auth_delete" ON storage.objects;
CREATE POLICY "circle_media_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'circle-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- 3. CIRCLE MESSAGE LIKES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.circle_message_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.circle_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  emoji TEXT DEFAULT '❤️' CHECK (char_length(emoji) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_circle_message_likes_message ON public.circle_message_likes(message_id);
CREATE INDEX IF NOT EXISTS idx_circle_message_likes_user ON public.circle_message_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_message_likes_created ON public.circle_message_likes(created_at DESC);

-- Add likes_count to circle_messages if missing
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0 CHECK (likes_count >= 0);

-- =====================================================
-- 4. RLS ON CIRCLE MESSAGE LIKES
-- =====================================================

ALTER TABLE public.circle_message_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circle_message_likes_select" ON public.circle_message_likes;
CREATE POLICY "circle_message_likes_select" ON public.circle_message_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_messages cm
      JOIN circle_members cmem ON cm.circle_id = cmem.circle_id
      WHERE cm.id = message_id AND cmem.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "circle_message_likes_insert" ON public.circle_message_likes;
CREATE POLICY "circle_message_likes_insert" ON public.circle_message_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM circle_messages cm
      JOIN circle_members cmem ON cm.circle_id = cmem.circle_id
      WHERE cm.id = message_id AND cmem.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "circle_message_likes_delete" ON public.circle_message_likes;
CREATE POLICY "circle_message_likes_delete" ON public.circle_message_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 5. RPC FUNCTIONS FOR LIKES
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_circle_message_likes(message_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.circle_messages SET likes_count = likes_count + 1 WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_circle_message_likes(message_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.circle_messages SET likes_count = GREATEST(0, likes_count - 1) WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. REALTIME
-- =====================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circle_message_likes;
EXCEPTION WHEN duplicate_object OR others THEN NULL;
END $$;
