# 📊 ANALYSE D'INTÉGRATION - SHAKEMOI V3

**Date:** 13 janvier 2026
**Objectif:** Intégrer le design Figma dans le repo SHAKEMOI fonctionnel
**Analyse par:** Claude Code

---

## 🎯 RÉSUMÉ EXÉCUTIF

### État Actuel
✅ **REPO SHAKEMOI** : Application complète et fonctionnelle
- Backend Supabase opérationnel
- Spotify API via Edge Function
- Déployé sur shakemoi.fr (GitHub Pages)
- Design "basique" mais tout fonctionne

⏳ **REPO REDESIGN** : Design Figma (non analysé)
- Nouveau design HTML/CSS/JS
- Pas de backend connecté (normal pour Figma Make)
- En attente d'accès pour analyse

---

## 📁 STRUCTURE DU REPO SHAKEMOI ACTUEL

### Fichiers HTML Principaux

#### 1. `index.html` - Page d'Authentification
- **Fonction:** Login et Signup
- **Dépendances Backend:**
  - `scripts/config.js` (configuration Supabase)
  - `scripts/auth.js` (logique authentification)
  - `styles/auth.css`
- **Éléments Critiques à Préserver:**
  - `#login-form` et `#signup-form`
  - `#login-email`, `#login-password`
  - `#signup-username`, `#signup-email`, `#signup-password`
  - Color picker (`.color-btn`)
  - Event listeners pour toggle login/signup

#### 2. `app.html` - Application Principale
- **Fonction:** Interface principale de l'app
- **Structure:**
  - Header avec logo, notifications, paramètres
  - 4 vues principales (Shake/Feed, TOP, Recherche, Profil)
  - Bottom navigation
  - Modals (commentaires, shake, partage, profil, édition)
- **Dépendances Backend:** (voir section scripts ci-dessous)
- **Éléments Critiques à Préserver:**
  - Tous les `id` utilisés dans les scripts
  - Data-attributes (`data-view`, `data-tab`, etc.)
  - Structure des modals
  - Bottom navigation

---

## 🔧 FICHIERS BACKEND (À CONSERVER INTÉGRALEMENT)

### Configuration

#### `scripts/config.js` ⚠️ CRITIQUE
```javascript
SUPABASE_URL: 'https://vbjmhtwrfboqziwibsut.supabase.co'
SUPABASE_ANON_KEY: 'eyJhbGci...' (clé complète présente)
```
- **Action:** CONSERVER INTÉGRALEMENT
- **Ne jamais modifier** sauf changement de projet Supabase

### Authentification

#### `scripts/auth.js` ⚠️ CRITIQUE
- **Fonctions:**
  - `checkAuth()` - Vérification session
  - `handleLogin()` - Connexion utilisateur
  - `handleSignup()` - Inscription utilisateur
  - Protection anti-boucle de redirection
- **Action:** CONSERVER INTÉGRALEMENT
- **Dépend de:** config.js, index.html DOM elements

### Base de Données

#### `scripts/database.js` ⚠️ CRITIQUE
- **Fonctions Utilisateur:**
  - `getCurrentUser()` - Récupère user actuel
  - `getUserProfile(userId)` - Récupère profil
  - `getUserStats(userId)` - Récupère stats (feels/feelings)

- **Fonctions Posts:**
  - `getFeed(limit)` - Feed des personnes followées
  - `getUserPosts(userId)` - Posts d'un utilisateur
  - `createPost()` - Créer un post
  - `reshakePost(postId)` - Re-shake

- **Fonctions Likes:**
  - `likePost(postId)` - Liker un post
  - `unlikePost(postId)` - Unlike
  - `hasLikedPost(postId)` - Vérifier si liké
  - `getUserLikedPosts(userId)` - Posts likés par user

- **Fonctions Comments:**
  - `addComment(postId, text)` - Ajouter commentaire
  - `getPostComments(postId)` - Récupérer commentaires
  - `getUserComments(userId)` - Commentaires d'un user
  - `getPostReshakes(postId)` - Reshakes d'un post

- **Fonctions Follows:**
  - `followUser(targetUserId)` - Follow
  - `unfollowUser(targetUserId)` - Unfollow
  - `isFollowing(targetUserId)` - Vérifier si follow
  - `getUserFollowers(userId)` - Followers
  - `getUserFollowing(userId)` - Following

- **Fonctions Search:**
  - `searchUsers(query)` - Rechercher users
  - `getTopUsers(limit)` - Top users par feels
  - `searchPosts(query)` - Rechercher posts

- **Action:** CONSERVER INTÉGRALEMENT
- **Note:** Toutes ces fonctions sont appelées depuis `app.js`

