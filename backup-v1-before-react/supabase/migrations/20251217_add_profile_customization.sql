-- Add profile customization columns to users_profile table

ALTER TABLE public.users_profile
ADD COLUMN IF NOT EXISTS profile_album_cover_url TEXT,
ADD COLUMN IF NOT EXISTS profile_album_id TEXT,
ADD COLUMN IF NOT EXISTS profile_album_name TEXT,
ADD COLUMN IF NOT EXISTS profile_album_artist TEXT,
ADD COLUMN IF NOT EXISTS profile_color TEXT DEFAULT '#F5D5E8';

-- Add comment for documentation
COMMENT ON COLUMN public.users_profile.profile_album_cover_url IS 'URL of the album cover used as profile picture';
COMMENT ON COLUMN public.users_profile.profile_album_id IS 'Spotify album ID';
COMMENT ON COLUMN public.users_profile.profile_album_name IS 'Album name for profile';
COMMENT ON COLUMN public.users_profile.profile_album_artist IS 'Artist name for profile album';
COMMENT ON COLUMN public.users_profile.profile_color IS 'User selected accent color for profile (pastel)';
