# SHAKEMOI

Application de partage musical en temps réel avec Supabase et Last.fm API.

## Description

SHAKEMOI est une application web mobile-first permettant aux utilisateurs de partager leur passion pour la musique, découvrir de nouveaux morceaux, et interagir avec une communauté de mélomanes.

## Fonctionnalités

### Authentification
- Inscription avec username unique, email, mot de passe et choix de couleur personnalisée
- Connexion avec session persistante JWT
- Validation des données utilisateur

### Feed (Shake)
- Fil d'actualité des posts des personnes suivies
- Affichage des posts avec pochette d'album, titre, artiste et commentaire
- Like/Unlike des posts avec compteur en temps réel
- Commentaires sur les posts
- Mises à jour temps réel avec Supabase Realtime

### Top 100
- Top 100 des morceaux actuels via Last.fm API
- Affichage avec classement, pochette, titre et artiste
- Actions : Shake (créer un post), Commenter, Partager
- Partage natif ou copie de lien

### Recherche
- Recherche de personnes par username
- Recherche de sons (tracks/posts) par titre ou artiste
- Bouton Feel/Unfeel pour suivre/ne plus suivre
- Limite de 100 abonnements par utilisateur
- Affichage des statistiques de followers

### Profil
- Note musicale colorée personnalisée
- Statistiques : Feels (abonnements) et Feelings (abonnés)
- Toggle entre Shakes (likes) et Commentaires
- Grille de posts avec overlay interactif
- Bouton de déconnexion

## Architecture Technique

### Frontend
- HTML5 sémantique
- CSS3 avec variables, glassmorphism, animations
- JavaScript vanilla (ES6+)
- Architecture modulaire avec classes

### Backend
- Supabase pour :
  - Authentification (Auth)
  - Base de données PostgreSQL
  - Temps réel (Realtime subscriptions)
  - RLS (Row Level Security)

### API Externe
- Last.fm API pour le Top 100 des morceaux

## Structure des Fichiers

```
shakemoi-rebuild/
├── index.html                  # Structure HTML principale
├── css/
│   ├── reset.css              # Reset CSS
│   ├── variables.css          # Variables CSS (couleurs, espacements)
│   ├── main.css               # Styles principaux
│   ├── components.css         # Styles des composants
│   └── mobile.css             # Responsive design
├── js/
│   ├── config.js              # Configuration Supabase
│   ├── supabase-client.js     # Client et helpers Supabase
│   ├── auth.js                # Gestion authentification
│   ├── feed.js                # Gestion du feed et posts
│   ├── top.js                 # Intégration Last.fm
│   ├── search.js              # Recherche users et tracks
│   ├── profile.js             # Gestion du profil
│   └── app.js                 # Application principale (routing)
└── README.md                  # Ce fichier
```

## Base de Données Supabase

### Tables nécessaires

