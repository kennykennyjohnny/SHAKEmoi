# SHAKEmoi

**Écoute. Partage. Shake.** — le réseau social où l'on partage des sons avec ses amis, quelle que soit leur plateforme (Spotify, Apple Music, Deezer, YouTube Music, Tidal).

En ligne : https://www.shakemoi.fr

## Stack

- **Front** : React 18 + Vite + Tailwind CSS v4 (`src/`), appli installable (PWA : `public/manifest.json`, `public/sw.js`).
- **Back** : Supabase (Postgres + règles d'accès RLS, Auth, Storage, Realtime).
- **Hébergement** : Vercel uniquement (projet `shak-emoi-aipt`), déploiement automatique à chaque push sur `main`.
- **Fonctions Vercel** (`api/`) :
  - `api/page.ts` : métadonnées des liens partagés (`/s`, `/p`, `/u`, `/i`, `/c`, `/m`) ;
  - `api/og.ts` : image d'aperçu des liens (1200×630) ;
  - `api/links.ts` : liens vers chaque plateforme (Spotify → ISRC → Deezer, iTunes…) ;
  - `api/img.ts` : photos redimensionnées à la volée (WebP, cache CDN 1 an).
- **Fonction Supabase** : `supabase/functions/spotify-proxy` (recherche Spotify, origines autorisées + limite par IP).

## Démarrer en local

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

Vérifications avant de pousser :

```bash
npm run build
npm run typecheck
```

## Base de données

- Les changements de base sont dans `supabase/migrations/` (un fichier daté par lot, SQL idempotent).
- `supabase/pending/` : scripts **à valider avant de lancer** (ils modifient des données existantes).
- Tables principales : `users_profile`, `posts`, `likes`, `comments`, `follows`, `messages`, `conversation_reads`, `circles`, `circle_members`, `circle_messages`, `stories`, `notifications`, `songs`, `shares`.
- Les notifications ne sont **jamais** créées par l'appli : uniquement par des déclencheurs en base.

## Organisation du code

- `src/app/App.tsx` : navigation, session, pastilles.
- `src/app/components/` : écrans (fil, messages, profil, stories…).
- `src/lib/` : accès aux données (`database.ts`), images (`media.ts`), notifications (`notify.ts`), erreurs en français (`errors.ts`), liens partagés (`links.ts`), pseudos (`username.ts`), dates (`dates.ts`).
- `docs/archive/` : anciens documents et scripts SQL (historique, plus utilisés).
- `CE_SOIR.md` : suivi des corrections de l'audit du 29/09/2026.
