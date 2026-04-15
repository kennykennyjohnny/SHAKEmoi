-- Add image_url column to messages table for photo & GIF support in DMs
-- Run this in Supabase SQL Editor

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure circle-media storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('circle-media', 'circle-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload to circle-media
DO $$
BEGIN
  CREATE POLICY "Authenticated users can upload circle media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'circle-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage policy: public read access for circle-media
DO $$
BEGIN
  CREATE POLICY "Public read access for circle media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'circle-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
