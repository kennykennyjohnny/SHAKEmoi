-- Fix pour le nom d'affichage qui disparaît après actualisation

-- 1. Vérifier si la colonne display_name existe
ALTER TABLE users_profile 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Migrer les données existantes de username vers display_name si vide
UPDATE users_profile 
SET display_name = username 
WHERE display_name IS NULL OR display_name = '';

-- 3. S'assurer que display_name est toujours renseigné par défaut
ALTER TABLE users_profile 
ALTER COLUMN display_name SET DEFAULT '';

-- 4. Créer un trigger pour auto-remplir display_name depuis username si vide
CREATE OR REPLACE FUNCTION ensure_display_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := NEW.username;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS ensure_display_name_trigger ON users_profile;
CREATE TRIGGER ensure_display_name_trigger
  BEFORE INSERT OR UPDATE ON users_profile
  FOR EACH ROW
  EXECUTE FUNCTION ensure_display_name();

-- 5. Vérifier les données
SELECT id, username, display_name 
FROM users_profile 
LIMIT 10;
