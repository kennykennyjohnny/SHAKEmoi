-- SHAKEMOI V3 - Add photo_url to circles
-- Run in Supabase SQL Editor

ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS photo_url TEXT;