#### users_profile
```sql
CREATE TABLE users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  color TEXT NOT NULL,
  feels_count INTEGER DEFAULT 0,
  feelings_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### posts
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover TEXT,
  text TEXT CHECK (length(text) <= 444),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### likes
```sql
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
```

#### comments
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### feels (follows)
```sql
CREATE TABLE feels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feeler_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  feeling_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feeler_id, feeling_id),
  CHECK (feeler_id != feeling_id)
);
```

### Fonctions RPC nécessaires

#### Incrémenter les likes
```sql
CREATE OR REPLACE FUNCTION increment_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes_count = likes_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
```

#### Décrémenter les likes
```sql
CREATE OR REPLACE FUNCTION decrement_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
```

#### Incrémenter les commentaires
```sql
CREATE OR REPLACE FUNCTION increment_comments(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
```

### Triggers pour les stats (optionnel mais recommandé)

```sql
-- Trigger pour mettre à jour feels_count
CREATE OR REPLACE FUNCTION update_feels_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users_profile SET feels_count = feels_count + 1 WHERE id = NEW.feeler_id;
    UPDATE users_profile SET feelings_count = feelings_count + 1 WHERE id = NEW.feeling_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users_profile SET feels_count = GREATEST(feels_count - 1, 0) WHERE id = OLD.feeler_id;
    UPDATE users_profile SET feelings_count = GREATEST(feelings_count - 1, 0) WHERE id = OLD.feeling_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feels_count_trigger
AFTER INSERT OR DELETE ON feels
FOR EACH ROW EXECUTE FUNCTION update_feels_count();
```

## Configuration

### 1. Configuration Supabase

Votre fichier `js/config.js` contient déjà vos credentials :
```javascript
const SUPABASE_URL = 'https://eyvfjxtxjuojzwwqbfui.supabase.co';
const SUPABASE_ANON_KEY = 'votre_clé_anon';
```

### 2. Créer les tables

Rendez-vous dans votre projet Supabase → SQL Editor, et exécutez les requêtes SQL ci-dessus pour créer les tables, fonctions et triggers.

### 3. Activer Row Level Security (RLS)

Pour chaque table, activez RLS et créez les policies appropriées :

```sql
-- Exemple pour la table posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy de lecture : tout le monde peut lire les posts
CREATE POLICY "Posts are viewable by everyone"
ON posts FOR SELECT
USING (true);

-- Policy d'insertion : seuls les utilisateurs authentifiés peuvent créer des posts
CREATE POLICY "Users can create their own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy de suppression : les utilisateurs peuvent supprimer leurs propres posts
CREATE POLICY "Users can delete their own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);
```

Répétez pour toutes les tables avec les permissions appropriées.

### 4. Activer Realtime

Dans Supabase Dashboard → Database → Replication, activez Realtime pour la table `posts`.

## Installation et Lancement

### Méthode 1 : Serveur local simple

```bash
# Si vous avez Python 3 installé
python3 -m http.server 8000

# Ou avec Python 2
python -m SimpleHTTPServer 8000

# Ou avec Node.js (npx)
npx serve .
```

Puis ouvrez votre navigateur sur `http://localhost:8000`

### Méthode 2 : VS Code Live Server

1. Installez l'extension "Live Server" dans VS Code
2. Clic droit sur `index.html` → "Open with Live Server"

## Design

### Couleurs
- Fond : Dégradé noir (#0a0a0f) vers violet foncé (#1a0a2e)
- Primary : Violet (#8b5cf6)
- Cards : Glassmorphism avec backdrop-filter blur
- Couleurs utilisateur : 6 options prédéfinies

### Responsive
- Mobile : 100% largeur, navigation bottom fixe
- Desktop : 66% largeur centrée, fond sombre autour
- Breakpoint principal : 768px

### Animations
- Transitions smooth sur tous les éléments interactifs
- Fade-in lors du changement d'onglet
- Hover effects sur boutons et cards

## Fonctionnalités Critiques Implémentées

- ✅ Inscription avec validation username unique
- ✅ Login avec session persistante
- ✅ Création de posts (track + artist + texte max 444 caractères)
- ✅ Like/Unlike avec update automatique du compteur
- ✅ Commentaires avec update du compteur
- ✅ Follow/Unfollow avec limite de 100 abonnements
- ✅ Stats feels/feelings
- ✅ Top 100 temps réel Last.fm
- ✅ Recherche users et tracks
- ✅ Profil avec grille de posts
- ✅ Gestion d'erreurs avec try/catch
- ✅ Loading states (spinners)
- ✅ Responsive mobile-first

## Améliorations Futures

- [ ] Upload d'images personnalisées pour les avatars
- [ ] Recherche de morceaux via Spotify/Deezer API
- [ ] Player audio intégré
- [ ] Notifications en temps réel
- [ ] Messages privés
- [ ] Playlists collaboratives
- [ ] Mode sombre/clair
- [ ] PWA (Progressive Web App)
- [ ] Pagination infinie pour le feed

## Sécurité

- Mot de passe minimum 6 caractères
- Validation côté client et serveur
- RLS activé sur toutes les tables Supabase
- Protection CSRF via Supabase
- Limite d'abonnements (100) pour éviter le spam
- Validation longueur texte posts (444 caractères)

## Support Navigateurs

- Chrome/Edge (dernières versions)
- Firefox (dernières versions)
- Safari (iOS 14+, macOS)
- Samsung Internet

## Auteur

Projet SHAKEMOI - Application de partage musical

## Licence

MIT License - Libre d'utilisation et de modification
