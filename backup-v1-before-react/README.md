# SHAKEMOI

**L'app que tu ouvres avant Spotify.**

Un réseau social musical où tu partages ta passion pour la musique, découvres de nouveaux morceaux et connectes avec d'autres mélomanes.

## ✨ Fonctionnalités

- **Feed Musical** : Découvre les morceaux partagés par les personnes que tu "feels"
- **Top 100 Global** : Explore les morceaux les plus écoutés du moment (Last.fm)
- **Recherche** : Trouve des morceaux ou des utilisateurs facilement
- **Profil Personnalisé** : Choisis ta couleur, affiche tes stats et tes shakes
- **Interactions Sociales** : Like, commente et re-shake les posts
- **System Feel** : Suis jusqu'à 100 personnes pour voir leur feed

## 🚀 Stack Technique

- **Frontend** : HTML5, CSS3, JavaScript vanilla (pas de framework)
- **Backend** : Supabase (PostgreSQL + Auth + Realtime)
- **API Musicale** : Last.fm API
- **Hébergement** : GitHub Pages
- **Design** : Glassmorphism, Mobile-First, Responsive

## 📦 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/kennykennyjohnny/SHAKEmoi.git
cd SHAKEmoi
```

### 2. Configurer Supabase

1. Créer un projet sur [Supabase](https://supabase.com)
2. Exécuter le SQL dans `supabase-schema.sql` dans le SQL Editor
3. Copier tes credentials (Project URL + anon key)
4. Les coller dans `scripts/config.js`

### 3. Activer GitHub Pages

1. Va dans Settings > Pages
2. Source : Deploy from a branch
3. Branch : `main` / `(root)`
4. Save

### 4. Visiter ton site

Le site sera disponible sur :
- `https://[ton-username].github.io/SHAKEmoi/`
- Ou `shakemoi.fr` si tu as configuré un domaine custom

## ⚙️ Configuration Supabase

### Étape 1 : Créer les tables

Va dans le SQL Editor de Supabase et exécute le contenu du fichier `supabase-schema.sql`.

Cela créera :
- Table `users_profile` (profils utilisateurs)
- Table `posts` (posts musicaux)
- Table `likes` (likes sur posts)
- Table `comments` (commentaires)
- Table `follows` (relations follows)
- Fonctions SQL pour les compteurs
- Row Level Security (RLS)

### Étape 2 : Configurer l'authentification

1. Va dans Authentication > Settings
2. **Disable email confirmation** (pour simplifier en dev)
   - Site URL : `https://[ton-username].github.io/SHAKEmoi/`
   - Redirect URLs : Ajoute `https://[ton-username].github.io/SHAKEmoi/app.html`

### Étape 3 : Copier les credentials

1. Va dans Settings > API
2. Copie `Project URL`
3. Copie `anon` `public` key
4. Colle-les dans `scripts/config.js`

## 🎵 API Last.fm

L'app utilise l'API Last.fm pour :
- Afficher le Top 100 global
- Rechercher des morceaux
- Récupérer les pochettes d'albums

API Key déjà configurée : `43448d565b80bc04d2d458c4c41b8e3c`

Pas besoin de configuration supplémentaire !

## 📱 Fonctionnalités Détaillées

### Authentification
- Inscription avec email/password
- Choix d'une couleur personnalisée (note musicale)
- Connexion/Déconnexion
- Vérification auto de session

### Feed (Shake)
- Affiche les posts des personnes followées
- Like/Unlike des posts
- Commentaires sur les posts
- Re-shake (repost)
- Affichage temps réel (il y a X min/h/j)

### Top 100
- Top 100 mondial Last.fm
- Mise à jour en temps réel
- Shake direct depuis le Top
- Pochettes HD

### Recherche
- Toggle Sons/Personnes
- Recherche de morceaux (Last.fm)
- Recherche d'utilisateurs (Supabase)
- Feel/Unfeel des utilisateurs
- Limite 100 feels par user

### Profil
- Note musicale colorée
- Stats : Feels (abonnements) / Feelings (abonnés)
- Onglets Shakes / Commentaires
- Grille de posts likés

## 🎨 Design System

### Couleurs

```css
--bg-primary: #0A0A0F
--bg-secondary: #1A1A2E
--primary: #7c3aed (violet)
--text-primary: #FFFFFF
--text-secondary: #9CA3AF
```

### Couleurs Utilisateurs

6 couleurs au choix pour la note musicale :
- Rouge `#FF6B6B`
- Cyan `#4ECDC4`
- Jaune `#FFE66D`
- Vert `#A8E6CF`
- Rose `#FF8B94`
- Violet `#B4A7D6`

### Responsive

- **Mobile** : Plein écran
- **Desktop (768px+)** : 66% largeur, max 600px, centré avec ombre violette

## 📂 Structure du Projet

```
SHAKEmoi/
├── index.html              # Page d'authentification
├── app.html               # Application principale
├── CNAME                  # Domaine custom
├── README.md
├── supabase-schema.sql    # Schema base de données
├── styles/
│   ├── auth.css          # Styles page auth
│   └── app.css           # Styles app principale
├── scripts/
│   ├── config.js         # Config Supabase
│   ├── auth.js           # Gestion authentification
│   ├── database.js       # Requêtes Supabase
│   ├── lastfm.js         # API Last.fm
│   └── app.js            # Logique application
├── assets/
│   ├── images/
│   └── icons/
└── data/
```

## 🔒 Sécurité

- **Row Level Security (RLS)** activé sur toutes les tables
- **Validation côté client et serveur**
- **Escape HTML** pour prévenir XSS
- **Rate limiting** via Supabase
- **Limite 100 follows** par user

## 🐛 Troubleshooting

### Le site ne charge pas
1. Vérifie que GitHub Pages est activé
2. Vérifie l'URL : `https://[username].github.io/SHAKEmoi/`
3. Ouvre la console (F12) pour voir les erreurs

### Erreur Supabase
1. Vérifie les credentials dans `scripts/config.js`
2. Vérifie que les tables sont créées (SQL Editor)
3. Vérifie que RLS est activé

### L'authentification ne marche pas
1. Vérifie email confirmation désactivée
2. Vérifie les Redirect URLs dans Supabase
3. Check console pour erreurs

### Le Top 100 ne charge pas
1. Vérifie la connexion internet
2. Last.fm API peut être temporairement down
3. Check console pour erreurs réseau

## 📝 Licence

MIT License - Feel free to use and modify !

## 🤝 Contribution

Les pull requests sont bienvenues !

1. Fork le projet
2. Crée ta branche (`git checkout -b feature/AmazingFeature`)
3. Commit tes changes (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvre une Pull Request

## 📧 Contact

- GitHub: [@kennykennyjohnny](https://github.com/kennykennyjohnny)
- Website: [shakemoi.fr](https://shakemoi.fr)

---

Made with ❤️ and 🎵
