-- Add image_url column to posts for circle photo sharing
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for circle media (photos/gifs)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('circle-media', 'circle-media', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to circle-media
CREATE POLICY "Users can upload circle media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'circle-media');

-- Allow public read access to circle media
CREATE POLICY "Public read circle media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'circle-media');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own circle media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'circle-media' AND (storage.foldername(name))[1] = auth.uid()::text);
