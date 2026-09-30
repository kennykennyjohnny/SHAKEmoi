# MATIN — bilan de la nuit (29 → 30/09/2026)

Tout est en ligne sur **shakemoi.fr** (branche `main`, déployé par Vercel). Build et contrôle des types verts avant chaque envoi. Détail ligne par ligne dans `CE_SOIR.md`.

## En bref
1. **Sécurité critique réglée** : une vieille fonction serveur (Figma Make) encore en ligne permettait de récupérer les emails de tous les comptes. Neutralisée.
2. **Ton bug** : les reshakes étaient comptés comme des shakes sur le profil → corrigé partout (profil, aperçu, page publique, carte de partage). Les compteurs plafonnaient aussi à 9 ou 50.
3. Chaque commentaire texte était compté **deux fois** → corrigé.
4. Compteurs d'abonnés stockés faux (4 déclencheurs qui se marchaient dessus) → un seul, 30 profils recalculés.
5. Plus possible de tricher sur ses compteurs (abonnés, likes, séries) : colonnes verrouillées en base.
6. Plus de faux liens « Écouter sur… » vers des sites pirates ; photos limitées en taille/type, chacun dans son dossier.
7. Cercles : une personne retirée ne revient plus seule avec l'ancien lien.
8. **O1** : tuto + appli d'écoute enregistrés dans le profil → jamais redemandés, même après déconnexion ou sur un autre téléphone. « Revoir le tuto » dans les paramètres.
9. **O2** : nouveau tuto plein écran (glisser, barre de progression, Passer) + logos officiels des 7 applis partout où on ouvre un son.
10. **O3** : une réponse en musique compte comme un commentaire partout (4 compteurs corrigés).
11. Bouton **retour** du téléphone : ferme la fenêtre ouverte au lieu de quitter l'appli (12 fenêtres).
12. iPhone (appli installée) : en-tête plus caché sous l'heure, champs de saisie plus cachés sous la barre du bas.
13. Erreurs visibles en français au lieu d'échecs silencieux (shake depuis le composer, la Recherche, le TOP ou le Shake de la semaine, commentaire, suivre, like, cercles).
14. Appli plus légère au premier affichage (253 → 207 Ko), écrans chargés à la demande.
15. Tests automatiques Playwright (téléphone + ordinateur) : 10/10 sur le site en ligne (relancés après chaque grosse mise en ligne).
16. **Cohérence (M11)** : un reshake montre partout les chiffres du post d'origine ; les likes des messages de cercle comptent enfin ; le TOP n'inclut plus de posts privés ou de cercle ; une seule façon d'afficher les dates.

## Commits de la nuit, par thème
**Données (scripts validés)**
- `35f57d9` pseudos en minuscules + anciens liens, reshakes en double, réponses en musique comptées
- `29d030b` scripts rangés dans `supabase/applied/`, simulation avatars

**Section O**
- `0650f65` O1/O2 : tuto et appli d'écoute dans le profil, tuto plein écran, logos officiels
- `aad93b9` O2 : correctif d'affichage de l'écran de choix

**Sécurité**
- `cf73b70` reshakes ≠ shakes, commentaires comptés double, avatar dans son dossier, images de la carte de partage filtrées, fonctions serveur neutralisées
- `42364fb` migration de sécurité (compteurs, colonnes verrouillées, cercles, liens, stockage)

**Navigation / mobile / états**
- `363576e` retour du téléphone, zones iPhone, shake raté signalé, cercle sans clignotement
- `80f3ff4` erreurs visibles, cercles, conversations, ordinateur, accessibilité (50 libellés)
- `30e4d85` erreur de chargement des cercles avec « Réessayer », index base
- `8b58ad7` une actualisation garde l'onglet en cours

**Cohérence entre écrans (M11)**
- `d4ea022` likes de cercle, reshakes = post d'origine, TOP sans privé/cercle, Suivre vérifié partout
- `d06833f` dates identiques partout, like du profil protégé
- `0f6b235` avatars des pages publiques, code mort retiré
- `27083b5` shake depuis Recherche/TOP/Shake de la semaine : plus d'échec silencieux

**Perf + tests**
- `1c57a70` écrans chargés à la demande
- `76119e6` tests Playwright

