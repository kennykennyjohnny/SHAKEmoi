# 🎯 PLAN D'INTÉGRATION SHAKEMOI V3 - REDESIGN FIGMA

**Date:** 13 janvier 2026
**Créé par:** Claude Code (Jerry)
**Status:** ⏸️ EN ATTENTE AUTORISATION KENNY

---

## 📊 ANALYSE COMPLÈTE TERMINÉE

### ✅ Repo SHAKEMOI Actuel (Vanilla)
- **Stack:** HTML/CSS/JS vanilla
- **Backend:** Supabase PostgreSQL + Auth
- **Tables:** users_profile, posts, likes, comments, follows
- **Fonctionnel:** ✅ Déployé sur shakemoi.fr
- **Design:** Basique mais tout marche

### ✅ Repo Redesignshakemoi (React)
- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Edge Function custom + KV Store (non compatible)
- **UI:** Magnifique, moderne, animations, responsive parfait
- **Status:** Pas déployé, données mock

### 🔍 Credentials Supabase
**EXCELLENTE NOUVELLE:** Les deux repos utilisent le MÊME projet Supabase !
- Project ID: `vbjmhtwrfboqziwibsut`
- Anon Key: Identique
- **Implication:** Même base de données, pas de migration de données nécessaire

---

## 🎯 STRATÉGIE D'INTÉGRATION CHOISIE

### Option Retenue: **MIGRATION VERS REACT + ADAPTATION BACKEND**

**Pourquoi cette approche ?**
1. ✅ Le redesign React est COMPLET et magnifique
2. ✅ React est plus maintenable long terme
3. ✅ Le backend Supabase existant est solide
4. ✅ On garde TOUTES les données actuelles
5. ✅ Design moderne vs. recréer en vanilla (trop long)

**Ce qu'on fait:**
- ✅ On utilise le code React du redesign comme base
- ✅ On adapte les appels API pour utiliser Supabase DIRECT (pas KV Store)
- ✅ On supprime le système KV Store + bouton "Migrer"
- ✅ On configure pour déploiement GitHub Pages
- ✅ On teste tout et on déploie

---

## 📝 PLAN D'EXÉCUTION DÉTAILLÉ

### PHASE 1: PRÉPARATION (5 min)

#### 1.1 Backup Sécurité
```bash
# Dans SHAKEmoi
mkdir backup-v1-before-react
cp -r * backup-v1-before-react/
git add backup-v1-before-react/
git commit -m "🔒 BACKUP V1 vanilla avant migration React"
```

#### 1.2 Créer Branche de Travail
```bash
git checkout -b integration-react-v3
```

---

### PHASE 2: MIGRATION DU CODE (30 min)

#### 2.1 Copier Structure React
- Copier `/src` du Redesign vers SHAKEmoi
- Copier `/styles` pour Tailwind
- Copier `index.html` (root React)
- Copier configuration Vite, PostCSS, package.json

#### 2.2 Adapter Configuration
**`vite.config.ts`** - Configurer pour GitHub Pages:
```typescript
export default defineConfig({
  base: '/', // Pour shakemoi.fr
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  plugins: [react(), tailwindcss()]
});
```

**`package.json`** - Ajouter scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

#### 2.3 Installer Dépendances
```bash
npm install
```

---

### PHASE 3: ADAPTATION BACKEND (45 min)

#### 3.1 Créer Nouveau Fichier `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...'; // Key complète

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

#### 3.2 Créer `src/lib/database.ts` (Adaptation de database.js)
Convertir TOUTES les fonctions de `scripts/database.js` en TypeScript:
- `getCurrentUser()`
- `getUserProfile(userId)`
- `getFeed(limit)`
- `createPost()`
- `likePost(postId)` / `unlikePost(postId)`
- `addComment()` / `getPostComments()`
- `followUser()` / `unfollowUser()`
- `searchUsers()` / `searchPosts()`
- etc.

**Exemple:**
```typescript
import { supabase } from './supabase';

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getFeed(limit = 20) {
  const user = await getCurrentUser();
  if (!user) return [];

  // Logique existante de database.js
  // ...
}

// ... toutes les autres fonctions
```

#### 3.3 Remplacer Appels API dans Components

