# 🚀 SHAKEMOI V3 - GUIDE DE DÉPLOIEMENT COMPLET

## 📋 Résumé des changements

### ✅ Fichiers créés

1. **`supabase-v3-complete.sql`** - Script SQL complet avec toutes les nouvelles tables
2. **`supabase/functions/calculate-compatibility/index.ts`** - Edge Function pour calculer la compatibilité musicale
3. **`styles/v3-features.css`** - Design system V3 avec animations
4. **`scripts/v3-features.js`** - Scripts JavaScript pour les nouvelles fonctionnalités

### ✅ Fichiers modifiés

1. **`app.html`** - Ajout des nouveaux fichiers CSS et JS
2. **`styles/app.css`** - Déjà existant (modifications mineures possibles)

---

## 🗄️ ÉTAPE 1 : Base de données

### 1.1 Exécuter le script SQL V3

Connecte-toi à ton dashboard Supabase et exécute le script :

```bash
# Ouvre le fichier dans l'éditeur SQL de Supabase
cat supabase-v3-complete.sql
```

**Nouvelles tables créées :**
- `time_capsules` - Capsules temporelles musicales
- `time_capsule_tracks` - Morceaux dans les capsules
- `time_capsule_participants` - Participants aux capsules de groupe
- `shake_moments` - Partages authentiques quotidiens
- `user_music_taste` - Goûts musicaux des utilisateurs
- `user_compatibility_cache` - Cache des scores de compatibilité

**Colonnes ajoutées :**
- `comments.timestamp_seconds` - Pour les timed comments
- `comments.is_timed` - Flag pour les commentaires temporels
- `posts.mood_emoji` - Mood lors du post (déjà dans v3-upgrade.sql)
- `users_profile.current_streak` - Streak actuel (déjà dans v3-upgrade.sql)
- `users_profile.longest_streak` - Record de streak (déjà dans v3-upgrade.sql)
- `users_profile.streak_shields` - Shields de protection (déjà dans v3-upgrade.sql)

### 1.2 Vérifier que tout fonctionne

```sql
-- Vérifier que toutes les tables existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'time_capsules',
  'shake_moments',
  'user_music_taste',
  'user_compatibility_cache'
);

-- Devrait retourner 4 lignes
```

---

## ☁️ ÉTAPE 2 : Edge Functions

### 2.1 Déployer la fonction de compatibilité

```bash
# Se connecter à Supabase
supabase login

# Lier le projet
supabase link --project-ref vbjmhtwrfboqziwibsut

# Déployer la nouvelle fonction
supabase functions deploy calculate-compatibility

# Vérifier le déploiement
supabase functions list
```

### 2.2 Configurer les secrets (si ce n'est pas déjà fait)

```bash
# Secret Spotify
supabase secrets set SPOTIFY_CLIENT_SECRET=<ton_spotify_client_secret>

# Les autres secrets devraient déjà être configurés
supabase secrets list
```

### 2.3 Tester la fonction

```bash
curl -X POST https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/calculate-compatibility \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_a":"<user_id_1>","user_b":"<user_id_2>"}'
```

**Réponse attendue :**
```json
{
  "score": 75,
  "common_artists_count": 12,
  "common_genres_count": 5,
  "message": "🔥 Excellent match!"
}
```

---

## 🎨 ÉTAPE 3 : Frontend

### 3.1 Vérifier que les fichiers sont bien liés

Ouvre `app.html` et vérifie que tu as :

```html
<link rel="stylesheet" href="styles/app.css">
<link rel="stylesheet" href="styles/enhancements.css">
<link rel="stylesheet" href="styles/v3-features.css"> <!-- ✅ Nouveau -->

<script src="scripts/config.js"></script>
<script src="scripts/database.js"></script>
<script src="scripts/spotify.js"></script>
<script src="scripts/lastfm.js"></script>
<script src="scripts/notifications.js"></script>
<script src="scripts/v3-features.js"></script> <!-- ✅ Nouveau -->
<script src="scripts/app.js"></script>
```

### 3.2 Tester les animations du lecteur Spotify

Les animations sont maintenant automatiques sur les éléments avec la classe `.track-cover` :
- **Rotation vinyle** quand la classe `.playing` est ajoutée
- **Glow pulsant** pendant la lecture
- **Play overlay** au survol

Pour activer :
```javascript
// Dans app.js, remplacer playPreview par playPreviewV3
function playPreview(previewUrl, element) {
  playPreviewV3(previewUrl, element);
}
```

---

## 🎯 ÉTAPE 4 : Intégration des fonctionnalités

### 4.1 Compatibilité musicale sur les profils

Ajoute ce code dans `app.js` dans la fonction `openUserProfile` :