## À tester ce matin (10 minutes)
**Téléphone**
1. Ouvre ton profil : le nombre de **shakes** ne compte plus tes reshakes (onglet Reshakes à part).
2. Commente un shake d'un ami : le compteur monte de **1** (pas de 2). Réponds en musique : +1 aussi.
3. Déconnecte-toi puis reconnecte-toi : le tuto ne revient **pas**. Paramètres → « Revoir le tuto » : il se rejoue, ton appli est pré-cochée, et tu reviens aux paramètres.
4. Paramètres → choisis Deezer (ou autre) → Enregistrer. Sur un shake, le bouton « ouvrir » montre le logo Deezer et ouvre Deezer.
5. Ouvre les commentaires d'un shake puis fais **retour** (geste ou bouton) : la fenêtre se ferme, tu restes dans l'appli. Pareil avec le composer, un profil, les paramètres.
6. iPhone, appli installée : le logo et la cloche ne passent plus sous l'heure ; dans une conversation, le champ de saisie est entièrement visible au-dessus de la barre du bas.
7. Crée un cercle, va à l'étape 2, reviens à l'étape 1 et appuie sur « Créer » : **un seul** cercle créé.
8. Dans un cercle : envoie un message, la conversation ne clignote plus.
9. Va sur Messages, actualise la page : tu restes sur Messages.
10. Coupe le réseau et ouvre Cercles : message « Impossible de charger… » + Réessayer.

**Ordinateur**
11. Clique une conversation dans la colonne de gauche, ferme-la, reclique la même : elle se rouvre.
12. Le bouton + des messages ne recouvre plus le TOP de droite.
13. Ouvre `shakemoi.fr/u/Kenny` (majuscule) : ça ouvre bien @kenny.
14. Profil → onglet Reshakes : les likes/commentaires d'un reshake sont les mêmes que dans le fil ; liker depuis là compte sur le post d'origine.
15. Dans un cercle, like un message : le chiffre passe à 1 tout de suite (il restait à 0).

## Section M — rappel de ce qui est fait (soir) et à tester
M1 tous les sons lisibles (Deezer stable, iTunes, secours « Écouter sur <ton appli> ») · M2 une seule façon de jouer un son, plus d'embed Spotify, pas de lecture auto · M3 compte à rebours des stories · M4 vues visibles par la propriétaire (œil en bas à droite) · M5 GIF (**il te faut une clé KLIPY ou GIPHY**, voir CE_SOIR) · M6 bouton d'installation toujours visible · M7 ordinateur : Messages + Groupes à gauche, TOP à droite · M8 plus de curseur clignotant · M9 logo → accueil + rechargement · M10 likes de story groupés dans la cloche.
À tester : jouer 3 sons différents (un seul à la fois), ouvrir une story à toi (œil + liste), liker une story depuis un 2ᵉ compte (une seule notif groupée).

## En attente de ta décision / de ton OK
1. **Avatars (script 3)** : simulation OK (13,7 Mo → 42 Ko), il reste à lancer l'envoi avec ta clé secrète (commande plus bas). Je n'ai pas le droit de lire cette clé.
2. **GIF** : créer une clé gratuite KLIPY (ou GIPHY) et l'ajouter dans Vercel (`KLIPY_API_KEY`).
3. **Fonctions serveur neutralisées** (`make-server-7dbfc935`, `calculate-compatibility`) : à supprimer du tableau de bord Supabase (Edge Functions → Delete). La table `kv_store_7dbfc935` (2 lignes, dont 1 email) peut aussi être supprimée — je ne l'ai pas fait (suppression de données non listée).
4. **Supabase → Authentication → Passwords** : activer « Leaked password protection » (réglage du tableau de bord, je ne peux pas le faire).
5. **Vocabulaire** : l'appli dit « Groupes » à certains endroits et « Cercles » à d'autres ; « Shake Éphémère » vs « story ». Tu choisis, je remplace partout.
6. **Anciennes interactions sur des reshakes** : 9 likes et 2 commentaires (avant avril) sont restés sur des lignes de reshake, plus visibles nulle part. OK pour les déplacer vers les posts d'origine (même méthode que le script 2) ?
7. **Invitation de cercle** : le lien `/c/<id>` reste valable à vie pour qui l'a vu. Option : lien avec un code qu'on peut régénérer (changement de fonctionnement → ton OK).