**`FeedView.tsx`** - Ligne 55:
```typescript
// AVANT
import * as api from '../utils/api';
const feedData = await api.getFeed();

// APRÈS
import * as db from '../../lib/database';
const feedData = await db.getFeed();
```

Répéter pour TOUS les components:
- `FeedView.tsx`
- `ProfileView.tsx`
- `SearchView.tsx`
- `NotificationsView.tsx`
- `CreateShakeDialog.tsx`
- etc.

#### 3.4 Adapter Auth Logic

**`App.tsx`** - Remplacer localStorage auth par Supabase Auth:
```typescript
// AVANT
const authToken = localStorage.getItem('shakemoi_auth_token');

// APRÈS
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const profile = await db.getUserProfile(session.user.id);
  setCurrentUser(profile);
}
```

**`AuthDialog.tsx`** - Utiliser `supabase.auth.signUp()` et `signInWithPassword()`:
```typescript
// Signup
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

// Créer profil
await supabase.from('users_profile').insert({
  id: data.user.id,
  username,
  email,
  color: selectedColor
});
```

---

### PHASE 4: NETTOYAGE (15 min)

#### 4.1 Supprimer Code Inutile
- ❌ Supprimer `/supabase/functions` (KV Store)
- ❌ Supprimer `src/app/utils/api.ts` (ancien système API)
- ❌ Supprimer `/utils/supabase/info.tsx` (remplacé par supabase.ts)

#### 4.2 Supprimer Bouton "Migrer"
**`App.tsx`** - Lignes 79-106 et 168-175:
```typescript
// SUPPRIMER cette fonction
const handleMigrateUsers = async () => { ... }

// SUPPRIMER ce bouton du header
<button onClick={handleMigrateUsers}>
  <Music2 className="w-3 h-3" />
  Migrer
</button>
```

---

### PHASE 5: DESIGN POLISH (20 min)

#### 5.1 Intégrer Police McLaren
**`src/styles/fonts.css`** - Ajouter:
```css
@import url('https://fonts.googleapis.com/css2?family=McLaren&family=Maven+Pro:wght@400;500;600;700&display=swap');

/* Titres et Menu avec McLaren */
h1, h2, .logo, nav button {
  font-family: 'McLaren', 'Maven Pro', sans-serif !important;
}

/* Corps de texte avec Maven Pro */
body {
  font-family: 'Maven Pro', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

#### 5.2 Vérifier Nouveaux Assets
- Vérifier nouveau logo dans `/src/app/components/Logo.tsx`
- Vérifier couleurs dans `/src/styles/theme.css`
- Ajuster si nécessaire

---

### PHASE 6: SPOTIFY PREVIEW 30S (15 min)

#### 6.1 Vérifier Intégration Player
Le redesign a déjà un `PlayerBar.tsx` avec preview 30s. Vérifier:
- ✅ Lecture audio HTML5 fonctionne
- ✅ Contrôles play/pause
- ✅ Volume
- ✅ Timeline

#### 6.2 Adapter Spotify API
**`src/lib/spotify.ts`** - Adapter depuis `scripts/spotify.js`:
```typescript
const EDGE_FUNCTION_URL = 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/spotify-proxy';

