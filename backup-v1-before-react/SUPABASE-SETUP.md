# 🎵 SHAKEMOI - Configuration Supabase

## Instructions pour appliquer les mises à jour

### Étape 1: Accéder au SQL Editor de Supabase

1. Va sur [https://app.supabase.com](https://app.supabase.com)
2. Sélectionne ton projet SHAKEMOI
3. Clique sur "SQL Editor" dans le menu de gauche

### Étape 2: Exécuter le script SQL

1. Ouvre le fichier `supabase-updates.sql`
2. Copie tout le contenu
3. Colle-le dans le SQL Editor de Supabase
4. Clique sur "Run" (ou Ctrl+Enter)

### Étape 3: Vérifier que tout fonctionne

Tu devrais voir ce message de succès:
```
✅ SHAKEMOI updates applied successfully!
📝 New tables: artists, notifications
🔔 Notification triggers: feel, like, comment, reshake
🎵 Ready to rock!
```

### Ce qui a été ajouté:

#### 📊 Nouvelle table `artists`
- Stocke les informations des artistes depuis Spotify
- Colonnes: id, name, image_url, genres, popularity, followers

#### 🔔 Nouvelle table `notifications`
- Stocke toutes les notifications des utilisateurs
- Types: feel, like, comment, reshake
- Avec champ `is_read` pour marquer comme lu

#### ⚡ 4 Triggers automatiques
1. **Feel notification**: Quand quelqu'un te feel
2. **Like notification**: Quand quelqu'un like ton post
3. **Comment notification**: Quand quelqu'un commente ton post
4. **Reshake notification**: Quand quelqu'un re-shake ton post

### Dépannage

Si tu vois des erreurs comme "table already exists":
- C'est normal si tu as déjà exécuté ce script
- Les `CREATE TABLE IF NOT EXISTS` vont juste ignorer les tables existantes
- Les `DROP TRIGGER IF EXISTS` vont remplacer les anciens triggers

Si tu vois des erreurs de permissions:
- Assure-toi d'être connecté avec le bon projet Supabase
- Vérifie que tu as les droits administrateur sur le projet

## ✅ Checklist finale

Après avoir exécuté le script SQL, vérifie que:

- [ ] Table `artists` créée
- [ ] Table `notifications` créée
- [ ] 4 triggers créés (feel, like, comment, reshake)
- [ ] RLS (Row Level Security) activé sur les deux tables
- [ ] Pas d'erreurs dans le SQL Editor

## 🚀 Prêt à tester!

Une fois le script exécuté:
1. Rafraîchis le site shakemoi.fr
2. Connecte-toi
3. Tu devrais voir le nouveau logo "SHAKEmoi"
4. Le bouton notifications devrait apparaître dans le header
5. L'onglet TOP devrait charger le Top 100 France de Spotify
6. La recherche devrait utiliser Spotify

Enjoy! 🎵
