# Découvrir — moteur de recommandation (Q8)

But : ~20 sons que **j'ai de vraies chances d'aimer**, avec **une raison en une ligne**, affichés **instantanément** (une seule lecture en base), sans jamais appeler une API extérieure pendant qu'on ouvre l'onglet.

## 1. Les données (un seul profil de goût)
Une seule source, `taste_signals` : **chaque geste musical de chaque personne**, pondéré. Elle alimente **à la fois** Découvrir, la compatibilité (P25) et les suggestions d'amis (P18) — avant, la compatibilité avait son propre calcul.

| Signal | Poids | Remarque |
|---|---|---|
| Shake épinglé (Q11) | 1,5 | ne vieillit pas tant qu'il est épinglé |
| Shake publié (Shake de la semaine compris) | 1,0 | |
| Shake publié depuis Découvrir | 1,0 | c'est un Shake comme un autre (pas compté deux fois) |
| Artiste choisi au tuto (Q9) | 1,0 → 0 | **niveau artiste**, × 5 / (5 + nb de mes vrais signaux) : mes usages prennent vite le dessus |
| Reshake | 0,8 | |
| Réponse en musique | 0,7 | |
| Shake éphémère | 0,6 | |
| Like d'un Shake | 0,5 | |
| Like d'un Shake éphémère | 0,4 | |
| Écoute > 15 s dans l'appli | 0,3 | une fois par son et par jour (`listen_events`) |
| Son passé en < 5 s | −0,2 | |
| « Pas pour moi » | −1,0 | et −0,3 sur l'artiste (on évite aussi ses autres titres) |