```javascript
async function openUserProfile(userId) {
  // ... code existant ...

  // Après avoir affiché les stats
  if (userId !== currentUser.id) {
    // Calculer et afficher la compatibilité
    const compat = await musicCompatibility.calculateCompatibility(currentUser.id, userId);
    if (compat) {
      const compatHtml = musicCompatibility.renderCompatibilityCard(
        compat.score,
        compat.common_artists_count,
        compat.common_genres_count,
        compat.message
      );
      // Insérer après les stats
      document.querySelector('.profile-header').insertAdjacentHTML('afterend', compatHtml);
    }
  }
}
```

### 4.2 Streak Badge sur le profil

Ajoute dans la fonction `loadProfile` :

```javascript
async function loadProfile() {
  // ... code existant ...

  // Afficher le streak
  const streakData = await streakManager.getCurrentStreak();
  const streakHtml = streakManager.renderStreakBadge(
    streakData.current_streak,
    streakData.longest_streak,
    streakData.streak_shields
  );

  // Insérer après le header du profil
  document.querySelector('.profile-header').insertAdjacentHTML('afterend', streakHtml);
}
```

### 4.3 ShakeMoments dans le feed

Modifie `loadFeed` pour inclure les ShakeMoments :

```javascript
async function loadFeed() {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

  try {
    // Charger les ShakeMoments du jour en premier
    const shakeMoments = await shakeMoments.getTodayShakeMoments();

    // Puis charger le feed normal
    const posts = await getFeed();

    // Combiner et afficher
    const shakeMomentsHtml = shakeMoments.map(sm => shakeMoments.renderShakeMoment(sm)).join('');
    const postsHtml = posts.map(post => renderPost(post)).join('');

    container.innerHTML = `
      ${shakeMomentsHtml ? `
        <div class="shake-moments-section">
          <h3 style="padding: 16px; color: var(--rose);">🎲 ShakeMoments du jour</h3>
          ${shakeMomentsHtml}
        </div>
      ` : ''}
      <div class="regular-feed">
        ${postsHtml}
      </div>
    `;

    attachPostListeners();
  } catch (error) {
    console.error('Error loading feed:', error);
    container.innerHTML = '<div class="empty-state"><p>Erreur de chargement</p></div>';
  }
}
```

### 4.4 Mood Selector lors de la création de post

Modifie la modal de création de post pour inclure le mood selector :

```javascript
function openShakeModal(track) {
  const modal = document.getElementById('shake-modal');
  const trackInfo = document.getElementById('shake-track-info');

  trackInfo.innerHTML = `
    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
      <img src="${track.cover}" style="width: 60px; height: 60px; border-radius: 8px;">
      <div>
        <div style="font-weight: 600;">${track.name}</div>
        <div style="color: var(--text-secondary); font-size: 0.875rem;">${track.artist}</div>
      </div>
    </div>

    ${renderMoodSelector((emoji, label) => {
      // Stocker le mood sélectionné
      window.selectedMood = emoji;
    })}
  `;

  document.getElementById('shake-text').value = '';
  modal.classList.add('active');
}

// Puis dans submitShake, ajouter le mood
async function submitShake() {
  if (!selectedTrackForShake) return;

  const text = document.getElementById('shake-text').value.trim();
  const mood = window.selectedMood || null;

  // ... reste du code avec mood_emoji: mood
}
```

### 4.5 Time Capsules - Nouvelle section

Ajoute un nouvel onglet dans la navigation pour les Time Capsules, ou ajoute-les dans le profil.

Exemple simple dans le profil :

```javascript
async function loadProfile() {
  // ... code existant ...

  // Charger les capsules
  const capsules = await timeCapsules.getMyCapsules();
  const capsulesHtml = capsules.map(c =>
    timeCapsules.renderLockedCapsule(c, c.tracks[0]?.count || 0)
  ).join('');

  // Ajouter une section après les posts
  document.getElementById('profile-content').insertAdjacentHTML('beforeend', `
    <div class="time-capsules-section">
      <h3 style="padding: 16px;">📦 Mes Time Capsules</h3>
      ${capsulesHtml || '<p style="text-align: center; color: var(--text-secondary);">Aucune capsule</p>'}
    </div>
  `);
}
```

---

## 🧪 ÉTAPE 5 : Tests

### Test Checklist

- [ ] **Base de données**
  - [ ] Toutes les tables sont créées
  - [ ] Les triggers fonctionnent (streak, feelings count, mood logging)
  - [ ] Les RLS policies permettent les opérations

- [ ] **Edge Functions**
  - [ ] calculate-compatibility retourne un score
  - [ ] spotify-proxy fonctionne toujours

- [ ] **Frontend - Lecteur Spotify**
  - [ ] La pochette tourne pendant la lecture
  - [ ] Le glow pulse autour de la pochette
  - [ ] Un seul son joue à la fois

- [ ] **Streaks**
  - [ ] Le badge streak s'affiche sur le profil
  - [ ] Le compteur augmente après un post
  - [ ] Les shields sont gagnés aux milestones (7, 30, 100 jours)

- [ ] **Compatibilité musicale**
  - [ ] Le cercle de compatibilité s'affiche sur les profils visitésle
  - [ ] Le score est calculé correctement
  - [ ] Le message contextuel correspond au score