### API Spotify

#### `scripts/spotify.js` ⚠️ CRITIQUE
- **Architecture:** Classe `SpotifyAPI`
- **Edge Function:** `https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/spotify-proxy`
- **Méthodes:**
  - `getTop100France()` - Top 100 France
  - `getGlobalTop50()` - Top 50 global
  - `searchTracks(query)` - Recherche tracks
  - `searchAlbums(query)` - Recherche albums
  - `getArtist(artistId)` - Infos artiste
  - `getArtistTopTracks(artistId)` - Top tracks artiste
  - `getTrack(trackId)` - Infos track
- **Action:** CONSERVER INTÉGRALEMENT

### Autres Scripts Backend

#### `scripts/notifications.js`
- Gestion des notifications utilisateur
- Polling des nouvelles notifications
- **Action:** CONSERVER

#### `scripts/v3-features.js`
- Features V3 de l'application
- **Action:** CONSERVER

#### `scripts/profile-customization.js`
- Personnalisation profil (couleur, pochette album)
- **Action:** CONSERVER

#### `scripts/userPreferences.js`
- Gestion préférences utilisateur
- **Action:** CONSERVER

#### `scripts/spotify-player.js`
- Player Spotify intégré
- **Action:** CONSERVER

#### `scripts/appleMusicApi.js`
- API Apple Music (alternative)
- **Action:** CONSERVER

#### `scripts/app.js` ⚠️ CRITIQUE
- **Taille:** 71KB (fichier principal massif)
- **Fonction:** Orchestration de toute l'application
- Gestion navigation, feed, top, recherche, profil
- Event listeners pour toutes les interactions
- **Action:** CONSERVER INTÉGRALEMENT
- **Note:** Ce fichier utilise TOUS les autres scripts

---

## 🎨 FICHIERS FRONTEND (À REMPLACER)

### Styles CSS Actuels

```
styles/
├── auth.css (5.4KB)                    - Login/Signup
├── app.css (21.7KB)                    - Styles principaux
├── design-system-v1.css (7.9KB)        - Design system
├── color-scheme.css (1.1KB)            - Variables couleurs
├── coral-theme.css (6.2KB)             - Thème coral
├── modern-layout.css (9.4KB)           - Layout moderne
├── ultra-modern.css                    - Styles ultra modernes
├── header-navbar-modern.css (9.9KB)    - Header/Nav
├── feed-twitter-style.css (12.7KB)     - Feed style Twitter
├── posts-modern.css                    - Posts modernes
├── enhancements.css (8.3KB)            - Améliorations
├── v3-features.css                     - Features V3
├── profile-customization.css           - Profil
├── settings.css                        - Paramètres
├── comments-modal.css (3.9KB)          - Modal commentaires
├── share-modal.css                     - Modal partage
├── top-tabs.css                        - Onglets TOP
├── spinner-enhanced.css                - Spinner
└── ... (autres fichiers désactivés)
```

**Action:** Ces fichiers seront REMPLACÉS par les nouveaux CSS Figma

**⚠️ ATTENTION:**
- Vérifier que les classes utilisées par JS existent toujours
- Préserver les classes fonctionnelles (`.hidden`, `.active`, `.loading`, etc.)

---

## 🔗 DÉPENDANCES CRITIQUES

### CDN Supabase
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7"></script>
```
- **Localisation:** `index.html` (ligne 11), `app.html` (ligne 47)
- **Action:** NE PAS SUPPRIMER

### Ordre de Chargement des Scripts (app.html)
```javascript
1. config.js               // Config Supabase
2. userPreferences.js      // Préférences
3. appleMusicApi.js        // Apple Music API
4. database.js             // Fonctions DB
5. spotify.js              // Spotify API
6. lastfm.js               // Last.fm API
7. notifications.js        // Notifications
8. v3-features.js          // Features V3
9. profile-customization.js // Profil
10. app.js                 // Application principale (DOIT ÊTRE EN DERNIER)
```

**⚠️ CRITIQUE:** Cet ordre DOIT être respecté

---

## 🔍 ÉLÉMENTS DOM CRITIQUES

### IDs Utilisés par le Backend

#### Page Authentication (index.html)
```javascript
// Forms
#login-form, #signup-form

// Inputs
#login-email, #login-password
#signup-username, #signup-email, #signup-password

// Errors
#login-error, #signup-error

// Buttons
.toggle-btn, .switch-link, .color-btn
```

#### Application (app.html)
```javascript
// Views
#shake-view, #top-view, #search-view, #profile-view

// Containers
#feed-container, #top-container, #search-results, #profile-content

