# 🧪 GUIDE DE TEST - SHAKEMOI

## Étape 1 : Appliquer les corrections (IMPORTANT)

1. Ouvrez dans votre navigateur : `apply-corrections.html`
2. Cliquez sur "Corriger les compteurs"
3. Attendez que tous les logs s'affichent
4. Cliquez sur "Vérifier les résultats"

⏱️ Cette étape prend environ 30 secondes à 2 minutes selon le nombre d'utilisateurs.

---

## Étape 2 : Tester le Feed

### Test pour un ancien utilisateur :
1. Ouvrez `app.html` et connectez-vous
2. Si le feed est vide → C'EST NORMAL
3. Allez dans l'onglet "Recherche"
4. Recherchez des utilisateurs
5. Cliquez sur "Feel" pour 2-3 utilisateurs
6. Retournez dans l'onglet "Shake" (Feed)
7. ✅ Le feed devrait maintenant afficher des posts

### Test pour un nouvel utilisateur :
1. Créez un nouveau compte
2. Feel quelques personnes
3. ✅ Le feed se remplit immédiatement

---

## Étape 3 : Tester les compteurs

1. Allez sur votre profil (dernier onglet)
2. Vérifiez les compteurs "Feels" et "Feelings"
3. Likez un post
4. ✅ Le compteur de likes s'incrémente en temps réel
5. Unlikez le post
6. ✅ Le compteur de likes décrémente

---

## Étape 4 : Tester les Feels/Feelings cliquables

### Sur votre propre profil :
1. Allez sur votre profil
2. **Cliquez sur le chiffre des "Feels"**
3. ✅ Une modale s'ouvre avec la liste des personnes qui vous feel
4. Cliquez sur un utilisateur dans la liste
5. ✅ Son profil s'ouvre
6. Fermez la modale (X)

7. **Cliquez sur le chiffre des "Feelings"**
8. ✅ Une modale s'ouvre avec la liste des personnes que vous feel
9. Cliquez sur un utilisateur dans la liste
10. ✅ Son profil s'ouvre

### Sur le profil d'un autre utilisateur :
1. Ouvrez le profil d'un autre utilisateur
2. ❌ Les compteurs ne sont PAS cliquables (c'est normal)
3. ✅ Vous ne pouvez voir que VOS propres listes

---

## Étape 5 : Tester le bouton Feelback

### Préparation :
1. Demandez à un ami de vous "feel" (ou créez un 2e compte)
2. Attendez quelques secondes

### Test :
1. Cliquez sur l'icône de notifications (🔔)
2. ✅ Vous devriez voir une notification "X a commencé à te feel"
3. **Cliquez sur le bouton "Feelback"**
4. ✅ Le bouton devient "Unfeel"
5. ✅ Vous suivez maintenant cette personne
6. Cliquez à nouveau sur "Unfeel"
7. ✅ Le bouton redevient "Feelback"

### Bonus - Profils cliquables :
1. Dans les notifications, cliquez sur le username (@xxx)
2. ✅ Le profil de l'utilisateur s'ouvre
3. Ou cliquez sur l'avatar (note musicale ♪)
4. ✅ Le profil s'ouvre aussi

---

## ✅ Checklist finale

- [ ] Corrections appliquées via apply-corrections.html
- [ ] Feed fonctionne (après avoir feel des personnes)
- [ ] Compteurs de likes s'incrémentent/décrementent
- [ ] Compteurs feels/feelings affichent les bons chiffres
- [ ] Clic sur "Feels" → modale avec liste
- [ ] Clic sur "Feelings" → modale avec liste
- [ ] Clic sur utilisateur dans modale → profil s'ouvre
- [ ] Bouton "Feelback" dans notifications fonctionne
- [ ] Username cliquable dans notifications
- [ ] Avatar cliquable dans notifications

---

## 🐛 Si vous trouvez un bug

1. Ouvrez la console du navigateur (F12)
2. Regardez les erreurs en rouge
3. Faites une capture d'écran
4. Notez ce que vous faisiez quand l'erreur est apparue