- [ ] **ShakeMoments**
  - [ ] Un utilisateur peut créer un ShakeMoment par jour
  - [ ] Les ShakeMoments apparaissent en haut du feed
  - [ ] Le badge "authentique" ou "late" s'affiche correctement

- [ ] **Time Capsules**
  - [ ] Une capsule peut être créée avec une date future
  - [ ] Les tracks peuvent être ajoutés à une capsule
  - [ ] Les capsules verrouillées affichent le countdown
  - [ ] Les capsules peuvent être ouvertes après la date

- [ ] **Mood Tracking**
  - [ ] Le mood selector s'affiche lors de la création de post
  - [ ] Le mood est sauvegardé dans `mood_history`
  - [ ] Le badge mood s'affiche sur les posts

---

## 🚀 ÉTAPE 6 : Déploiement final

### 6.1 Commit et push

```bash
git add .
git commit -m "🎵 SHAKEMOI V3 - Toutes les fonctionnalités innovantes intégrées"
git push origin main
```

### 6.2 Vérifier sur shakemoi.fr

Attends 2-3 minutes que IONOS déploie les changements, puis vérifie :
- https://shakemoi.fr

### 6.3 Monitorer les erreurs

Ouvre la console du navigateur et vérifie qu'il n'y a pas d'erreurs JavaScript.

Vérifie aussi les logs Supabase :
- Dashboard > Edge Functions > calculate-compatibility > Logs

---

## 📊 Fonctionnalités disponibles après déploiement

### ✅ Core Features (déjà implémentées)
- [x] Système de posts musicaux
- [x] Likes (shakes)
- [x] Commentaires
- [x] Re-shakes
- [x] Follows (feels)
- [x] Profils utilisateurs
- [x] Recherche (tracks + users)
- [x] Top 100
- [x] Notifications
- [x] Lecteur Spotify preview 30s

### 🆕 Nouvelles features V3
- [x] **Lecteur Spotify amélioré** - Animations vinyle + glow
- [x] **Streaks** - Système de jours consécutifs avec shields
- [x] **Compatibilité musicale** - Score entre users
- [x] **ShakeMoments** - Partages authentiques quotidiens
- [x] **Time Capsules** - Playlists du futur
- [x] **Mood Tracking** - Tracker son humeur musicale
- [x] **Timed Comments** - Commentaires à des moments précis des morceaux

### 🔜 À implémenter (Quick Wins)
- [ ] Interface de création de Time Capsules
- [ ] Notification push pour les ShakeMoments aléatoires
- [ ] Modal pour voir les artistes en commun
- [ ] Stats de moods sur le profil
- [ ] Animation d'ouverture de capsule avec confettis
- [ ] Timed comments UI avec markers sur la timeline

---

## 🐛 Troubleshooting

### Erreur : "Table does not exist"
→ Assure-toi d'avoir exécuté le script SQL `supabase-v3-complete.sql` dans Supabase

### Erreur : "Function calculate_compatibility does not exist"
→ Exécute le script SQL, la fonction est créée dedans

### Edge Function ne répond pas
→ Vérifie que tu as déployé avec `supabase functions deploy calculate-compatibility`

### CSS ne s'applique pas
→ Vide le cache du navigateur (Cmd+Shift+R / Ctrl+Shift+R)

### Animations ne fonctionnent pas
→ Vérifie que `v3-features.css` est bien chargé dans le HTML

---

## 💡 Prochaines étapes suggérées

1. **Créer l'UI de création de Time Capsules**
   - Modal avec formulaire
   - Sélecteur de durée (7j, 1 mois, 1 an)
   - Ajout de tracks avec notes personnelles

2. **Système de notifications ShakeMoments**
   - Utiliser Web Push API
   - Notification aléatoire quotidienne entre 11h et 22h
   - Timer de 5 minutes pour marquer "late"

3. **Améliorer les Timed Comments**
   - Waveform visuelle du son
   - Markers cliquables
   - Affichage des comments pendant la lecture

4. **Dashboard de statistiques**
   - Graphiques des moods au fil du temps
   - Évolution du streak
   - Top artistes/genres

5. **Social features**
   - Notifications de compatibilité ("X% compatible avec @user !")
   - Suggestions d'amis selon la compatibilité
   - Capsules de groupe collaboratives

---

## 📝 Notes importantes

- **RLS Policies** : Toutes les tables ont des policies configurées pour la sécurité
- **Performance** : Les index sont créés sur toutes les colonnes fréquemment requêtées
- **Cache** : Le score de compatibilité est caché pour éviter les recalculs
- **Contraintes** : 1 ShakeMoment par jour, 3 shields max, etc.

---

## 🎉 Félicitations !

Tu as maintenant **SHAKEMOI V3** avec toutes les fonctionnalités innovantes de 2025 !

**L'app qu'on ouvre AVANT Spotify 🚀🎵**