// Navigation
.nav-btn[data-view="shake|top|search|profile"]

// Header
#settings-btn, #notif-badge, #btn-edit-profile-header

// Search
#search-input
.search-toggle .toggle-btn[data-mode="tracks|users"]

// Profile
#user-username, #user-note, #feels-count
.profile-tabs .tab-btn[data-tab="shakes|reshakes"]

// Modals
#comments-modal, #comments-list, #comments-input
#shake-modal, #shake-text
#share-modal
#user-profile-modal
#edit-profile-modal
#album-search-input, #album-search-results

// Settings
#settings-menu, #settings-close, #settings-logout
#toggle-spotify, #toggle-apple

// Notifications
#notif-menu, #notif-list
```

### Data Attributes Utilisés
```javascript
data-view="shake|top|search|profile"     // Navigation
data-tab="shakes|reshakes|spotify|reco"  // Onglets
data-mode="tracks|users|login|signup"    // Toggle modes
data-color="#HEXCODE"                    // Couleurs
data-post-id="uuid"                      // Actions posts
```

**⚠️ CRITIQUE:** Si un de ces IDs ou data-attributes est manquant, le backend ne fonctionnera pas

---

## 📊 BASE DE DONNÉES SUPABASE

### Tables Existantes
```sql
users_profile
  - id (uuid)
  - username (text)
  - email (text)
  - color (text)
  - profile_color (text)
  - profile_album_cover_url (text)
  - feels_count (integer)
  - feelings_count (integer)

posts
  - id (uuid)
  - user_id (uuid)
  - track_name (text)
  - artist (text)
  - cover_url (text)
  - text (text)
  - preview_url (text)
  - spotify_url (text)
  - track_id (text)
  - likes_count (integer)
  - comments_count (integer)
  - is_reshake (boolean)
  - original_post_id (uuid)
  - created_at (timestamp)

likes
  - id (uuid)
  - post_id (uuid)
  - user_id (uuid)
  - created_at (timestamp)

comments
  - id (uuid)
  - post_id (uuid)
  - user_id (uuid)
  - text (text)
  - created_at (timestamp)

follows
  - id (uuid)
  - follower_id (uuid)
  - following_id (uuid)
  - created_at (timestamp)
```

### Edge Functions
```
spotify-proxy
  - Endpoint: /functions/v1/spotify-proxy
  - Actions: search, top100, artist, track, etc.
