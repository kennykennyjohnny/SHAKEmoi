# MATIN — bilan de la session du 02/10/2026 (section Q)

Tout est en ligne sur **shakemoi.fr** (`main`, déployé par Vercel) : 6 lots, build + contrôle des types verts avant chaque envoi, **21 tests Playwright « connecté »** (sur base simulée) + **10/10 sur le site en ligne**. Détail ligne par ligne et tests de chaque lot : `CE_SOIR.md` → « Section Q ». Conception de Découvrir : `docs/reco.md`. Captures : `docs/captures/`.

## Étape 0 (P / N)
Rien d'ouvert hors ce qui t'attend (clé Sentry, compte de test, clé GIF, OK pages légales, thèmes P23, tests téléphone) ; patch de Jerry revérifié en base. P24 a été transformé par Q11.

## En bref — ce qui est en ligne
1. **Ton retour « texte illisible / curseurs partout »** : ~300 textes remontés au-dessus du contraste 4,5:1 ; **cause principale trouvée** : tout ce qui s'ouvre par-dessus l'appli (aperçu de profil, feuilles) héritait d'un **texte noir** (vieux thème clair) → couleurs de base passées en sombre. Plus de sélection de texte (poignées bleues, loupe) au double-tap / appui long, plus de clavier qui s'ouvre tout seul.
2. **Q10** notifs : un seul logo (nouveau badge S blanc), titres = la personne (« Bapt — a aimé ton Shake · Lithe »).
3. **Q7** photo de cercle : la cause (seul le créateur avait le droit, échec silencieux) ; tout membre peut, message « a changé la photo », photo perdue de « J B L » remise.
4. **Q6 / Q13** : `/messages/<pseudo>` ; actualiser reste sur la conversation ; elle s'ouvre **directement en bas**, même quand les photos chargent tard (cause reproduite et corrigée).
5. **Q12** flamme lisible partout.
6. **Q1 / Q5** aperçu de profil : lisible, **glisser vers le bas pour fermer**, **une seule requête** + affichage immédiat + préchargement au toucher + cache. Mesuré : 14 → 2-4 requêtes ; complet ~800 → ~300-500 ms ; réouverture ~40 ms.
7. **Q2** post suivant / précédent (glisser, flèches, clavier), **fermer en glissant vers le bas vers la vignette**, ouverture depuis la vignette.
8. **Q3** une seule courbe / durée partout (celle de Messages ↔ Cercles, qui n'a pas bougé), « réduire les animations » respecté.
9. **Q4** Classement : **Amis | Global | Découvrir**. **Q11** Shakes épinglés en haut de la grille (rubrique sons épinglés retirée ; « EKKO » repris).
10. **Q8 Découvrir** : moteur de recommandation complet (profil de goût unique partagé avec la compatibilité, écoutes, catalogue Deezer en tâche planifiée, raisons, Shaker / Pas pour moi, Tout écouter, nouvelle série en tirant). **Q9** « Choisis au moins 3 artistes » (tuto + Paramètres → « Mes artistes préférés »).
11. **Q14** nouveau tuto : 6 vrais bouts d'appli, 3 gestes à faire, puis appli d'écoute → 3 artistes → 3 personnes.

## Commits de la session
`e557b76` Q10/Q7/Q6/Q13/Q12 + lisibilité · `ef6d6af` Q1/Q5 · `4b606fd` Q2/Q3 · `0e35dde` Q4/Q11 · `f620500` Q8/Q9 · `f2394b0` Q14 · (+ ce bilan).

## À tester (25 minutes, sur ton téléphone)
1. **Lisibilité** : ouvre un aperçu de profil, des commentaires, les likes, les infos d'un cercle → plus aucun texte noir ; double-tape un message → plus de poignées bleues.
2. **Notifs** (Android, appli fermée) : un like depuis un 2ᵉ compte → S blanc à gauche, rien à droite, « Prénom — a aimé ton Shake · Titre ». Sur iPhone : décris-moi ce que tu vois.
3. **Photo de cercle** dans un cercle que tu n'as pas créé → elle reste après actualisation ; « J B L » a retrouvé la photo de Raph.
4. **Conversation** avec photos : on arrive tout en bas, sans défilement ; actualise : tu y restes.
5. **Aperçu de profil** : s'affiche tout de suite, glisse-le vers le bas pour le fermer.
6. **Post** depuis ta grille : glisse à gauche / droite, puis vers le bas → il retourne sur sa vignette.
7. **Classement** → Découvrir : écoute, Shaker, ✕, tire pour une nouvelle série. Dis-moi si les recos (et celles de tes potes, `CE_SOIR.md`) sonnent juste.
8. **Paramètres** → « Mes artistes préférés », puis « Revoir le tuto » (6 écrans + artistes).
9. **Épingler** : appui long sur une de tes pochettes.

## Ce que tu dois configurer toi-même (clic par clic)
1. **Clé Last.fm (gratuite, 5 min)** — le moteur marche déjà sans (mode réduit : Deezer + potes) ; la clé ajoute « titres similaires » :
   1. Va sur **last.fm/join** et crée un compte (ou connecte-toi).
   2. Va sur **last.fm/api/account/create** : *Application name* `SHAKEmoi`, *Application description* « Recommandations musicales », *Callback URL* vide, *Application homepage* `https://www.shakemoi.fr` → **Submit**.
   3. Copie la ligne **API key** (pas le « Shared secret »).
   4. **supabase.com** → projet → **Edge Functions** → **Secrets** (ou *Project Settings → Edge Functions*) → **Add new secret** : nom `LASTFM_API_KEY`, valeur = la clé → **Save**. (Rien à mettre dans Vercel : c'est la fonction `reco-catalog` de Supabase qui l'utilise.)
   5. C'est tout : le prochain passage du catalogue (toutes les 20 min) l'utilise. Pour forcer : Supabase → SQL Editor → `select public.run_reco_catalog();`
2. **Sentry, clé GIF, compte de test, 2 vieilles fonctions à supprimer, Leaked password protection, recompression des avatars** : toujours en attente, mêmes étapes que dans la section « Session précédente » ci-dessous (inchangées). Le compte de test permettrait de compléter le banc simulé par de vrais tests connectés.

## En attente de ta décision / de ton OK
1. **Découvrir — évaluation** : le moteur fait mieux que « les tendances pour tout le monde » sur l'**artiste** (22 % contre 16 %) et la **famille** (88 % contre 81 %), mais **pas nettement sur le son exact** (2 contre 3 sur 32) — avec nos données, presque aucun son caché n'était devinable (`docs/reco.md` § 7). Je propose de **juger sur l'usage réel** dans 2-3 semaines (requête prête dans `CE_SOIR.md`) et sur **ton avis** sur les top 10 de 5 comptes (`CE_SOIR.md`).
2. Pages légales (P30), thèmes du Shake de la semaine (P23) : inchangé.

## Pas fait / limites connues
- Pas de téléphone ni de compte de test : tout le « connecté » est vérifié sur un **banc d'essai** (l'appli en local, base simulée, vrais clics / vrais gestes tactiles), pas sur ton vrai compte. Notifs et rendu iPhone : à toi.
- « Bapt / Léa » des captures = données d'exemple du banc.
- Le geste « glisser vers le bas » du post et de l'aperçu est tactile (téléphone) ; sur ordinateur : croix, Échap, flèches.
- HOUDI n'a pas de fiche Deezer exploitable (mauvais homonyme) : ses titres n'arrivent dans Découvrir que par les potes.

