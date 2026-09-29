-- Ajouter la colonne preview_url à la table posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_posts_preview_url ON posts(preview_url) WHERE preview_url IS NOT NULL;
