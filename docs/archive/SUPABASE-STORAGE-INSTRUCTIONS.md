# Configuration Supabase Storage pour les Avatars

## Instructions pour Kenny

### 1. Créer le bucket "avatars"

Va sur https://supabase.com/dashboard/project/vbjmhtwrfboqziwibsut/storage/buckets

1. Clique sur **"New bucket"**
2. Nom du bucket: `avatars`
3. Coche **"Public bucket"** (pour que les avatars soient visibles par tous)
4. Clique sur **"Create bucket"**

### 2. Configurer les politiques (RLS)

Va dans l'onglet **"Policies"** du bucket `avatars` et ajoute ces règles :

**Policy 1 - Lecture publique:**
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

**Policy 2 - Upload pour utilisateurs authentifiés:**
```sql
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);
```

**Policy 3 - Update pour utilisateurs authentifiés:**
```sql
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);
```

### 3. Vérifier la configuration

Une fois fait, teste en uploadant une photo de profil depuis l'app.
L'URL finale sera du type:
`https://vbjmhtwrfboqziwibsut.supabase.co/storage/v1/object/public/avatars/USER_ID-TIMESTAMP.jpg`

## Ce qui a été corrigé dans le code

✅ **EditProfileDialog.tsx** : Upload vers Supabase Storage au lieu de base64
✅ **updateUserProfile()** : Sauvegarde l'URL de l'avatar dans `profile_album_cover_url`
✅ **PlayerBar.tsx** : Utilise maintenant `track.preview_url` de Spotify API
✅ **NotificationsView.tsx** : Charge les vraies notifications depuis la DB

## Problème des previews Spotify

Si les previews ne jouent toujours pas, vérifie que les tracks dans la DB ont bien leur `preview_url` rempli.
Certains tracks Spotify n'ont pas de preview (restrictions de l'artiste/label).