---

# Session précédente (01 → 02/10/2026, prompt 5 : sections P et N) — pour mémoire

Tout est en ligne sur **shakemoi.fr** (branche `main`, déployé par Vercel). Build et contrôle des types verts avant chaque envoi. Détail ligne par ligne, avec les tests de chaque lot, dans `CE_SOIR.md`.

## En bref — ce qui est en ligne
1. **Notifications push qui marchent appli fermée** (P7) : likes, commentaires, abonnements, messages, cercles, @mentions, likes de messages, rappel de série, « a rejoint grâce à toi ». Interrupteur en haut des notifications, réglages respectés, conversations en sourdine. Clés de chiffrement générées et rangées dans le coffre Supabase : **rien à configurer**.
2. **Profils** : fil complet d'un ami, aperçu presque plein écran + profil complet, pochette → post complet, abonnés en commun, listes d'abonnés des autres (P1 à P4).
3. **Messagerie** : un seul écran pour privés et cercles, double-tap pour liker, répondre à un message, @mentions, retirer un message, renommer un cercle, glisser Messages ↔ Cercles, colonne ordinateur fiable (P5, P8 à P13, P26 à P28).
4. **TOP** Amis / Tout SHAKEMOI, « Depuis toujours », calculé en base, + **Genres du moment** (P14).
5. **Sécurité / stores** : bloquer (imposé en base), signaler, « Signaler un bug », page Admin, Sentry prêt (P15 à P17).
6. **Séries** en semaines (bug corrigé, recalculées), flamme violette, flamme de l'en-tête, rappel du lundi ; sons épinglés ; **playlist du cercle** avec lecture enchaînée (P21 à P24).
7. **Compatibilité musicale refaite** (genres, artistes proches, explication), **suggestions** d'amis, **inviter des amis** (lien + QR), « Suis 3 personnes » à la fin du tuto (P18, P19, P25, P29).
8. **Vidéos de partage refaites** (1080×1920, 17 s, couleurs de la pochette, QR, lien copié pour Insta/TikTok, < 8 Mo) + **récap de la semaine** (P20).
9. **Section N** : compteurs de commentaires (base juste, appli corrigée), photos HEIC converties, **une adresse par écran + retour qui suit l'historique + onglets gardés en mémoire**, aperçu de l'auteur depuis une story, titre + artiste partout.
10. **P31** : « Shake éphémère » partout ; **lien de cercle par code régénérable** (anciens liens invalides). **P30** : brouillon légal (non publié).