```

---

## 🚀 DÉPLOIEMENT GITHUB PAGES

### Configuration Actuelle
- **Domaine:** shakemoi.fr (via CNAME)
- **Branche:** main
- **Source:** root directory
- **Pas de workflows GitHub Actions** (déploiement automatique via GitHub Pages)

### URLs Importantes
- **Production:** https://shakemoi.fr
- **Site URL Supabase:** Configuré pour shakemoi.fr
- **Redirect URLs:** shakemoi.fr/app.html

---

## 📝 RECOMMANDATIONS POUR L'INTÉGRATION

### Phase 1: Analyse du Design Figma
- [ ] Accéder au repo Redesign SHAKEMOI
- [ ] Identifier les fichiers HTML générés
- [ ] Identifier les fichiers CSS générés
- [ ] Lister les assets (images, fonts, icons)
- [ ] Mapper les IDs/classes Figma vs IDs/classes actuels

### Phase 2: Mapping des Éléments
Créer un tableau de correspondance:

| Élément Fonctionnel | ID/Class Actuel | ID/Class Figma | Action |
|---------------------|-----------------|----------------|--------|
| Login Form          | #login-form     | ???            | Merger |
| Feed Container      | #feed-container | ???            | Merger |
| ...                 | ...             | ...            | ...    |

### Phase 3: Stratégie d'Intégration

**Approche Recommandée: FUSION PROGRESSIVE**

1. **Garder la structure HTML actuelle**
   - Préserver tous les IDs critiques
   - Préserver tous les data-attributes
   - Ajouter les nouvelles classes CSS Figma

2. **Remplacer les styles CSS**
   - Désactiver les anciens CSS (commentaires)
   - Intégrer les nouveaux CSS Figma
   - Ajuster les classes si nécessaire

3. **Intégrer les nouveaux assets**
   - Copier images/fonts du design Figma
   - Mettre à jour les chemins

4. **Tester chaque vue**
   - Login/Signup → Feed → TOP → Recherche → Profil
   - Vérifier chaque fonctionnalité backend

### Phase 4: Tests Critiques

**Checklist Backend:**
- [ ] Connexion/Inscription fonctionne
- [ ] Feed charge les posts
- [ ] Like/Unlike fonctionne
- [ ] Commentaires fonctionnent
- [ ] Follow/Unfollow fonctionne
- [ ] Recherche tracks fonctionne
- [ ] Top 100 charge
- [ ] Profil affiche correctement
- [ ] Notifications fonctionnent
- [ ] Reshake fonctionne

**Checklist Frontend:**
- [ ] Design s'affiche correctement
- [ ] Navigation fonctionne
- [ ] Modals s'ouvrent/ferment
- [ ] Responsive mobile OK
- [ ] Pas d'erreurs console
- [ ] Images chargent
- [ ] Animations fonctionnent

---

## ⚠️ POINTS D'ATTENTION CRITIQUES

### NE JAMAIS SUPPRIMER
1. ✅ `scripts/config.js` (credentials Supabase)
2. ✅ `scripts/database.js` (toutes les fonctions CRUD)
3. ✅ `scripts/auth.js` (authentification)
4. ✅ `scripts/spotify.js` (API Spotify)
5. ✅ `scripts/app.js` (orchestrateur principal)
6. ✅ CDN Supabase dans les HTML
7. ✅ Ordre de chargement des scripts
8. ✅ Fichiers SQL (supabase-*.sql)
9. ✅ CNAME (domaine custom)

### NE JAMAIS MODIFIER
1. ✅ Les IDs des éléments DOM utilisés par JS
2. ✅ Les data-attributes utilisés pour la navigation
3. ✅ La structure des modals (modifier classes OK, structure NON)
4. ✅ L'ordre des scripts dans app.html

### TOUJOURS VÉRIFIER
1. ✅ Console browser pour erreurs JS
2. ✅ Network tab pour erreurs API
3. ✅ Supabase logs pour erreurs backend
4. ✅ Chemins relatifs (pas d'absolus hardcodés)

---

## 🎯 PROCHAINES ÉTAPES

### Étape 1: Attendre Accès Redesign
- Kenny doit fournir accès au repo Redesign SHAKEMOI
- OU copier les fichiers HTML/CSS/assets dans un dossier du repo actuel

### Étape 2: Analyse Redesign
- Scanner les fichiers HTML/CSS Figma
- Créer le mapping des éléments
- Identifier les conflits potentiels

### Étape 3: Créer Branche de Travail
```bash
git checkout -b integration-figma-v3
```

### Étape 4: Backup V1
```bash
mkdir backup-v1
cp -r * backup-v1/
git add backup-v1/
git commit -m "🔒 Backup V1 avant intégration Figma"
```

### Étape 5: Intégration Progressive
- Fusionner HTML (garder IDs, ajouter classes)
- Remplacer CSS
- Tester après chaque modification

### Étape 6: Tests Complets
- Tests backend
- Tests frontend
- Tests intégration

### Étape 7: Déploiement
- Test en local
- Push vers branche
- Merge vers main après validation

---

## 📞 QUESTIONS POUR KENNY

1. **Accès Redesign:**
   - Comment puis-je accéder aux fichiers du redesign Figma ?
   - Repo GitHub privé ? Dossier ZIP ? Autre ?

2. **Scope du Redesign:**
   - Tous les écrans ont été redesignés ? (Login, Feed, TOP, Recherche, Profil)
   - Ou seulement certaines vues ?

3. **Assets:**
   - Y a-t-il de nouvelles images/fonts à intégrer ?
   - Emoji/Icons custom ?

4. **Contraintes:**
   - Y a-t-il des éléments du design actuel à absolument garder ?
   - Deadline pour l'intégration ?

---

## 📊 RÉSUMÉ STATISTIQUES

### Fichiers Backend à Conserver
- **Scripts JS Backend:** 10 fichiers (142KB total)
- **Fichiers SQL:** 8 fichiers (schemas, migrations)
- **Config:** 2 fichiers (config.js, CNAME)

### Fichiers Frontend à Remplacer
- **HTML:** 2 fichiers (index.html, app.html)
- **CSS:** ~25 fichiers (196KB total)
- **Assets:** favicon.svg, + assets futurs du redesign

### Fonctions Backend Critiques
- **Authentification:** 3 fonctions
- **Database:** ~30 fonctions (CRUD complet)
- **Spotify API:** 8 méthodes
- **Notifications:** ~5 fonctions
- **Total:** ~50 fonctions backend à ne pas casser

---

## ✅ VALIDATION

**Cette analyse est complète pour le repo SHAKEMOI actuel.**

**Prochaine étape:** Attendre accès au repo Redesign pour compléter l'analyse.

**Status:** ⏸️ EN ATTENTE DE VALIDATION KENNY

---

*Document créé le 13 janvier 2026 par Claude Code*
*Dernière mise à jour: 13 janvier 2026*
