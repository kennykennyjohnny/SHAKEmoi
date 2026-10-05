# Sauvegardes et restauration de SHAKEmoi

## Pourquoi
Le projet Supabase est en **offre gratuite** : Supabase n'y garde **aucune sauvegarde accessible** (les sauvegardes quotidiennes sont réservées aux offres payantes, et la doc recommande aux projets gratuits de faire leurs propres copies). Si la base est effacée ou le projet supprimé, tout est perdu. D'où une sauvegarde à nous.

## Ce qui est en place
| Quoi | Quand | Où | Garde |
|---|---|---|---|
| La base complète (rôles, structure, données, comptes, tâches planifiées, secrets du coffre comme les clés des notifications) | **chaque nuit** à 02:17 UTC | Backblaze B2, dossier `daily/` | **7 jours** |
| Copie de la nuit du dimanche | chaque **dimanche** | `weekly/` | **8 semaines** |
| Les fichiers (photos de profil, médias des Shakes, des Shakes éphémères, des cercles, captures des signalements) | chaque **dimanche** | `weekly/files-…` | **8 semaines** |

- **Chiffrée** avec [age](https://age-encryption.org) **avant** de quitter la machine de GitHub. Sans la clé, une archive ne sert à rien.
- **Jamais dans le dépôt** (il est public), jamais en « artefact » GitHub, rien dans les journaux à part des totaux (« 64 tables, 7 800 lignes »).
- **Test de restauration à chaque passage** : la tâche retélécharge l'archive qu'elle vient d'envoyer, la déchiffre, la restaure dans une base Supabase vide (lancée sur la machine de GitHub) et compare le nombre de lignes **table par table**. Si ça ne colle pas, la tâche échoue.
- **Alerte** : en cas d'échec, GitHub t'envoie un **e-mail** (« Run failed: Sauvegarde ») et la **page Admin** affiche un bandeau rouge ; elle affiche aussi un bandeau si la dernière sauvegarde réussie date de plus de 36 h.
- Fichiers : `.github/workflows/backup.yml`, `scripts/backup/backup.sh` ; restauration : `.github/workflows/restore.yml`, `scripts/backup/restore.sh`.
- Essai sans aucun secret (base d'exemple) : GitHub → **Actions** → **Sauvegarde** → **Run workflow** → mode **essai**.

## Mise en place (une fois, ~20 minutes, clic par clic)

Tu vas créer **8 secrets** dans GitHub. Ouvre un bloc-notes à côté pour les copier au fur et à mesure (et **efface-le à la fin**).

### 1. Le stockage privé : Backblaze B2 (gratuit jusqu'à 10 Go, sans carte bancaire)
Choisi plutôt que Cloudflare R2 parce que R2 demande une carte bancaire même pour l'offre gratuite. Nos archives font ~5 Mo (base) et ~40 Mo (fichiers) : on reste très loin des 10 Go.
1. Va sur **backblaze.com** → **Sign Up** (en haut à droite) → choisis **B2 Cloud Storage**.
2. E-mail + mot de passe ; **Region** : choisis **EU Central** (données en Europe) → **Create Account**. Valide l'e-mail reçu.
3. Menu de gauche → **Buckets** → **Create a Bucket** :
   - *Bucket Unique Name* : `shakemoi-sauvegardes-` + 6 chiffres au hasard (ex. `shakemoi-sauvegardes-482913`)
   - *Files in Bucket are* : **Private**
   - *Default Encryption* : **Enable**
   - *Object Lock* : **Disable** → **Create a Bucket**.
4. Sur la carte du bucket, note l'**Endpoint** (ex. `s3.eu-central-003.backblazeb2.com`).
5. Toujours sur la carte → **Lifecycle Settings** → **Keep only the last version of the file** → **Update Bucket**.
6. Menu de gauche → **Application Keys** → **Add a New Application Key** :
   - *Name* : `github-sauvegarde`
   - *Allow access to Bucket(s)* : ton bucket (pas « All »)
   - *Type of Access* : **Read and Write** → **Create New Key**.
7. **Copie tout de suite** `keyID` et `applicationKey` (la seconde n'est affichée qu'une fois).

### 2. La clé de chiffrement
Sur ton PC, ouvre **PowerShell** et tape :
```
winget install FiloSottile.age
```
Ferme et rouvre PowerShell, puis :
```
age-keygen
```
Il affiche 3 lignes ; la dernière commence par `AGE-SECRET-KEY-1…`. **C'est la clé.**
- Garde-la **aussi** hors de GitHub : dans ton gestionnaire de mots de passe (ou une note sur papier rangée). **Sans elle, les sauvegardes sont illisibles**, y compris pour toi — si tu perds l'accès à GitHub, c'est elle qui te sauve.

### 3. La chaîne de connexion de la base
1. **supabase.com** → projet **Shakemoi** → bouton **Connect** (en haut).
2. Onglet **Connection String** → *Method* : **Session pooler** (important : la connexion « Direct » ne marche pas depuis GitHub).
3. Copie l'adresse : `postgresql://postgres.vbjmhtwrfboqziwibsut:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`.
4. Remplace `[YOUR-PASSWORD]` (crochets compris) par le mot de passe de la base. Tu ne l'as plus ? **Project Settings** → **Database** → **Reset database password** → **Generate a password** → copie-le → **Reset password**. (Rien dans l'appli n'utilise ce mot de passe : sans risque.) Si le mot de passe contient `@`, `:` ou `/`, regénère-en un.

### 4. Les clés d'accès aux fichiers (Supabase)
1. Supabase → **Project Settings** → **Storage** → section **S3 Connection** → **New access key**.
2. *Description* : `github-sauvegarde` → **Create access key**.
3. Copie **Access key ID** et **Secret access key** (affichée une seule fois).

### 5. Les 8 secrets dans GitHub
**github.com/kennykennyjohnny/SHAKEmoi** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, 8 fois :

| Name | Secret |
|---|---|
| `SUPABASE_DB_URL` | la chaîne de l'étape 3 (avec le mot de passe) |
| `BACKUP_AGE_KEY` | la ligne `AGE-SECRET-KEY-1…` de l'étape 2 |
| `B2_KEY_ID` | `keyID` (étape 1.7) |
| `B2_APP_KEY` | `applicationKey` (étape 1.7) |
| `B2_BUCKET` | le nom du bucket (ex. `shakemoi-sauvegardes-482913`) |
| `B2_ENDPOINT` | `https://` + l'Endpoint (ex. `https://s3.eu-central-003.backblazeb2.com`) |
| `SUPABASE_S3_KEY_ID` | Access key ID (étape 4) |
| `SUPABASE_S3_SECRET` | Secret access key (étape 4) |

### 6. Premier passage
GitHub → **Actions** → **Sauvegarde** (à gauche) → **Run workflow** → *mode* : **normal**, coche **fichiers** → **Run workflow**. Environ 6 minutes. Coche verte = c'est bon : la page **Admin** affiche « Dernière sauvegarde : il y a … ✓ restaurable », et sur Backblaze → **Browse Files** tu vois `daily/db-AAAA-MM-JJ.tar.gz.age` et `weekly/files-….tar.age`.

Efface ton bloc-notes.

## Restaurer (si un jour la base est perdue)

### Cas 1 — on veut juste récupérer un fichier ou vérifier une donnée
1. Backblaze → **Browse Files** → `daily/` → clique l'archive → **Download**.
2. Dans le dossier du téléchargement, PowerShell :
   ```
   age -d -i cle.txt -o db.tar.gz db-2026-10-05.tar.gz.age
   tar -xzf db.tar.gz
   ```
   (`cle.txt` = un fichier texte qui contient ta ligne `AGE-SECRET-KEY-1…`.) Tu obtiens `schema.sql`, `data.sql` (lisibles avec un éditeur de texte), `counts.tsv` (lignes par table)…

### Cas 2 — tout remettre en route dans un projet neuf (catastrophe)
1. **supabase.com** → **New project** : nom `Shakemoi`, région **West EU (Ireland)**, **Generate a password** (copie-le) → **Create**. Attends qu'il soit prêt (~2 min).
2. Dans le nouveau projet, prends : la chaîne **Session pooler** (comme étape 3 ci-dessus), la **référence** (les 20 lettres dans l'adresse du tableau de bord, après `/project/`), et une clé **S3** (comme étape 4).
3. GitHub → Settings → Secrets → Actions, ajoute : `RESTORE_DB_URL` (chaîne du nouveau projet), `RESTORE_REF` (sa référence), `RESTORE_S3_KEY_ID`, `RESTORE_S3_SECRET`.
4. GitHub → **Actions** → **Restauration** → **Run workflow** :
   - *archive* : ex. `daily/db-2026-10-05.tar.gz.age` (le nom exact vu sur Backblaze)
   - *fichiers* : ex. `weekly/files-2026-10-04.tar.age`
   - *confirmation* : `RESTAURER` → **Run workflow**.
   La tâche refuse de toucher une base qui n'est pas vide, ou l'ancienne base. Elle remplace l'ancienne adresse du projet par la nouvelle (appels des fonctions, adresses des photos), restaure base + tâches planifiées + secrets du coffre (les notifications continuent de marcher, mêmes clés), recompte les lignes, puis remet les fichiers.
5. Il reste à rebrancher le reste (Jerry peut le faire si tu lui donnes accès au nouveau projet) :
   - **Fonctions** : `supabase functions deploy` des 5 dossiers de `supabase/functions/` ; leurs secrets : `LASTFM_API_KEY` (si tu l'as mise), `SPOTIFY_CLIENT_SECRET`.
   - **Vercel** → projet → **Settings** → **Environment Variables** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` du nouveau projet → **Redeploy**.
   - **Supabase → Authentication → URL Configuration** : *Site URL* `https://www.shakemoi.fr` et les *Redirect URLs* (les recopier de l'ancien projet si possible, sinon `https://www.shakemoi.fr/**`, `https://shakemoi.fr/**`).
   - Les comptes et mots de passe des utilisateurs sont dans la sauvegarde : **tout le monde se reconnecte normalement**.
6. Mets à jour le secret `SUPABASE_DB_URL` (sauvegardes) avec la chaîne du nouveau projet, et `SUPABASE_REF` dans `.github/workflows/backup.yml`.

### Ce qui n'est PAS dans la sauvegarde
- Le code (il est sur GitHub) et la config Vercel / domaines.
- Les secrets des fonctions (Spotify, Last.fm) : garde-les dans ton gestionnaire de mots de passe.
- Ce qui s'est passé depuis la dernière nuit (au pire 24 h de données), et depuis le dernier dimanche pour les photos (au pire 7 jours).

## Test de restauration réel
- **Essai sans secrets** (base d'exemple, 05/10/2026) : copie, chiffrement, déchiffrement, restauration dans une base Supabase vide, comptage → voir `CE_SOIR.md`, section R.
- **Avec les vraies données** : automatique à chaque passage, dès que les 8 secrets sont en place (résultat sur la page Admin et dans GitHub → Actions → Sauvegarde).