## Commits de la session
`a10dde1` étape 0 (patch de Jerry) · `b3ff85a` P7/P6 push · `2e9f858` P1/P2 · `1123a50` P3/P4 · `73792ba` messagerie unifiée · `b46910a` P11/P13 · `4db5735` P14 · `8397b54` P15-P17 · `5d4d1b6` P21-P24 · `0709821` P25/P18/P19/P29 · `12233c8` P20 · `dac9452` N3/N5 · `39c1749` N2 · `8444af5` N1/N4 · `b4067c3` P31 · `72cae56` P30 · `4183641` P14 genres + audit.

## À tester (20 minutes, sur ton téléphone)
1. **Notifs** : Notifications → interrupteur en haut → « Activer » → notif de test. Ferme l'appli ; depuis un 2ᵉ compte, like un de tes shakes → notif « @x a aimé ton shake », la toucher ouvre le post.
2. **Adresses / retour** : va sur ton profil, actualise → tu y restes. Messages → une conversation → actualise → elle est rouverte. Retour Android : la liste, puis le fil, puis l'appli se ferme.
3. **Onglets** : descends loin dans le fil → TOP → Accueil : même endroit. Retouche Accueil : remonte en haut.
4. **Story** : ouvre celle d'un ami, touche son avatar → pause + aperçu ; glisse l'aperçu vers le bas → la story reprend avec le son.
5. **Vidéo de partage** (iPhone puis Android) : un post → Partager → Créer la vidéo (écran allumé 17 s) → « Story Insta / TikTok » → Instagram : la vidéo avec le son, et « Lien copié » → sticker Lien. Puis « WhatsApp, SMS… » : la vidéo + le lien cliquable.
6. **Récap** : mardi après 11 h, carte « Ton récap de la semaine est prêt » en haut du fil (si tu as publié la semaine d'avant).
7. **Compatibilité** : aperçu de @raph → « 88 % » + l'explication. Recherche (champ vide) → suggestions.
8. **Inviter** : Profil → Inviter → QR → scanne avec un autre téléphone → page « Kenny t'invite » avec 3 sons.
9. **Cercle** : infos → « Générer un nouveau lien » → l'ancien lien dit « Ce lien n'est plus valide ».
10. **HEIC** : sur Android, publie une photo d'iPhone (HEIC) en Shake éphémère → « Conversion de la photo… » puis elle s'affiche partout.
11. **Flamme** : ton profil et l'en-tête ; Paramètres → Notifications → « Rappel de série ».
12. **Bloquer / signaler** : depuis un 2ᵉ compte (voir CE_SOIR lot 7).

## Ce que tu dois configurer toi-même (clic par clic)
1. **Sentry (P16)** — 10 min : voir `CE_SOIR.md` → « P16 — Ce qu'il te faut faire » (compte sentry.io région EU → projet React `shakemoi` → DSN + jeton → 4 variables dans Vercel `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` → Redeploy → Admin → « Test Sentry »).
2. **Clé GIF** (M5) : **klipy.com** → « Developers » / « Get API key » → crée un compte et une appli « SHAKEmoi » → copie la clé → **Vercel** → projet `shak-emoi-aipt` → Settings → Environment Variables → `KLIPY_API_KEY` = la clé (Production + Preview) → Deployments → dernier → « ⋯ » → Redeploy. (À défaut : developers.giphy.com → Create an App → API → `GIPHY_API_KEY`.)
3. **Compte de test** (tests Playwright connectés, P13) : crée un compte dédié dans l'appli (ex. `test.shakemoi+e2e@…`), suis-le avec 3 amis et mets-le dans 2 cercles, puis crée le fichier `.env.local` à la racine du projet avec `E2E_EMAIL=…` et `E2E_PASSWORD=…` (jamais ton vrai compte). Dis-le-moi : je lancerai les tests.
4. **Supprimer les 2 vieilles fonctions Supabase** : supabase.com → projet → **Edge Functions** → `make-server-7dbfc935` → ⋯ → **Delete** ; pareil pour `calculate-compatibility` (remplacée par le calcul en base de P25).
5. **Leaked password protection** : supabase.com → projet → **Authentication** → **Sign In / Providers** (ou *Policies / Passwords*) → active « **Prevent use of leaked passwords** » → Save.
6. **Recompression des avatars** (script 3) : dans le dossier du projet, clé dans Supabase → Project Settings → **API** → `service_role` (secret) :
   ```
   $env:SUPABASE_SERVICE_ROLE_KEY="ta_cle"; node scripts/recompress-avatars.mjs --apply
   ```
7. **Clés VAPID des notifications** : **rien à faire**, elles sont créées et rangées automatiquement dans le coffre Supabase (jamais dans le code).

## En attente de ta décision / de ton OK
1. **Pages légales (P30)** : relis `docs/legal_brouillon.md`, complète les **[À COMPLÉTER]** (éditeur, adresse, durées, régions Vercel / Sentry), puis dis « OK publie ».
2. **Thèmes du Shake de la semaine (P23)** : aujourd'hui il n'y a pas de thème en base. Si tu en veux : une petite table « thème de la semaine » + un écran Admin pour le saisir.
3. **Section Q** (le texte que tu as collé en reprenant la session) : je l'ai lu ; il demande de finir P et N d'abord, c'est fait. Dis-moi si je la lance telle quelle. Note : Q11 change la décision P24 (sons épinglés → Shakes épinglés dans la grille).
4. Décidés et appliqués depuis la dernière fois : vocabulaire « Shake éphémère » ✅, lien de cercle régénérable ✅, anciennes interactions sur des reshakes → on n'y touche pas ✅.

## Pas fait / limites connues
- Tests sur téléphone réel impossibles de mon côté : vidéos (P20), notifications (P7), installation (PWA) → tests ci-dessus.
- Tests connectés dans le navigateur impossibles sans compte de test (N2 testé avec une maquette des onglets).
- Playlist du cercle écran verrouillé : dépend du navigateur (Safari peut bloquer l'enchaînement).
- Commentaire d'une personne bloquée : caché mais compté (très rare).

---

# Nuit précédente (29 → 30/09) — pour mémoire

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
