-- Migration: Ajout colonnes personnalisation profil
-- Date: 2025-12-17

-- Ajouter colonnes pour personnalisation profil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_album_cover_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_album_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_album_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_album_artist TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_color TEXT DEFAULT '#F5D5E8';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- RLS Policy: Les users peuvent modifier leur propre profil
CREATE POLICY IF NOT EXISTS "Users can update own profile customization"
ON profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Tout le monde peut voir les profils
CREATE POLICY IF NOT EXISTS "Profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

COMMENT ON COLUMN profiles.profile_album_cover_url IS 'URL de la pochette d''album choisie pour le profil';
COMMENT ON COLUMN profiles.profile_album_id IS 'ID Spotify de l''album/single choisi';
COMMENT ON COLUMN profiles.profile_album_name IS 'Nom de l''album/single';
COMMENT ON COLUMN profiles.profile_album_artist IS 'Artiste de l''album/single';
COMMENT ON COLUMN profiles.profile_color IS 'Couleur pastel choisie pour l''accent du profil';
