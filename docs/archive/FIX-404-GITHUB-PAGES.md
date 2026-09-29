# 🚨 FIX ERREUR 404 - GITHUB PAGES

## 🎯 PROBLÈME

GitHub Pages montre une **erreur 404** parce que la configuration pointe vers le mauvais endroit.

---

## ✅ SOLUTION (3 étapes - 2 minutes)

### ÉTAPE 1 : Va sur GitHub Pages Settings

Ouvre ce lien dans ton navigateur :
```
https://github.com/kennykennyjohnny/SHAKEmoi/settings/pages
```

### ÉTAPE 2 : Change la Source

Tu vas voir une section **"Build and deployment"**

**Option A (RECOMMANDÉE) :**
- Dans "Source", sélectionne : **GitHub Actions**

![Exemple](https://i.imgur.com/example.png)

**OU Option B (si A ne marche pas) :**
- Dans "Source", sélectionne : **Deploy from a branch**
- Branch : Sélectionne **gh-pages** (ou crée-la)
- Folder : **/ (root)**

### ÉTAPE 3 : Sauvegarde

Clique sur **Save** et attends 2-3 minutes.

---

## 🔍 VÉRIFICATION

1. Va sur : https://github.com/kennykennyjohnny/SHAKEmoi/actions
2. Tu devrais voir un workflow "Deploy to GitHub Pages" **en cours** ou **réussi** (vert ✅)
3. Si c'est vert, attends encore 1-2 minutes
4. Va sur **https://shakemoi.fr** et recharge (Cmd+Shift+R / Ctrl+Shift+R)

---

## 🤔 POURQUOI ÇA ARRIVE ?

Notre workflow GitHub Actions (`.github/workflows/deploy.yml`) build l'app React et la déploie.

MAIS GitHub Pages doit être configuré pour **écouter les déploiements GitHub Actions**.

Par défaut, il cherche dans la branche `main`, mais nous on déploie vers `gh-pages` via Actions.

---

## 📞 SI ÇA NE MARCHE TOUJOURS PAS

### Vérification 1 : Le workflow a réussi ?
```
https://github.com/kennykennyjohnny/SHAKEmoi/actions
```
→ Il doit être VERT ✅

### Vérification 2 : La branche gh-pages existe ?
```
https://github.com/kennykennyjohnny/SHAKEmoi/tree/gh-pages
```
→ Elle doit contenir index.html, assets/, CNAME

### Vérification 3 : Le CNAME est bon ?
Dans la branche gh-pages, le fichier CNAME doit contenir :
```
shakemoi.fr
```

---

## 🚀 APRÈS LE FIX

Une fois que c'est réglé, **shakemoi.fr** affichera la nouvelle app React !

Tu pourras alors tester toutes les fonctionnalités :
- Login/Signup
- Feed
- Likes
- Commentaires
- Profil
- Recherche
- Player Spotify

---

## 📝 NOTES

- Le fix du 404.html a été pushé (commit 0c88360)
- Le workflow est configuré et prêt
- Il ne manque QUE la config GitHub Pages

**Tu y es presque ! 🎉**

---

*Guide créé le 13 janvier 2026 à 21:03*
