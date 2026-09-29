# 🗄️ Migrations SHAKEMOI

## Migration requise : Personnalisation Profil

**Fichier:** `add_profile_customization.sql`
**Date:** 2025-12-17

### Instructions d'exécution

1. Aller dans **Supabase Dashboard** → Votre projet SHAKEMOI
2. Aller dans **SQL Editor**
3. Copier/coller le contenu de `add_profile_customization.sql`
4. Cliquer sur **RUN** pour exécuter

### Colonnes ajoutées à `profiles`

- `profile_album_cover_url` (TEXT) - URL pochette album
- `profile_album_id` (TEXT) - ID Spotify album
- `profile_album_name` (TEXT) - Nom album/single
- `profile_album_artist` (TEXT) - Artiste
- `profile_color` (TEXT) - Couleur pastel choisie (défaut: #F5D5E8)

### Politiques RLS ajoutées

- ✅ Les users peuvent modifier leur propre profil
- ✅ Tout le monde peut voir les profils

### Fonctionnalités activées

Une fois la migration exécutée, les utilisateurs pourront :

- Choisir une pochette d'album Spotify comme photo de profil
- Sélectionner une couleur pastel parmi 6 options
- Personnaliser leur profil avec bordure colorée
- Voir la couleur comme accent dans le profil

---

**Note:** Cette migration est essentielle pour que la fonctionnalité de personnalisation du profil fonctionne correctement.