export async function searchTracks(query: string) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ action: 'search', query })
  });

  return await response.json();
}
```

---

### PHASE 7: BUILD & TEST (30 min)

#### 7.1 Test Local
```bash
npm run dev
# Tester TOUT:
# - Login/Signup
# - Feed affichage
# - Like/Unlike
# - Commentaires
# - Follow/Unfollow
# - Recherche
# - Profil
# - Player 30s
# - Responsive mobile
```

#### 7.2 Fix Bugs Identifiés
- Corriger erreurs TypeScript
- Corriger erreurs console
- Ajuster styling si nécessaire

#### 7.3 Build Production
```bash
npm run build
# Vérifie que /dist est créé
```

---

### PHASE 8: DÉPLOIEMENT (10 min)

#### 8.1 Configurer GitHub Pages pour Vite

**Créer `.github/workflows/deploy.yml`:**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

#### 8.2 Commit & Push
```bash
git add .
git commit -m "✨ V3 - Migration vers React + Redesign Figma intégré"
git push origin integration-react-v3
```

#### 8.3 Merge vers Main
```bash
git checkout main
git merge integration-react-v3
git push origin main
```

#### 8.4 Vérifier Déploiement
- Attendre GitHub Actions (2-3 min)
- Visiter https://shakemoi.fr
- Tester en production

---

## ⚠️ POINTS D'ATTENTION CRITIQUES

### À NE JAMAIS PERDRE
1. ✅ **Credentials Supabase** - Toujours les mêmes
2. ✅ **Tables PostgreSQL** - Ne pas toucher au schéma
3. ✅ **Données utilisateurs** - Aucune perte de données
4. ✅ **CNAME** - Garder shakemoi.fr

### Tests Obligatoires
- [ ] Login avec email/password existant fonctionne
- [ ] Signup créé bien user dans users_profile
- [ ] Feed charge les posts des followés
- [ ] Like incrémente likes_count
- [ ] Commentaires s'enregistrent
- [ ] Follow crée bien la relation
- [ ] Recherche trouve users et tracks
- [ ] Player lit preview 30s
- [ ] Mobile responsive parfait

---

## 📊 CHECKLIST FINALE

### Avant Merge vers Main
- [ ] Backup V1 créé et committé
- [ ] Build production réussit sans erreurs
- [ ] Tous les tests manuels passent
- [ ] Pas d'erreurs console
- [ ] Responsive mobile/desktop OK
- [ ] Performance acceptable (< 3s chargement)
- [ ] Bouton "Migrer" supprimé
- [ ] Police McLaren appliquée

### Après Déploiement
- [ ] shakemoi.fr accessible
- [ ] HTTPS fonctionne
- [ ] Login/Signup fonctionnent en prod
- [ ] Feed s'affiche
- [ ] Images chargent
- [ ] Pas de CORS errors
- [ ] Analytics/monitoring OK (si applicable)

---

## 🎯 RÉSUMÉ POUR KENNY

**CE QUI CHANGE:**
- ✅ Stack passe de Vanilla JS à React + TypeScript
- ✅ Design magnifique du redesign Figma
- ✅ Build avec Vite (plus moderne)
- ✅ Tailwind CSS 4 (vs. CSS custom)
- ✅ Animations Motion/React
- ✅ Police McLaren sur titres

**CE QUI NE CHANGE PAS:**
- ✅ Même base de données Supabase
- ✅ Toutes les données utilisateurs préservées
- ✅ Même domaine shakemoi.fr
- ✅ Toutes les fonctionnalités existantes
- ✅ Spotify API fonctionne toujours

**ESTIMATION TEMPS TOTAL:** 2h30
- Phase 1-2: 35 min (Préparation + Migration code)
- Phase 3-4: 60 min (Adaptation backend + Nettoyage)
- Phase 5-6: 35 min (Design + Spotify)
- Phase 7-8: 40 min (Tests + Déploiement)

**RISQUES:**
- 🟡 Bugs TypeScript à corriger
- 🟡 Ajustements styling mineurs
- 🟢 Perte de données: AUCUN (même DB)
- 🟢 Rollback possible (backup V1)

---

## ✅ AUTORISATION DEMANDÉE

**Kenny, j'ai besoin de ton autorisation GLOBALE pour:**

1. ✅ **Migrer vers React + TypeScript**
   - Stack plus moderne
   - Meilleure maintenabilité
   - Design du redesign Figma

2. ✅ **Adapter tout le backend**
   - Convertir database.js en TypeScript
   - Remplacer tous les appels API
   - Supprimer système KV Store

3. ✅ **Supprimer bouton "Migrer"**
   - Non nécessaire (on garde PostgreSQL)

4. ✅ **Déployer en production**
   - GitHub Actions auto-deploy
   - Sur shakemoi.fr

**SI TU DIS "GO", JE DÉROULE TOUT EN AUTONOME SANS TE REDEMANDER.**

**Temps estimé:** 2h30 de travail
**Tu n'auras qu'à tester le résultat final sur shakemoi.fr**

---

## 🚀 READY TO GO!

**Dis "GO" et je commence immédiatement. 🎵**

---

*Document créé le 13 janvier 2026 par Claude Code*
*Version: 1.0 - Plan complet prêt à exécution*