## Grosses décisions (branche `nuit-decisions`)
Aucune cette nuit : tout ce qui a été fait est petit, réversible et déjà sur `main`. Pas de branche à fusionner.

## Pas fait / 10 prochaines priorités
1. Script avatars : envoi réel (ta clé).
2. Test de connexion Playwright avec un compte de test (donne-moi `E2E_EMAIL` / `E2E_PASSWORD` d'un compte dédié, dans `.env.local`, jamais un vrai).
3. Alléger encore l'appli : bibliothèque d'animations en chargement léger (`LazyMotion`, ~25 Ko de gagnés) — refonte moyenne, à faire à tête reposée.
4. Base : 71 règles d'accès à optimiser (`(select auth.uid())`) et 10 règles en double — utile quand il y aura du monde, pas urgent à 30 comptes.
5. Rafraîchir la liste des conversations quand on revient d'une conversation (ordre et non-lus) — vu en lisant le code, pas encore vérifié sur téléphone.
6. Ordinateur : bouton + et quelques fenêtres à mieux placer au-delà de 1440 px.
7. J1 Bloquer / Signaler (exigé par les stores).
8. D4/D6 vraies notifications push (appli fermée).
9. G9 Connexion Google / Apple.
10. Série de posts (`current_streak`) : le déclencheur du profil l'incrémente aussi quand on modifie son profil — champ non affiché aujourd'hui, à nettoyer avant de l'afficher.
(Section N : jamais reçue.)

## Bilan des 3 scripts validés

### 1. Pseudos en minuscules — ✅ fait
- Seule la colonne `username` (le @) a changé. Les **noms d'affichage n'ont pas été modifiés** (vérifié avant : aucun n'avait été mis en minuscules par erreur).
- Les 14 profils sans nom d'affichage affichaient leur pseudo : leur nom d'affichage a été rempli avec leur pseudo **tel quel** (ex. « Kenny »), pour que rien ne change à l'écran.
- Conflit : « Raph » (18 posts) → `raph` ; l'autre compte « raph » (0 post) → `raph2`.
- Résultat : 0 pseudo hors règle ; unicité sans casse garantie par la base.
- Anciens pseudos gardés dans `old_usernames` (28 lignes) ; les anciens liens `/u/Ancien` ouvrent le bon profil — vérifié pour les 28, et par les tests automatiques.

### 2. Reshakes en double — ✅ fait (trace AVANT suppression)
| id supprimé | auteur | post d'origine | son | date | raison |
|---|---|---|---|---|---|
| `61e41c58-7012-4236-adc9-8e0fcbc3b052` | @kenny | `70843e93-6c7e-41f9-9c96-e472a82162b8` | WELTiTA — Bad Bunny | 14/04/2026 11:38 | 2e reshake du même post |
| `3f2771e8-a3f6-4ef2-9016-a184886d38d1` | @raph | `418558f3-3c41-46ca-a071-a341774cf8f6` | Melodyne (feat. Gisèle) — Stony Stone | 16/12/2025 13:13 | reshake de son propre post |
| `7416de4c-8f0f-4d25-88b9-0ba424d94853` | @kenny | `63c567ca-b72c-4a5a-a16f-50ace2e71307` | RENÉ CAOVILLA — Gambi | 14/04/2026 21:49 | reshake de son propre post |

Ce qui était attaché : 1 commentaire de @lil_mga et 2 likes de @kenny → **déplacés sur le post d'origine**. Compteurs de reshakes vérifiés : 0 erreur.

### 3. Recompression des avatars — 🟡 simulation faite, envoi à lancer par toi
| profil | avant | après |
|---|---|---|
| @fawn28 | 9 685 Ko | 8 Ko |
| @bapt22 | 2 626 Ko | 12 Ko |
| @shakemoi | 1 021 Ko | 7 Ko |
| @kenny | 641 Ko | 7 Ko |
| @lil_mga | 11 Ko | (déjà léger, pas touché) |
| **Total** | **13,7 Mo** | **~42 Ko** |

Les originaux ne sont jamais supprimés. À lancer dans le dossier du projet (clé : Supabase → Project Settings → API → service_role) :
```
$env:SUPABASE_SERVICE_ROLE_KEY="ta_cle"; node scripts/recompress-avatars.mjs --apply
```
En attendant, l'appli affiche déjà ces avatars en petite version via `/api/img` : rien de lent pour les utilisateurs.
