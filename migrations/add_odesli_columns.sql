-- Add Odesli universal links columns to posts table
-- Run this in Supabase SQL Editor

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS spotify_embed_url TEXT,
  ADD COLUMN IF NOT EXISTS apple_music_url TEXT,
  ADD COLUMN IF NOT EXISTS deezer_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_music_url TEXT,
  ADD COLUMN IF NOT EXISTS tidal_url TEXT,
  ADD COLUMN IF NOT EXISTS odesli_page_url TEXT;

-- Add preferred_platform, display_name, bio to user profiles
ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS preferred_platform TEXT DEFAULT 'spotify',
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add reshakes_count if missing
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS reshakes_count INTEGER DEFAULT 0;

-- Create avatars storage bucket (run in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;