**Récence** : poids × 0,5^(âge / 60 jours) (épinglés et artistes choisis exclus). **Représentation** (`user_taste`) : artistes (+ artistes proches Deezer à 35 %), **genres fins en TF-IDF** (« pop » pèse moins que « drill française »), **familles** (Rap, Afro, Latin, Électro…), et les titres eux-mêmes ; vecteurs normalisés (200 sons n'écrasent pas 10 sons).

## 2. Les sources de candidats
Spotify ne donne plus de recommandations ni d'artistes similaires aux nouvelles applis : **on ne compte pas dessus**.
- **a. Social** (le plus SHAKEMOI) : sons publiés, reshakés ou likés par les gens qui me ressemblent (compatibilité P25), pondérés par cette compatibilité. **Seulement du public** (jamais de privé ni de cercle).
- **b. Artistes proches** : pour mes artistes principaux, Deezer `/artist/{id}/related` puis leurs titres phares `/artist/{id}/top`. Last.fm `artist.getSimilar` en plus **si la clé existe**.
- **c. Plus de mes artistes** : titres phares de mes artistes que je n'ai pas encore partagés.
- **d. Titres similaires** : Last.fm `track.getSimilar` sur mes sons les plus forts (**seulement avec la clé**).
- **e. Exploration par genre** : classements Deezer par genre (`/chart/{genre}/tracks`), Last.fm `tag.getTopTracks` avec la clé.
- **f. Tendances SHAKEmoi (Global)** : pour les nouveaux et en petit complément.

Sans clé Last.fm : **mode réduit** (a, b via Deezer, c, e via Deezer, f) — déjà complet.

## 3. Le score
Chaque composante est ramenée entre 0 et 1, puis :
**score = 0,45 × goût + 0,30 × social + 0,15 × confiance de la source + 0,05 × popularité (log) + 0,05 × fraîcheur**
- **goût** : proximité entre le son (son artiste, ses genres, sa famille, ses artistes proches) et mon profil ;
- **social** : Σ (compatibilité × poids du geste) des gens qui l'ont partagé / liké ;
- **source** : rang de similarité Deezer (1er artiste proche > 10e) × poids de l'artiste de départ dans mon profil ;
- **fraîcheur** : sortie depuis moins de 60 jours.

**Retirés** : ce que j'ai déjà publié, reshaké, liké, mis en Shake éphémère ou en réponse ; mes « Pas pour moi » ; ce qu'on m'a montré **3 fois sans que je l'écoute** (oublié 3 semaines).
**Diversité** (re-classement glouton type MMR) : **2 titres max par artiste** sur 20 (1 seul si je connais déjà bien l’artiste) ; familles **en proportion de mon profil** ; **~20 % de places d'exploration** (4 sur 20) dans des familles **voisines** — voisines = celles qu'aiment **aussi** les gens qui aiment mes familles principales (calculé à partir des profils de goût de tout le monde, pas une liste écrite à la main) ; jamais un artiste que j'aime déjà.
**Nouveaux** (< 5 signaux) : artistes choisis au tuto (Q9) → leurs artistes proches et titres phares ; sons de la personne qui m'a invité (P19) ; tendances Global.
**Raison** (une ligne, la composante qui pèse le plus) : « Parce que tu as shaké Tiakola » · « Aimé par Bapt · 92 % compatibles » · « Plus de Tiakola » · « Dans ton style Afro » · « Nouveauté Rap » · « Pour sortir de ta bulle · Électro » · « Tendance sur SHAKEmoi ».

## 4. Architecture et performance
- **Fonction serveur `reco-catalog`** (Edge Function, tâche planifiée) : seule à parler à Deezer / Last.fm, avec **limite de débit** (8 requêtes/s) et **cache** (artistes 30 jours, classements 1 jour). Remplit `catalog_tracks` (titre, artiste, ids Deezer/Spotify si connus, pochette, extrait via la chaîne M1 `/api/preview?deezer=…`, rang de popularité, date de sortie) et enrichit `artist_profiles` (artistes proches **avec leur id et leur rang**).
- **En base** (SQL, rapide) : `taste_signals` → `build_user_taste` → `user_taste` ; `compute_recos(user)` → `user_recos` (top 50 avec score, raison, composantes).
- **Recalcul** : toutes les nuits pour tout le monde ; **à la demande** quand on ouvre l'onglet si la liste a plus de 24 h **ou** si j'ai donné au moins 5 nouveaux signaux (calcul SQL, sans appel extérieur).
- **L'onglet** fait **une seule lecture** (`get_my_recos`) → affichage instantané, même en 4G. Tirer vers le bas = la série suivante (rangs 21-40), la liste du jour se renouvelle chaque jour.
- **Mesure continue** : `reco_events` (affiché, écouté, écouté en entier, Shaké, Pas pour moi) → taux d'écoute, taux de Shake, pour réajuster les poids. `listen_events` (lecteur M2 : début, durée, fin) nourrit aussi le goût.

## 5. Évaluation (obligatoire)
Hors ligne, sur nos vraies données, fonction `eval_recos()` : pour chaque personne avec au moins 5 Shakes, on **cache ses 20 % de Shakes les plus récents**, on reconstruit son goût avec le reste (signaux d'avant la coupure seulement) et on génère son top 20. **Hit-rate@20** à trois niveaux : le son caché lui-même / son artiste / sa famille. Base de comparaison : « les tendances Global pour tout le monde » (calculées elles aussi avant la coupure). Résultats ci-dessous (§ 7), puis **contrôle humain** : top 10 de 5 vrais comptes dans `CE_SOIR.md`.

## 6. Ce qui change par rapport à la proposition, et pourquoi
1. **Le profil de goût est au niveau des gestes** (une seule table de signaux) : compatibilité, suggestions et Découvrir lisent exactement la même chose — impossible qu'ils divergent.
2. **Artistes proches avec leur rang** (Deezer) plutôt qu'une liste plate : « 1er artiste proche de Tiakola » compte plus que le 10e.
3. **Familles voisines déduites des goûts de la communauté** pour l'exploration (pas une liste figée « Rap → R&B ») : s'adapte tout seul.
7. **« Ce que mes potes écoutent » au niveau de l'artiste** (pas seulement du titre) : un artiste partagé récemment par des gens qui me ressemblent fait entrer ses titres phares — c'est ce qui a le plus amélioré l'évaluation.
4. **« Pas pour moi » touche aussi l'artiste** (−0,3) : sinon on reproposerait un autre titre du même artiste le lendemain.
5. **Composantes gardées avec chaque reco** : on peut expliquer **et** réajuster les poids plus tard à partir des `reco_events`, sans tout recalculer à l'aveugle.
6. **Deux niveaux de rappel en évaluation** (artiste, famille) en plus du son exact : avec ~100 Shakes au total, retrouver le titre exact caché est presque impossible pour n'importe quel moteur ; l'artiste et la famille disent si on est dans le bon univers.

## 7. Résultats de l'évaluation (02/10/2026, vraies données)
Catalogue : **1 778 titres** (Deezer : titres phares de 79 artistes et de leurs proches, classements de 12 familles, nouveautés ; Last.fm pas encore branché, faute de clé). 8 comptes ont assez d'historique ; on leur cache leurs **20 % de sons les plus récents** (tous gestes positifs) : **32 sons cachés**.

| Top 20 | Le son lui-même | Son artiste | Sa famille |
|---|---|---|---|
| **Moteur SHAKEmoi** | 2 / 32 (6 %) | **7 / 32 (22 %)** | **28 / 32 (88 %)** |
| Base « tendances Global » | 3 / 32 (9 %) | 5 / 32 (16 %) | 26 / 32 (81 %) |

Top 10 : moteur 1 / 4 / 21 contre base 1 / 3 / 22. Top 50 : 2 / 7 / 28 contre 3 / 7 / 27.

**Lecture honnête** : le moteur fait mieux sur l'artiste (+40 %) et la famille, mais **pas « nettement » mieux sur le son exact**, et l'écart n'est pas significatif à cette taille. Pourquoi : sur les 32 sons cachés, **seuls 3 avaient déjà été partagés par quelqu'un d'autre avant la coupure** (les autres sont surtout des likes sur des posts publiés *après*, impossibles à deviner pour n'importe quel moteur) ; le moteur en retrouve 2 dans son top 20 (rangs 3 et 20). Sur une communauté de 35 comptes où tout le monde se suit, « ce que les potes viennent de poster » (la base) est déjà un très bon prédicteur — et le moteur l'inclut.

**Réglages essayés** (8 combinaisons de poids goût / potes / source / tendances) : l'artiste varie de 6 à 7 / 32, la famille de 24 à 26 : **les poids ne sont pas le facteur limitant, les sources le sont.** Ce qui a vraiment aidé : (1) l'artiste « partagé par mes potes » comme source, (2) une mémoire de 120 jours pour les potes, (3) une égalité honnête dans la base (elle gagnait d'abord par ordre alphabétique en cas d'égalité !). Poids retenus : goût 0,40 · potes 0,35 · source 0,15 · tendances 0,05.

**Ce qui tranchera** : les mesures en continu (`reco_events` : taux d'écoute, d'écoute complète, de Shake, de « Pas pour moi ») et le contrôle humain (top 10 de 5 comptes dans `CE_SOIR.md`). Requête de suivi prête dans `CE_SOIR.md`.
