# CE SOIR — corrections de l'audit (29/09/2026)

Légende : ✅ fait · 🟡 partiel · ⏭️ reporté · ❌ faux positif · ⏳ pas encore traité

## LOT 0 — État réel de Supabase (lu directement dans la base)

| # | Verdict | Ce que dit la vraie base |
|---|---|---|
| L5 | ✅ | Les 7 migrations d'hier sont bien appliquées (circle_link_preview, users_profile_no_email, stories_owner_update, delete_my_account, stories_archive_private, messages_story_id, exact_like_counts). |
| B1 | confirmé | `circle_members` : insertion autorisée à toute personne connectée, lecture ouverte. |
| B2 | confirmé | `posts` : deux règles de lecture `true` pour tout le monde, même sans compte. |
| B3 | confirmé | `notifications` : insertion `true` pour toute personne connectée. |
| B6 | ❌ faux positif | Les règles des messages existent (lecture/écriture par les deux personnes). Seul défaut trouvé : le destinataire pouvait réécrire le texte d'un message reçu → corrigé. |
| B7 | confirmé | `circles` : lecture `true` pour toute personne connectée. |
| F3 | confirmé | `reshakes_count` : +1 côté appli, jamais recalculé ni décrémenté. |

Trouvailles en plus :
- Les notifs « like de commentaire », « a rejoint ton cercle », « cercle créé » n'ont **jamais** marché (colonne absente / type refusé par la base).
- N'importe qui pouvait **lister** tous les fichiers du Storage et **écraser l'avatar** d'un autre.
- Le compteur d'abonnés `feels_count` est incrémenté par 3 déclencheurs en double (l'appli affiche les vrais comptes, mais le classement TOP s'en sert) → à nettoyer (voir LOT 7).

## Tableau de bord

| # | Statut | Explication |
|---|---|---|
| **LOT 1 — Sécurité** | | |
| B1 | ✅ | On n'entre plus dans un cercle sans invitation : rejoindre passe par une fonction sécurisée (lien ou code exact). Seuls les membres voient les membres. |
| B2 | ✅ | Posts privés et posts de cercle invisibles pour les autres (vérifié : un visiteur voit 0 post privé, 93 publics). |
| B3 | ✅ | L'appli ne peut plus créer de notification : elles viennent toutes de déclencheurs en base. Test : fausse notif refusée. |
| B4 | ✅ | Le profil (posts + reshakes) filtre les posts de cercle. |
| B5 | ✅ | Espace `circle-media` passé en privé ; photos affichées par liens signés (1 h). Nouvelles photos privées rangées par conversation (`dm/…`) ou par cercle. La photo de groupe va dans l'espace public (visible sur la page d'invitation). ⚠️ Le seul cercle qui avait une photo devra la remettre pour qu'elle réapparaisse sur sa page d'invitation (les membres la voient toujours). |
| B6 | ❌→✅ | Faux positif, mais le destinataire ne peut plus modifier que « lu/non lu ». |
| B7 | ✅ | La liste des cercles n'est visible que par leurs membres. La recherche « Cercles » montre tes cercles + celui dont tu tapes le code exact. |
| B8 | 🟡 | Relais Spotify : origines autorisées (un autre site est refusé, testé 403), limite par IP (40/min visiteur, 120/min membre), entrées validées. **Pas réservé aux seuls connectés** : ça casserait la recherche de sons sans compte (ta page d'accueil visiteur). Dis-moi si tu veux quand même le fermer. |
| B10 | ✅ | Plus d'email ni de pseudo dans les journaux du navigateur. |
| A2 | ✅ | Messages, sons envoyés, likes/réponses de story, messages de cercle : plus aucune notif dans la cloche (pastille Messages seulement). Like de story : un seul message par story et par personne. |
| C4 | ✅ | « Envoyer à un ami » envoie un vrai message avec le son (écoutable dans la conversation). |
| D3 | ✅ | Plus de notif à soi-même en créant un cercle. |
| **LOT 2 — Téléphone et 4G** | | |
| A1 / H1 | ✅ | Règle globale : tous les champs en 16 px sur téléphone/tablette (plus de zoom iPhone). Les 7 barres (commentaires, détail d'un post, messages privés, cercle ×2, réponse à une story, recherche) : le champ rétrécit, les boutons ne sortent plus de l'écran. Marge de 4,5 rem sous les commentaires retirée. |
| C3 | ✅ | Photo en message privé / cercle : la galerie est proposée (plus d'appareil photo forcé). |
| I1 | ✅ | Nouvelles photos de profil compressées à 256 px. Photos déjà en ligne (jusqu'à 9,7 Mo !) servies en petite version WebP par un relais d'images Vercel (`/api/img`, cache 1 an) → pas besoin de toucher aux fichiers. |
| I2 | ✅ | `loading="lazy"` sur toutes les images (≈150). Pochettes 640 px → 300 px partout où elles sont petites. |
| I10 | ✅ | Photos des posts, stories, messages et cercles compressées avant l'envoi (1280 px, JPEG 0,8). |
| B11 | ✅ | Avatar par défaut généré sur place (initiale sur fond violet) : fini ui-avatars.com. Les avatars « dicebear » proposés n'utilisent plus le pseudo. |
| I3 | ✅ | Le fil n'attend plus les stories. Vues des stories en 1 requête (avant : 1 par story). Liste des abonnements gardée 30 s au lieu d'être relue 2-3 fois. |
| I4 | ✅ | Retour sur Accueil : le dernier fil s'affiche instantanément puis se rafraîchit en fond. |
| I5 | ✅ | Session lue sur le téléphone (`getSession`) au lieu d'un aller-retour serveur à chaque action (~87 fonctions d'un coup, via `getCurrentUser`). |
| I6 | ✅ | Recherche de personnes : 2 requêtes au total (avant jusqu'à 40) ; une ancienne frappe n'écrase plus la nouvelle. |
| I7 | ✅ | Délai maximum sur toutes les requêtes (20 s, 60 s pour les envois de photos). Le fil affiche une erreur en français + « Réessayer » (avant : fil vide ou chargement infini). |
| G8 | ✅ | Recherche de personnes par pseudo **ou** nom affiché ; `%` et `_` gérés. |
| **LOT 3 — Messages privés** | | |
| C1 | ✅ | La conversation charge les 50 **derniers** messages ; bouton « Messages plus anciens » en haut (la position de lecture est gardée). |
| C2 | ✅ | Un message qui part s'affiche « Envoi… » ; s'il échoue : bulle rose « Pas envoyé · Réessayer · Annuler ». Idem photos et GIF. |
| C3 | ✅ | (fait au LOT 2) galerie autorisée. |
| C4 | ✅ | (fait au LOT 1) « Envoyer à un ami » envoie un vrai message avec le son. |
| C5 | ✅ | Liste : « 14:32 », « Hier », « lun. », « 12/09 ». Conversation : séparateurs « Aujourd'hui / Hier / Lundi 22 septembre ». |
| C6 | ✅ | Dernier message + non lus calculés en base (fonction `get_conversations`) au lieu de télécharger tout l'historique. |
| C7 | ✅ | Une réponse à une story reçue en direct s'affiche avec l'aperçu de la story. |
| C8 | ✅ | La liste des conversations se met à jour en direct quand un message arrive. |
| C9 | ✅ | Touche un de tes messages → « Supprimer pour tous » (disparaît aussi chez l'autre en direct). |
| A3 | ✅ | Pastille = nombre de **conversations** non lues, basée sur une date de dernière lecture en base (`conversation_reads`). Ouvrir une conversation la marque lue ; ouvrir l'onglet ne remet rien à zéro ; la pastille ne monte plus pendant qu'on lit. |
| **LOT 4 — Notifications et stories** | | |
| A2 | ✅ | (LOT 1) + les anciennes notifs de messages ne s'affichent plus dans la cloche. |
| E3 | ✅ | (LOT 1) like de story : un seul message par story et par personne. |
| D1 | ✅ | Like/commentaire/reshake/like de commentaire → le post. Abonné → le profil. Cercle rejoint/ajout → le cercle. Anciennes notifs de message/son/story → la conversation. |
| D2 | ✅ | « a aimé ton commentaire », « t'a ajouté·e à un cercle », « s'est abonné·e à toi » (plus « t'a ajouté en ami »). |
| D3 | ✅ | (LOT 1) |
| D4 | 🟡 | Plus de plantage sur Chrome Android : la notif passe par le service worker ; toucher la notif ramène dans l'appli. Notif « nouveau message » quand l'appli est en arrière-plan. **Appli fermée : toujours rien** (vraies notifications push = backlog v2). Libellé du réglage corrigé (il promettait « même l'app fermée »). |
| D5 | ✅ | Les réglages Likes / Commentaires / Reshakes / Abonnés filtrent la cloche, son compteur et les notifs téléphone. |
| E1 | ✅ | Le minuteur d'une story attend que la photo soit chargée (8 s maximum). |
| E2 | ✅ | Story en pause (défilement + son) quand l'appli est masquée, reprise au retour. |
| **LOT 5 — Petits gains visibles** | | |
| A4 | ✅ | Logo cliquable (retour à shakemoi.fr) sur la page d'un son/post partagé, profil partagé, invitation de cercle, confidentialité. |
| A5 | ✅ | Bandeau « SHAKEmoi sur ton écran d'accueil · Télécharger l'app » en haut de l'accueil (membres et visiteurs). Android : fenêtre d'installation directe. iPhone : mode d'emploi en 3 étapes. Caché si l'appli est installée ; « × » le masque 14 jours. |
| H2 | ✅ | Entre 1024 et 1280 px : le menu de droite s'affiche (la colonne Tendances n'apparaît qu'à partir de 1280 px). |
| H3 | ✅ | « Recherche » ajoutée au menu ordinateur. |
| H4 | ✅ | Sur écran tactile, les boutons lecture des pochettes sont toujours visibles (14 endroits, une règle CSS). |
| K1 | ✅ | « Shake de la semaine » partout ; la popup revient une fois par semaine (mardi 11 h Paris), plus chaque jour. |
| G5 | ✅ | Erreurs de connexion/inscription en français (« Email ou mot de passe incorrect », « Confirme d'abord ton email », etc.). |
| G6 | ✅ | Premier lancement : le Shake de la semaine attend que « Compléter ton profil » soit fermé. |
| F4 | ✅ | Like instantané (fil, détail d'un post, story) ; deux taps rapides ne se contredisent plus ; retour en arrière si le serveur refuse. |
| **LOT 6 — Comptes et contenus** | | |
| G1 | ✅ | « Mot de passe oublié ? » sous le mot de passe → email avec lien → au retour, fenêtre « Nouveau mot de passe ». ⚠️ Vérifie dans Supabase > Authentication > URL Configuration que `https://www.shakemoi.fr` est bien l'URL du site. |
| G2 | 🟡 | Règle appliquée dans l'appli (inscription + modification, minuscules auto) ET en base (déclencheur) pour les nouveaux pseudos et les changements. Les liens /u/ trouvent le profil sans tenir compte des majuscules. **Pseudos existants (27/30 avec majuscules) : script prêt, en attente de ton OK.** |
| G3 | ✅ | Changement de pseudo vérifié (règle + doublon, en appli et en base), affiché seulement si la base accepte. Les anciens liens /u/ continuent de marcher tant que le pseudo existe (recherche sans casse). |
| G4 | ✅ | Le profil est créé **par la base en même temps que le compte**. Si un compte existe sans profil (il y en a 1), la connexion propose « Plus qu'une étape : choisis ton pseudo » au lieu de traiter la personne en visiteur. Réinscription avec le même email : on se connecte et on termine. |
| F1 | 🟡 | Un reshake par personne et par post, jamais le sien (bloqué en base). Le bouton est coloré quand c'est fait et un 2e appui annule. Sur son propre shake, il est grisé avec un message. **3 anciens reshakes interdits (1 doublon + 2 de son propre post) : script de nettoyage en attente de ton OK.** |
| F2 | ✅ | Un reshake sans commentaire n'a plus de légende. Sur la carte, la légende affichée est celle de l'auteur d'origine, et le mot du reshakeur s'affiche à part, à son nom. |
| F3 | ✅ | Compteur de reshakes recalculé par la base (et corrigé pour tous les posts existants). |
| F5 | ✅ | Suppression d'un commentaire par son auteur ou par l'auteur du post (poubelle → « Supprimer / Annuler »). |
| F6 | ✅ | Supprimer un post supprime sa photo (sauf si une story ou un autre post l'utilise encore). |
| C9 | ✅ | (LOT 3) |
| I9 | ✅ | Le fil charge 20 posts, puis les suivants automatiquement en approchant du bas (ou bouton « Voir les shakes plus anciens »). |

| **LOT 7 — S'il reste du temps** | | |
| L1 | ✅ | Déploiement GitHub Pages supprimé (workflow, CNAME, 404.html, script de copie) et site Pages désactivé : il revendiquait encore shakemoi.fr (certificat en erreur). Vercel seul. |
| L3 | ✅ | README réécrit. 16 vieux .md + 26 vieux .sql rangés dans `docs/archive/`. Dossier `backup-v1-before-react` retiré (reste dans l'historique git). |
| L4 | ✅ | Retirés : MUI, Emotion, react-dnd, react-slick, react-popper, masonry. 10 fichiers de composants morts supprimés. |
| L2 | ✅ | 0 erreur de types (`npm run typecheck`) et vérification automatique à chaque push (voir section M). |
| H6, H5, B9, G7, K2, K3, I8 | ⏭️ | Pas eu le temps ce soir. |

## Section M — problèmes vus en testant

| # | Statut | Explication |
|---|---|---|
| M1 | ✅ | **Cause de « MONACO »** : Spotify ne fournit plus d'extrait (0 sur 83 sons) et iTunes ne connaît pas ce titre ; seul Deezer l'a, mais son adresse d'extrait expire au bout d'1 h, donc l'appli gardait « pas d'extrait » en mémoire sur le téléphone → son muet pour toujours. **Correctif** : chaîne Spotify → Deezer (par ISRC, sinon titre + artiste) → iTunes → bouton « Écouter sur Spotify » ; adresse Deezer **stable** `/api/preview?deezer=<id>` qui va chercher un extrait frais à chaque lecture ; source enregistrée en base (`preview_url`, `preview_source`) ; nouveaux posts, stories, messages et cercles passent par la même chaîne. **Bilan du contrôle** (`scripts/check-previews.mjs`) : 83 sons distincts → 79 via Deezer, 2 via iTunes, 0 via Spotify, 2 sans aucun extrait (« Ailleurs » de Krakow, « RESTE-LÀ » de Tiakola). En base : 116 sons sur 125 lisibles (98 posts, 16 stories, 8 messages, 3 messages de cercle), les 9 autres = ces 2 titres. |
| M2 | ✅ | Composant unique `SongCover` (pochette + bouton lecture toujours visible, un seul son à la fois, secours « Écouter sur Spotify »). **Plus aucun embed Spotify** : remplacé dans Messages (privés + cercles), TOP (podium + liste), profil, aperçu de profil, détail d'un post, réactions musicales (×3), Shake de la semaine, colonne TOP ordinateur (l'onglet « Moods », fait de playlists Spotify, est retiré). Création d'un Shake ou d'une story : on écoute l'aperçu en touchant la pochette avant de publier. **Plus aucune lecture automatique** : page d'un son partagé et stories comprises (avant, le son partait tout seul). |
| M3 | ✅ | Compte à rebours en direct en haut à droite de la story, avec un sablier : `00:13:42:07` (JJ:HH:MM:SS), `HH:MM:SS` sous un jour. Rien pour une story épinglée expirée. |
| M4 | ✅ | **Cause** : les vues étaient bien enregistrées (31), mais la règle d'accès ne laissait chacun lire que SES propres vues → la propriétaire ne voyait jamais personne. Et 16 des 31 vues étaient la propriétaire elle-même. **Correctif** : la propriétaire lit les vues de ses stories ; la base refuse qu'on compte sa propre vue (et l'appli ne l'envoie plus) ; les anciennes auto-vues sont ignorées (rien supprimé). Compteur œil + nombre **en bas à droite**, visible par la propriétaire seulement ; un clic ouvre la liste, avec un cœur pour celles et ceux qui ont liké. |
| M10 | ✅ | Like de story → UNE notif par story dans la cloche : « @léa et 4 autres ont aimé ta story ». Chaque nouvelle personne la met à jour, la remonte en haut et la repasse en non lue ; retirer puis remettre un like ne change rien (vérifié en base). Un clic ouvre la story, ou la liste des likes si elle a expiré. Le reste de A2 est inchangé (messages et cercles → pastille Messages seulement). Les 4 anciennes notifs « like de story » non groupées sont masquées. |
| M5 | 🟡 | **Cause** : Google a fermé l'API Tenor (« Tenor API is discontinued ») → la recherche de GIF renvoyait une erreur, donc une liste vide ; les GIF déjà envoyés s'affichent toujours. **Correctif** : relais `/api/gifs` qui parle à KLIPY (remplaçant conseillé par Google) ou GIPHY ; messages privés et cercles branchés dessus ; sans clé, message clair au lieu d'une liste vide. **Il te faut** créer une clé gratuite (klipy.com/developers ou developers.giphy.com — je ne peux pas créer de compte à ta place) et l'ajouter dans Vercel → Settings → Environment Variables : `KLIPY_API_KEY` (ou `GIPHY_API_KEY`), puis redéployer. |
| M6 | ✅ | **Causes** : sur Android le bouton n'apparaissait QUE si Chrome proposait l'installation (ce qu'il ne fait pas toujours) ; sur ordinateur il était caché (`lg:hidden`) ; dans l'appli déjà installée il est caché (normal). Manifeste et service worker valides, évènement Android bien écouté dès le démarrage, détection iPhone correcte. **Correctif** : bandeau toujours visible en haut de l'accueil tant que l'appli n'est pas installée ; installation directe si le navigateur la propose, sinon mode d'emploi adapté (iPhone / Android / ordinateur) ; fermé → revient 7 jours plus tard. **Pour le voir** : iPhone → ouvre shakemoi.fr dans **Safari** (pas l'appli installée) ; Android → Chrome, shakemoi.fr ; si tu l'avais fermé, il revient après 7 jours (ou vide les données du site). |
| M7 | ✅ | Ordinateur : colonne de gauche = Messages + Groupes (conversations récentes avec pastilles de non-lus, cercles ; clic = ouvre), mise à jour en direct. TOP déplacé à droite sous le menu (pochettes jouables). Recherche, Messages, Profil, TOP présents de 1024 px à grand écran. |
| M8 | ✅ | Pas de champ caché ni de `contentEditable` : c'était le curseur texte du navigateur sur tout le texte (et le curseur clignotant si la « navigation au curseur », F7, est active). Règle CSS globale : flèche partout, main sur les liens/boutons, curseur texte et clignotement seulement dans les vrais champs. |
| M9 | ✅ | Logo : connecté → retour à l'accueil + fil rechargé + retour en haut (aussi le bouton Accueil du menu ordinateur) ; visiteur → lien vers l'accueil ; pages publiques → shakemoi.fr (A4). |
| L2 | ✅ | (fini au passage) 0 erreur de types ; vérification automatique à chaque push (`.github/workflows/check.yml` : types + compilation). |

## Backlog v2 (hors périmètre ce soir)
- ~~J1 Bloquer / Signaler~~ → fait (P17, 02/10).
- ~~D4 / D6 vraies notifications push~~ → fait (P7, 01/10).
- G9 Connexion Google / Apple.
- **Idées validées pour plus tard (prompt du 01/10)** :
  - Lecture continue façon Reels dans le fil : à la fin d'un son, le suivant se lance et le fil défile jusqu'au post ; passer au suivant (bouton + écran verrouillé) ; aucune barre ajoutée (au plus une petite pochette ronde flottante pendant la lecture quand on change d'onglet). Le moteur d'enchaînement de la playlist du cercle (P21) est réutilisable.
  - « Il y a 1 an, tu partageais… ».
  - Blind test dans les cercles.
- **À planifier pour une nuit dédiée** : analyse d'usage (PostHog), sauvegarde hebdomadaire de la base, limites anti-spam, optimisation des 71 règles d'accès.
- Thèmes du Shake de la semaine (P23) : il faut une petite table « thème de la semaine » — décision de Kenny.

## Scripts validés par Kenny (nuit du 29 au 30/09)
| # | Statut | Explication |
|---|---|---|
| 1. Pseudos en minuscules | ✅ | Appliqué. 0 pseudo hors règle, noms d'affichage intacts, 28 anciens pseudos gardés → `/u/Ancien` redirige. Rangé dans `supabase/applied/`. |
| 2. Reshakes en double | ✅ | Appliqué. 3 reshakes supprimés (liste dans MATIN.md), leur commentaire et leurs 2 likes déplacés sur le post d'origine, 0 compteur faux. Rangé dans `supabase/applied/`. |
| 3. Avatars | 🟡 | Simulation faite : 5 avatars lourds, **13,7 Mo → 42 Ko**. L'envoi réel demande la clé secrète « service_role » que je n'ai pas le droit de lire → une commande à lancer (voir MATIN.md). |

## Section O
| # | Statut | Explication |
|---|---|---|
| O1 | ✅ | Tuto fait + appli d'écoute enregistrés **dans le profil** (`onboarding_completed_at`, `preferred_streaming_app`) : plus jamais rejoué après une déconnexion ou sur un autre téléphone. Les 30 comptes existants sont marqués « tuto fait » avec leur appli reprise (21 Spotify, 4 Apple Music, 4 YouTube Music, 1 Deezer). Paramètres → « Revoir le tuto » (choix pré-rempli, retour aux paramètres). Un clic sur une autre plateforme ne change plus l'appli du profil en douce. |
| O2 | ✅ | Tuto plein écran : 4 écrans + choix de l'appli, visuels animés légers (vinyle, pochette qui joue, réactions, cercles), glisser gauche/droite, barre de progression, « Passer », flèches clavier sur ordinateur. 7 applis en grandes tuiles avec **logos officiels** (Simple Icons, libres de droits ; Amazon Music : version simplifiée, Amazon ne publie pas son logo). Les mêmes logos dans les paramètres, la page d'un son, et **tous** les boutons « ouvrir dans mon appli » (fil, profil, TOP, post, commentaires, messages, stories). Secours sans extrait : « Écouter sur <ton appli> ». |
| O3 | ✅ | Une réponse en musique = un commentaire partout : compteur calculé en base (texte + musique, sur ajout ET suppression), notification « a répondu en musique à ton shake » (ouvre le post), liste avec pochette jouable, suppression par son auteur ou l'auteur du post. Test en base : 1 texte + 1 musique = 2 ✓, suppression → 1 ✓. **4 posts corrigés.** Au passage (sécurité) : commentaires, likes et réponses en musique ne sont lisibles que si on peut voir le post. |

## Mode nuit — corrections
| # | Statut | Explication |
|---|---|---|
| N-P1 Reshakes comptés comme shakes (vu par Kenny) | ✅ | Cause : la liste « Shakes » d'un profil ramenait aussi les reshakes. Corrigé partout : onglet Shakes, compteur de ton profil, aperçu d'un profil, page publique `/u/…` et carte de partage. Au passage : le compteur de l'aperçu plafonnait à 9 et celui du profil à 50 → vrai nombre maintenant. |
| N-S1 Ancienne fonction serveur (Figma Make) | ✅ | **Critique** : encore en ligne avec la clé secrète, elle permettait à n'importe qui de lister les emails des comptes. Neutralisée (répond 410). Idem `calculate-compatibility` (inutilisée, cassée). À supprimer du tableau de bord Supabase quand tu veux. |
| N-S2 Commentaires comptés double | ✅ | L'appli ajoutait +1 après le recomptage de la base. Retiré ; la fonction ancienne recompte (pas de casse pour une appli en cache). |
| N-S3 Compteurs d'abonnés faux | ✅ | 4 déclencheurs se marchaient dessus → colonne stockée fausse (ex. 37 au lieu de 18). Un seul déclencheur qui recompte, 30 profils recalculés. (L'écran profil affichait déjà le vrai nombre ; la colonne servait à « Envoyer à un ami » et au tri de la recherche.) |
| N-S4 Triche sur les compteurs | ✅ | On ne peut plus modifier soi-même ses abonnés, séries, likes/commentaires/reshakes (colonnes verrouillées). Testé : refusé. |
| N-S5 Cercles | ✅ | Une personne retirée par la créatrice ne peut plus revenir seule avec l'ancien lien (message clair) ; si un membre la rajoute, c'est rouvert. |
| N-S6 Faux liens « Écouter sur … » | ✅ | N'importe qui pouvait créer une page shakemoi.fr/s/… qui menait vers un faux site. Seuls les liens des vraies plateformes sont gardés (testé). |
| N-S7 Stockage photos | ✅ | Taille et types limités (plus de SVG/HTML/gros fichiers), chacun n'écrit que dans son dossier. |
| N-S8 Divers | ✅ | Règles trop larges retirées (humeurs, artistes, capsules), vues de story seulement sur une story visible, fonctions internes plus appelables de l'extérieur, images de la carte de partage filtrées, lien de secours en https seulement. |
| N-N1 Retour du téléphone (N2) | ✅ | 12 fenêtres (post, profil, commentaires, composer, paramètres, partage, reshake, envoyer à un ami, Shake de la semaine, réponses en musique, modifier le profil, feuille de partage) : le retour les ferme au lieu de quitter l'appli. |
| N-N2 iPhone (appli installée) | ✅ | En-tête plus caché sous l'heure / Dynamic Island ; la barre du bas réserve sa vraie hauteur (champs de saisie des messages et bas des listes n'étaient plus à moitié cachés). |
| N-N3 Shake raté affiché « publié » | ✅ | Le composer lisait mal le résultat : maintenant message clair en français, rien de perdu en silence. Même chose pour un commentaire non envoyé et « Suivre » refusé (limite de 100). |
| N-N4 Cercles | ✅ | Discussion qui clignotait à chaque message ; cercle créé en double au retour de l'étape 2 ; « Quitter » sans confirmation et cercle resté dans la liste ; lien de cercle qui montrait « Rejoindre » à un membre. |
| N-N5 Ordinateur | ✅ | Recliquer sur la même conversation la rouvre ; bouton + qui recouvrait le TOP ; colonne gauche et TOP plus chargés sur téléphone (économie de données). |
| N-N6 Textes + accessibilité | ✅ | « Messages » au lieu de « DMs », « Chargement des shakes », « Ce shake n'existe plus », « limite de 100 abonnements » ; 50 boutons à icône seule ont un libellé. |
| N-T1 Tests automatiques | ✅ | Playwright (`npm run test:e2e`) : accueil sans compte, lien de son partagé, profil public, ancien lien `/u/Kenny`, aperçu de lien — téléphone 390 px + ordinateur. **10/10 OK** sur shakemoi.fr. Connexion testée seulement si tu fournis `E2E_EMAIL` / `E2E_PASSWORD` (je n'utilise pas de vrai mot de passe). |

## M11 — incohérences entre écrans (audit de la nuit)
| # | Statut | Explication |
|---|---|---|
| M11-1 Likes des messages de cercle | ✅ | Le compteur restait à 0 (mise à jour refusée sans bruit). Tenu par la base maintenant ; 2 messages corrigés ; cœur + chiffre mis à jour tout de suite, annulés si refus. |
| M11-2 Reshake : chiffres différents fil / profil | ✅ | Profil (onglet Reshakes), aperçu d'un profil et détail : un reshake montre et agit sur le **post d'origine** (likes, commentaires, partage), comme le fil. Une notification qui pointe sur un reshake ouvre l'original. |
| M11-3 Détail d'un shake | ✅ | Le compteur de commentaires compte aussi les réponses en musique (comme le fil). |
| M11-4 TOP | ✅ | TOP, tendances des amis et bilan de la semaine : plus jamais de post privé ou de cercle ; bilan compté comme le profil. |
| M11-5 Suivre | ✅ | Refus (limite de 100, réseau) signalé partout : Recherche, notifications, page d'un son, profil, aperçu. |
| M11-6 Dates | ✅ | Un seul format partout : « À l'instant », « 5min », « 3h », « 2j », puis « 12 sept. » (avant : 5 formats, dont « 245j » ou une date fixe 5 minutes après). |
| M11-7 Avatars | ✅ | Pages publiques : petite image + initiale comme ailleurs (« % » pour un pseudo accentué corrigé). |
| M11-8 Like du profil | ✅ | Protégé du double tap, annulé si refusé. |
| M11-9 Anciennes interactions sur des reshakes | 🟡 | 9 likes et 2 commentaires (avant avril) sont restés attachés à des lignes de reshake. Plus visibles nulle part depuis M11-2. Les déplacer vers les posts d'origine = modification de données → **ton OK** (même méthode que le script 2). |
| M11-10 Cache du fil | ⏭️ | Supprimer un shake depuis le profil : le fil l'affiche encore une seconde, jusqu'à son rafraîchissement automatique. Petit, noté pour plus tard. |

---

# Section P — soirée du 01/10/2026

Légende : ✅ fait · 🟡 partiel · ⏭️ reporté à la prochaine session · ⏳ pas encore traité

## Étape 0 — travail de Jerry (patch de l'après-midi)
| # | Statut | Explication |
|---|---|---|
| Patch | ✅ | `git am` sans conflit (6 commits). Types + build verts. Relu et corrigé ci-dessous. |
| P5 | ✅ | Plus aucun « Groupe(s) » visible (appli, notifications, base) : vérifié par recherche dans tout le code et les fonctions SQL. |
| P13 tri | ✅ | La « requête par cercle » est remplacée par **une seule fonction SQL** `get_my_circles` : cercles triés par dernier message, avec le dernier message (« @léa : 🎵 Lithe ») et le nombre de non-lus. Même liste sur téléphone et ordinateur, qui remonte en direct à chaque message. |
| P12 retrait | ✅ | La règle de base existait déjà pour l'auteur ; ajouté : le **créateur du cercle** peut retirer n'importe quel message (modération). Le fichier « en attente » de Jerry est appliqué puis supprimé. |
| P8 | ✅ | Fonction `rename_circle` appliquée : tout membre renomme, **seulement le nom** (testé : un membre non créateur ne peut pas toucher au code d'invitation). Le message « @kenny a renommé le cercle en … » apparaît dans la discussion (nouveau type de message « système », qu'un membre ne peut pas fabriquer : testé, refusé). L'en-tête suit en direct chez les autres. |
| P14 (accès) | ✅ | Vérifié : la règle de lecture des posts laisse lire tous les posts **publics** → « Tout SHAKEMOI » est bien différent d'« Amis ». Les reshakes sont des lignes de posts : ils comptent dans « sons les plus shakés ». (Le TOP sera recalculé en base au lot 6.) |
| B5 | ✅ | Vérifié dans la base : l'espace `circle-media` est **privé** ; `getPublicUrl` ne sert qu'à fabriquer l'adresse, l'affichage passe toujours par un lien signé (1 h). Messages privés (`dm/…`, lisibles par les 2 personnes) et cercles (`circle-<id>/…`, membres seulement). |
| Trouvaille | ✅ | **Le temps réel des messages privés et de la cloche ne marchait pas** : les tables `messages` et `notifications` n'étaient pas publiées dans Supabase Realtime. Ajoutées (+ `circles` pour le renommage). Conséquence : nouveau message, pastille et cloche se mettent à jour en direct. |

**Tests (étape 0)**
1. Dans un cercle dont tu n'es pas le créateur : Paramètres → change le nom → « Tu as renommé le cercle en … » apparaît, l'autre membre le voit en direct et l'en-tête change chez lui.
2. Onglet Cercles : chaque ligne montre le dernier message et l'heure ; envoie un message dans le cercle du bas → il remonte en haut.
3. Depuis un 2ᵉ compte, envoie-toi un message privé appli ouverte : la pastille Messages s'allume tout de suite (avant : il fallait recharger).

## Lot 1 — P7 + P6 : vraies notifications push
| # | Statut | Explication |
|---|---|---|
| P7 | ✅ | **Web Push complet, même appli fermée.** Base → déclencheurs → Edge Function `push` → Google / Apple / Mozilla. Envoyé pour : chaque notif de la cloche (likes, commentaires, réponses en musique, reshakes, abonnés, cercles), chaque **message privé**, chaque **message de cercle**, chaque **like de message**. Like de Shake éphémère groupé (M10) : une seule notif mise à jour (« @léa et 3 autres… »), pas 10. Toucher la notif ouvre le bon endroit (post, conversation, cercle, Shake éphémère, profil). Abonnements expirés (404/410) supprimés automatiquement (testé en vrai). |
| Clés | ✅ | **Rien à configurer pour toi** : les clés VAPID ont été générées par la fonction elle-même et rangées dans le **coffre Supabase (Vault)**, comme le secret entre la base et la fonction. Aucune clé privée dans le code ni dans le dépôt, et personne ne l'a vue. |
| Chiffrement | ✅ | Écrit sans bibliothèque (norme Web Push), testé en local (`node scripts/test-webpush.ts` : chiffrement → déchiffrement OK, signature OK) et en vrai contre le serveur de Google. |
| P6 | ✅ | En haut de l'onglet Notifications : interrupteur **« Notifications sur le téléphone »**. L'activer demande l'autorisation puis enregistre ce téléphone ; une **notif de test** arrive tout de suite. Le désactiver coupe ce téléphone seulement. L'état est le vrai : refusé (avec quoi faire), iPhone pas installé (« Installe d'abord l'appli sur ton écran d'accueil »), navigateur incompatible. Lien vers les réglages détaillés. |
| D5 | ✅ | Les réglages (likes, commentaires, reshakes, abonnés, **messages privés**, **cercles**, rappel de série) sont maintenant **en base** et respectés par le serveur. Enregistrés dès qu'on touche l'interrupteur. |
| Divers | ✅ | Ceux qui avaient activé les anciennes notifs « appli ouverte » passent automatiquement aux vraies (si l'autorisation est déjà donnée). Déconnexion = ce téléphone ne reçoit plus les notifs du compte. Appli à l'écran : pas de notif système en double (les pastilles suffisent). |

**Test précis P7 (Android Chrome ou iPhone avec l'appli installée, iOS 16.4+)**
1. Onglet Notifications → active « Notifications sur le téléphone » → accepte → tu reçois « C'est activé ! … ».
2. **Ferme complètement l'appli** (balaye-la).
3. Depuis un 2ᵉ compte, like un de tes shakes → tu reçois « @lautre a aimé ton shake « Titre » ». Touche-la : l'appli s'ouvre sur le post.
4. Depuis le 2ᵉ compte, envoie-toi un message → notif « @lautre » avec le texte ; la toucher ouvre la conversation.
5. Paramètres → Notifications → coupe « Likes » → refais un like depuis le 2ᵉ compte : rien n'arrive.

## Lot 2 — P1 + P2 : profil complet et post complet
| # | Statut | Explication |
|---|---|---|
| P1 | ✅ | **Un seul composant de fil de profil** (`ProfileGrid`) pour mon profil ET celui des autres : onglets Shakes / Reshakes, grille de pochettes, **chargement au fil du défilement** (24 par 24, testé sur 16 shakes en pages de 5 : 5 → 10 → 15 → 16, sans doublon). L'aperçu de profil devient un **grand panneau presque plein écran** sur téléphone (96 % de la hauteur), une fenêtre haute et centrée sur ordinateur, avec tout le fil, les Shakes éphémères, Suivre, **Message**, et un bouton **« Profil complet »** qui passe en page entière. Jamais de post privé ou de cercle (filtré dans la requête + règles de la base). |
| P1 partout | ✅ | Le profil s'ouvre maintenant aussi depuis : l'auteur d'un post en détail, les commentaires (texte et musique), la liste des likes. (Fil, recherche, notifications, abonnés : déjà. Messages, cercles, TOP et Shakes éphémères : branchés avec leurs lots 4, 6 et N1.) |
| P2 | ✅ | Toucher une pochette (mon profil ou un autre) ouvre **le post en détail** avec tout : écouter (M2, pochette = notre lecteur), liker (compteur juste), commenter et répondre en musique, voir tous les commentaires, **reshaker (nouveau, annulable)**, partager, **envoyer à un ami (nouveau)**, ouvrir dans mon appli (logo O1), supprimer si c'est le mien. Le **retour** ferme le post et ramène au profil à la même position (testé). Like/reshake faits dans le détail : la grille suit. |
| Trouvaille | ✅ | **Les reshakes n'affichaient pas le post d'origine** dans les requêtes : la jointure `posts!original_post_id` renvoyait une liste vide (le fil le contournait avec **une requête de plus par reshake**). Corrigé aux 4 endroits (fil, profil) : moins de requêtes, et l'onglet Reshakes d'un ami montre bien les pochettes et l'auteur d'origine (testé : 7 reshakes de @kenny avec @raph, @bapt22…). |

**Tests (lot 2)**
1. Ouvre le profil d'un ami depuis le fil : grand panneau, fais défiler jusqu'en bas → tous ses shakes arrivent. Onglet Reshakes → les pochettes et le @ de l'auteur d'origine.
2. Touche une pochette → le post complet. Like → +1 ; reshake → le bouton devient rose (re-touche pour annuler) ; commente ; réponds en musique ; « Écouter » ouvre ton appli. Fais **retour** → tu es sur le profil, au même endroit.
3. Dans le post, touche le nom de l'auteur → son profil s'ouvre par-dessus ; retour → le post.
4. « Profil complet » → page entière ; retour → fermé.
5. Mon profil : touche une de mes pochettes → poubelle → supprimé, le compteur Shakes baisse.

## Lot 3 — P3 + P4 : abonnés en commun, listes des autres
| # | Statut | Explication |
|---|---|---|
| P3 | ✅ | Sur le profil d'une autre personne : **« Suivi par Léa, Bapt et 4 autres »** avec 3 mini-avatars. Un toucher ouvre la liste complète des abonnés en commun (avatar, nom, @, Suivre, toucher = profil). Calculé **en base** (`get_mutual_followers`), pas en chargeant les listes dans le téléphone. Testé : @kenny et @raph ont 15 abonnés en commun. |
| P4 | ✅ | Les compteurs **Abonnés** et **Suivis** des autres sont cliquables. Une seule feuille (aussi pour mon profil) : avatar, nom, @, **badge « Vous suit »**, bouton Suivre / Suivi, **les gens que je suis en premier**, **recherche** (pseudo ou nom), pages de 30 avec chargement au défilement. Sur mon profil, la liste de mes abonnés garde « Retirer ». Calcul en base (`get_follow_list`). |
| Accès | ✅ | Vérifié : la table des abonnements ne contient que des identifiants et une date ; les fonctions ne renvoient que pseudo, nom, avatar (aucun email). Elles sont réservées aux personnes connectées. La table reste lisible publiquement comme avant (les compteurs des pages publiques en dépendent) : rien de sensible dedans. |

**Tests (lot 3)**
1. Ouvre le profil de quelqu'un que tes potes suivent : la ligne « Suivi par … » apparaît sous la bio ; touche-la → la liste.
2. Touche « Abonnés » sur son profil → les gens que tu suis sont en haut, « Vous suit » sur ceux qui te suivent ; tape 2 lettres dans la recherche ; suis quelqu'un depuis la liste.
3. Sur ton profil → Abonnés → « Retirer » sur quelqu'un → il disparaît et ton compteur baisse.

## Lot 4 — Messagerie (P26, P27, P28, P9, P12, P8, P10)
**Décision technique** : les messages privés et les cercles utilisent maintenant **le même écran de conversation** (`ChatThread`) et **la même logique** (`lib/chatData.ts`). Avant, c'étaient deux écrans écrits différemment (bulles d'un côté, cartes de l'autre) : impossible de garantir « exactement les mêmes possibilités ». Désormais tout ce qui suit marche à l'identique en privé et en cercle.

| # | Statut | Explication |
|---|---|---|
| P26 | ✅ | Lecture des cercles enregistrée en base (`circle_reads`). **Pastille Messages = conversations non lues + cercles non lus** (`unread_inbox_count`), une pastille par onglet (Messages / Cercles), chaque cercle affiche son nombre de non-lus en gras. **Rien dans la cloche** (A2). Ouvrir un cercle le marque lu : la pastille baisse tout de suite (téléphone et colonne ordinateur). |
| P27 | ✅ | **Répondre** : par le menu, ou en **glissant la bulle vers la droite** (comme WhatsApp ; pas depuis le bord gauche, réservé au retour d'iPhone). Barre « Répondre à … » avec croix. La réponse affiche la citation (auteur + début du texte, ou pochette / photo) ; la toucher remonte jusqu'au message d'origine (en chargeant les plus anciens si besoin) et le surligne. Original retiré → « Message retiré ». Texte, photo, GIF, son. Colonne `reply_to_id` sur les deux tables. |
| P28 | ✅ | En tapant **@** dans un cercle : la liste des membres (filtrée en tapant), on choisit, le @pseudo s'insère. Les @mentions sont **en couleur et cliquables** (ouvrent le profil). Les ids mentionnés sont enregistrés avec le message (`mentioned_ids`, survit à un changement de pseudo). Push « @kenny t'a mentionné·e » **même si le cercle est en sourdine** ; petit **@** rose sur le cercle dans la liste (et la colonne ordinateur). |
| P9 | ✅ | **Double-tap** (double-clic sur ordinateur) sur un message = like, avec un cœur animé ; affiché tout de suite, annulé si la base refuse. Petit cœur + nombre **sous la bulle** ; le toucher retire le like. Sur un son : le toucher de la pochette lance / met en pause (M2), le double-tap se fait sur la bulle (pas sur la pochette, pour ne jamais couper le son). Défilement, appui long et sélection ne déclenchent pas de like. **Messages privés : les likes existent maintenant** (table `message_likes` + compteur tenu par la base, comme les cercles). Règle d'accès : on ne like que dans une conversation / un cercle dont on fait partie (vérifié). Un like reçu allume la **pastille Messages** (pas la cloche) et envoie une notif push groupée par message. |
| P12 retirer | ✅ | « Retirer le message » dans le **même menu** en privé et en cercle. Par son auteur, ou par le **créateur du cercle** (modération), imposé en base (`retract_message`, testé : refusé sur le message de quelqu'un d'autre). Chez tout le monde, **en direct**, la bulle devient « Message retiré » ; la photo est supprimée du stockage quand c'est l'auteur qui retire. |
| P12 audit 1 | ✅ | **Menu sur appui long** (ou clic droit, ou « ⋯ » au survol sur ordinateur), identique partout : Répondre, Copier, Liker / Retirer mon like, Voir les likes, Retirer. (« Signaler » arrive avec P17.) |
| P12 audit 2-3 | ✅ | Répondre (P27) et retirer dans les cercles (ci-dessus). |
| P12 audit 4 | ✅ | **« Vu à 14:32 »** sous mon dernier message en privé ; **« Vu par 3 »** / « Vu par tout le monde » en cercle, avec la liste au toucher. Mis à jour en direct. |
| P12 audit 5 | ✅ | **« … est en train d'écrire »** en temps réel (canal Supabase, rien n'est écrit en base). |
| P12 audit 6 | ✅ | **Sourdine** (cloche dans l'en-tête de chaque conversation / cercle) : plus de push ni de pastille pour elle (une @mention passe quand même). Icône 🔕 dans les listes. |
| P12 audit 7 | ✅ | Séparateur **« Non lus »** à l'ouverture (on arrive dessus) et bouton **« ↓ N nouveaux messages »** quand on a remonté. |
| P12 audit 8 | ✅ | @mentions (P28). |
| P12 audit 9 | ✅ | **Envoyer un son dans un cercle** exactement comme en privé (recherche, pochette, lecture M2, liens de toutes les plateformes, logo de mon appli). |
| P12 audit 10 | ✅ | **Infos du cercle** (toucher l'en-tête ou ⚙️) : photo, nom (P8), lien d'invitation + partage + code, **membres avec leur rôle** (Créateur / Membre), ajouter quelqu'un, retirer (créateur), quitter, **supprimer le cercle** (créateur, tape SUPPRIMER, imposé en base). |
| P8 | ✅ | Renommer depuis les infos (tous les membres) ; « Kenny a renommé le cercle en … » dans la conversation ; le nouveau nom suit **en direct** partout (en-tête, listes, colonne ordinateur). |
| P10 | ✅ | Glisser entre Messages et Cercles : **les listes et l'indicateur suivent le doigt en direct**, ça résiste aux bords, ça se cale à la fin du geste. Seulement sur les listes, jamais dans une conversation ; les bords de l'écran restent au geste retour ; un geste vertical fait défiler. L'onglet est **gardé à l'actualisation**. Gestes natifs, aucune bibliothèque ajoutée (`useSwipeTabs`, réutilisé pour le TOP). |
| Trouvailles | ✅ | La liste « qui a liké » d'un message de cercle appelait une fonction SQL **qui n'existe pas** (toujours vide) : remplacée. Le bouton + ouvrait « nouvelle conversation » ET « nouveau cercle » en même temps (l'un caché) : un compteur par onglet. Le retrait d'un membre était proposé à tous alors que seul le créateur peut le faire : bouton réservé au créateur. |

**Testé ici** : composant monté avec de faux messages (double-tap 2 → 3, toucher le cœur 3 → 2, menu complet sur mon message, sans « Retirer » sur celui d'un autre, barre « Répondre », séparateur « Non lus », « Vu par tout le monde », @mention qui se complète) ; requêtes validées par la base ; fonctions SQL testées avec un vrai compte (dans une transaction annulée).

**Idées en plus (pas faites, pour plus tard)** : réactions emoji au choix (pas seulement ❤️), messages vocaux, épingler un message dans un cercle, transférer un message ou un son, rechercher dans une conversation.

**Tests (lot 4)** — à deux téléphones (toi + un 2ᵉ compte)
1. Messages privés : double-tap un message → cœur animé + « ♥ 1 » sous la bulle chez vous deux ; re-touche le cœur → retiré. La pastille Messages s'allume chez l'autre quand tu likes.
2. Glisse une bulle vers la droite → « Répondre à … » ; envoie → la citation apparaît ; touche-la → ça remonte au message d'origine qui clignote.
3. Appui long sur ton message → Retirer → « Message retiré » chez l'autre en direct.
4. Commence à écrire → chez l'autre, « est en train d'écrire… ». Envoie → chez toi « Envoyé » puis « Vu à 14:32 » quand il ouvre.
5. Cercle : tape « @ » → la liste des membres ; choisis → envoie → le @ est en couleur ; le membre mentionné voit un @ rose sur le cercle et reçoit une notif même si le cercle est en sourdine.
6. 🔔 en haut d'une conversation → sourdine : plus de notif ni de pastille pour elle.
7. Remonte loin dans une conversation pendant que l'autre écrit → bouton « ↓ 1 nouveau message ».
8. Infos du cercle : renomme, ajoute un ami, partage le lien ; (créateur) supprime un cercle de test.
9. Onglet Messages : glisse doucement vers la gauche → la liste et le trait rose suivent ton doigt ; relâche à mi-chemin → ça revient ; actualise → tu restes sur Cercles.

## Lot 5 — P11 (cadrage des miniatures) + P13 (colonnes ordinateur)
| # | Statut | Explication |
|---|---|---|
| P11 cause | ✅ | **Vérifié en base** : le cadrage des Shakes éphémères est déjà « cuit » dans l'image publiée (pas en cause). Le vrai problème : **les avatars n'avaient aucun outil de cadrage** et les 6 photos de profil en ligne sont **verticales** (captures d'écran, ex. 1080 × 2520). Le rond n'en montrait que le milieu, souvent sans le visage ; et 4 endroits (réponses en musique, détail d'un post, membres d'un cercle…) **écrasaient** l'image (pas de `object-cover`). |
| P11 exemples | ✅ | **@bapt22** : avant, le rond montrait le chapeau et coupait le sourire ; après, tout le visage. **@fawn28** : avant, le haut du visage coupé ; après, visage entier. (@kenny : la capture d'écran est bien gérée, le rond garde la photo de plage et pas le bandeau du téléphone.) Comparé sur les vraies images : « milieu » (avant) / « attention » / « entropie » → l'**entropie** est la seule bonne dans les 3 cas, retenue. |
| P11 correctif 1 | ✅ | `/api/img` sait rendre un **carré recadré sur la zone la plus détaillée** (`sq=1`) : tous les avatars et vignettes rondes de Shakes éphémères passent par là (`avatarThumb`, 51 endroits). Corrige **toutes les photos existantes tout de suite**, sans toucher aux fichiers ni avoir besoin de ta clé. |
| P11 correctif 2 | ✅ | **Outil de cadrage à l'envoi** (photo de profil, inscription, photo de cercle) : on glisse / pince / zoome dans un carré (le rond montre ce qu'on verra), et on enregistre **l'image déjà recadrée** (512 × 512). Testé : la partie choisie est exactement celle enregistrée. |
| P11 correctif 3 | ✅ | Plus aucune image déformée : `object-cover` partout (vérifié par un script qui parcourt toutes les images de l'appli). Photos de posts et de messages : déjà en `object-cover` centré, rien à corriger. |
| P13 causes | ✅ | Trois causes trouvées en lisant le code : (1) **course entre clics** — chaque clic relisait le profil en ligne, la réponse la plus lente gagnait et ouvrait la **mauvaise** conversation ; (2) **un seul état « conversation ouverte » pour Messages ET Cercles** : ouvrir un cercle depuis la colonne pendant qu'un privé était ouvert laissait l'écran incohérent ; (3) la colonne **devinait** ce qui était ouvert (pas de surbrillance des cercles, surbrillance fausse après un retour). |
| P13 correctif | ✅ | **Une seule source de vérité** (`activeChat`) : la conversation ouverte la déclare, la colonne la lit (surbrillance juste, cercles compris). Seul le **dernier clic** compte. Un état « ouvert » par onglet. Le bouton « Messages » du menu ramène à la liste. La colonne se met à jour en direct : nouveau message, message lu ou retiré, **ajout à un cercle, cercle renommé**, likes reçus (rechargements regroupés, jamais une vieille réponse par-dessus une récente). Un cercle qu'on vient de rejoindre s'ouvre (la liste se recharge). |
| P13 TOP | ✅ | Colonne de droite : toucher le titre d'un son du TOP ouvre le post complet. |
| P13 test | 🟡 | Test Playwright prêt (`e2e/desktop-inbox.spec.ts`, 1280 et 1440 px) : clics rapides puis un par un, vérifie que le titre ouvert est chaque fois le bon. **Il lui faut un compte de test** (`E2E_EMAIL` / `E2E_PASSWORD` avec au moins 3 conversations ou cercles) : sans, il est sauté. |
| P13 tri | ✅ | (étape 0 + lot 4) cercles triés par dernier message en base, remontent en direct ; conversations privées pareil (un like reçu les fait aussi remonter). |

**Tests (lot 5)**
1. Ordinateur (≥ 1280 px) : clique vite sur 3 conversations de la colonne de gauche → c'est la dernière cliquée qui s'ouvre, et elle est surlignée. Clique un cercle → il s'ouvre et se surligne ; reviens à un privé → idem.
2. Pendant qu'un cercle est ouvert, quelqu'un le renomme → la colonne et l'en-tête changent tout seuls.
3. Ton profil → Modifier → change de photo : une fenêtre de cadrage s'ouvre, place ton visage dans le rond → OK. Partout (fil, commentaires, messages), le rond montre exactement ce cadrage.
4. Regarde l'avatar de @bapt22 dans le fil : on voit tout le visage (plus seulement le chapeau).

## Lot 6 — P14 : TOP « Amis » / « Tout SHAKEMOI »
| # | Statut | Explication |
|---|---|---|
| Onglets | ✅ | **Amis** (moi + les gens que je suis, ouvert par défaut) et **Tout SHAKEMOI**. On touche ou on **glisse** : la page et l'indicateur suivent le doigt (même mécanique que Messages / Cercles). Onglet et période gardés à l'actualisation ; la période est la même dans les deux onglets. |
| Périodes | ✅ | 7 jours, 30 jours, **Depuis toujours**. (Bug trouvé en testant : sans réglage enregistré, le TOP démarrait sur « Depuis toujours » ; corrigé, 7 jours par défaut.) |
| Calcul | ✅ | **Tout est calculé en base** en une requête (`get_top`) au lieu de télécharger jusqu'à 3 000 posts dans le téléphone. Petit cache de 2 min : changer d'onglet ou de période ne recharge pas en 4G. **Jamais de post privé ni de cercle.** |
| Sons les plus shakés | ✅ | Nombre de fois qu'un son a été **publié + reshaké**, toutes personnes confondues. Un « même son » = même titre (sans « (feat. …) », « - Remastered »…) + même premier artiste : l'album et le single ne comptent qu'une fois. (L'ISRC n'est pas enregistré sur les posts ; l'identifiant Spotify seul séparait le même titre en deux.) Podium + suite du classement, avec qui l'a partagé. |
| Autres classements | ✅ | **Sons les plus likés**, **artistes les plus partagés** (avec le nombre de personnes), **les plus actifs** (un toucher = profil). Chiffres réels vérifiés en base : Tout SHAKEMOI depuis toujours → « Ailleurs » 4×, « Convaincu » 3× ; artistes Krakow 5, Orelsan 4 ; actifs @kenny 16, @raph 15. |
| Lecture / post | ✅ | Chaque son : pochette = notre lecteur (M2), logo de mon appli, bouton Shake. **Toucher une ligne** ouvre le post (s'il n'y en a qu'un) ou **la liste de tous les posts de ce son** (« @léa a shaké », « @bapt a reshaké »), un toucher ouvre le post complet (P2). |
| Genres du moment | ✅ (fini au lot 13) | Nouvelle rubrique **Genres du moment** : familles de genres (Rap, Pop, R&B / Soul, Rock / Indé, Électro…) des sons partagés sur la période, avec le nombre de sons, de personnes, une barre et les 3 artistes phares. Calculé en base dans `get_top` à partir des profils d'artistes de P25. Réel, Tout SHAKEMOI depuis toujours : **Rap 50 sons / 13 pers. (Orelsan, Bad Bunny, HOUDI)**, Pop 12, R&B / Soul 12, Rock / Indé 11, Électro 10, Chanson 9. |

**Tests (lot 6)**
1. TOP : glisse vers la gauche → « Tout SHAKEMOI » (le trait rose suit ton doigt). Choisis « Depuis toujours », reviens sur Amis : la période est gardée.
2. Touche le titre d'un son du podium → la liste des personnes qui l'ont shaké ; touche une ligne → le post complet.
3. Touche la pochette → l'extrait joue ; « Shake » → il est publié sur ton fil.

## Lot 7 — P15 (signaler un bug), P16 (Sentry), P17 (bloquer / signaler)
| # | Statut | Explication |
|---|---|---|
| P17 bloquer | ✅ | Depuis le profil ou l'aperçu de profil (menu « ⋯ ») ; depuis une conversation ou un cercle : toucher l'en-tête / le nom ouvre le profil, puis « ⋯ → Bloquer ». **Imposé en base** (testé avec deux vrais comptes) : elle ne voit plus mes shakes (ni moi les siens), ne peut plus me suivre, m'écrire, liker, commenter, ni m'ajouter à un cercle ; nos commentaires et réponses en musique disparaissent l'un pour l'autre ; **les abonnements dans les deux sens sont retirés** (donc plus de Shakes éphémères non plus). Son profil affiche « Profil indisponible » ; le mien, « Tu as bloqué @x · Débloquer ». Seule exception : dans un cercle qu'on a déjà en commun, les messages du cercle restent visibles (comme un groupe WhatsApp). |
| P17 liste | ✅ | Paramètres → **Personnes bloquées**, avec Débloquer. |
| P17 signaler | ✅ | Une personne (profil « ⋯ »), un shake (drapeau dans le post), un commentaire (petit drapeau), un message privé ou de cercle (menu de l'appui long), un Shake éphémère (drapeau en haut). Motifs : spam, harcèlement, contenu choquant, faux compte, autre + texte facultatif. Une **copie du contenu** est gardée avec le signalement (si l'auteur l'efface, tu sais quoi). Personne d'autre que toi ne peut les lire (testé). |
| P17 cercle | ✅ | Le créateur d'un cercle peut déjà retirer n'importe quel message (P12) ; les signalements de messages de cercle arrivent dans ta page admin. |
| P15 | ✅ | Paramètres → **Signaler un bug** (et dans le menu « ⋯ » des profils) : un texte, une capture en option (galerie), et automatiquement : téléphone, navigateur, version de l'appli (désormais la vraie : version + commit), appli installée ou non, écran en cours, taille d'écran, compte. Message « Merci ! Kenny regarde ça 🙏 ». Table `bug_reports`, captures dans un **espace privé** (`bug-screens`). Capture **automatique** de l'écran : pas faite (il faudrait une bibliothèque lourde de ~50 Ko), la galerie suffit. |
| P15 admin | ✅ | Paramètres → **Admin : bugs et signalements** (la ligne n'apparaît que pour toi ; la base refuse la lecture à tout autre compte, testé). Onglet Bugs : date, personne, texte, capture, infos techniques, statut **nouveau / vu / réglé**. Onglet Signalements : motif, qui, contre qui, copie du contenu, actions **Masquer** (retire le contenu) / **Ignorer**. |
| P16 | 🟡 code prêt, clé à créer | Sentry est branché mais **ne fait rien tant que la clé n'est pas là** (le code est même retiré du site : 0 octet en plus). Une fois la clé ajoutée : erreurs JavaScript, plantages React avec un écran propre **« Oups, on recharge »** au lieu d'un écran blanc, pannes serveur (5xx). Vie privée : seulement l'identifiant (jamais l'email ni le pseudo), adresses sans paramètres, emails et jetons effacés des messages d'erreur, pas de console, rien de ce qu'on tape, **pas d'enregistrement vidéo**. Ligne ajoutée dans la page Confidentialité (avec les notifications push). Sources (source maps) envoyées au build Vercel si le jeton est là, puis retirées du site publié. |

### P16 — Ce qu'il te faut faire (10 minutes, clic par clic)
1. Va sur **sentry.io** → « Get started » → crée un compte (gratuit, plan *Developer*). Choisis la région **EU** (Francfort) si on te le demande.
2. Crée un projet : plateforme **React**, nom `shakemoi`, alertes par défaut → « Create Project ».
3. Copie la **DSN** affichée (`https://…@o….ingest.de.sentry.io/…`). Si tu l'as ratée : Settings → Projects → shakemoi → **Client Keys (DSN)**.
4. Note le **slug de l'organisation** (Settings → Organization → *Organization Slug*) et le **slug du projet** (`shakemoi`).
5. Crée un jeton pour les sources : Settings → **Auth Tokens** (ou *Developer Settings → Organization Tokens*) → « Create New Token » → garde les droits proposés (`project:releases`, `org:read`) → copie le jeton (il ne s'affiche qu'une fois).
6. **Vercel** → projet `shak-emoi-aipt` → Settings → **Environment Variables** → ajoute (cocher Production + Preview) :
   - `VITE_SENTRY_DSN` = la DSN de l'étape 3
   - `SENTRY_AUTH_TOKEN` = le jeton de l'étape 5
   - `SENTRY_ORG` = le slug de l'organisation
   - `SENTRY_PROJECT` = `shakemoi`
7. Vercel → Deployments → sur le dernier → « ⋯ » → **Redeploy** (la DSN est lue au build).
8. Vérification : dans l'appli, Paramètres → Admin → bouton **« Test Sentry »** → sur sentry.io, **Issues** : « Erreur de test SHAKEmoi (date) » apparaît en moins d'une minute, avec le vrai nom du fichier source.

**Tests (lot 7)**
1. Depuis un 2ᵉ compte, ouvre ton profil → « ⋯ » → Bloquer. Le 2ᵉ compte ne voit plus tes shakes dans son fil ; ton profil lui affiche « Profil indisponible » ; il ne peut plus t'écrire (le message échoue). Paramètres → Personnes bloquées → Débloquer.
2. Signale un shake (drapeau dans le post), un commentaire et un message → Paramètres → Admin → Signalements : les 3 sont là avec leur contenu ; « Masquer » sur le shake → il disparaît.
3. Paramètres → Signaler un bug → écris, ajoute une capture → « Merci ! Kenny regarde ça 🙏 » → Admin → Bugs : il est là avec la capture et les infos ; passe-le en « Réglé ».

## Lot 8 — P22 (séries), P23 (flamme), P24 (sons épinglés), P21 (playlist du cercle)
| # | Statut | Explication |
|---|---|---|
| P22 bug | ✅ | **Cause du compteur faux** : l'ancien déclencheur comptait des **jours** et se déclenchait **à chaque modification du profil** (changer sa bio pouvait faire monter la série). Supprimé. |
| P22 règle | ✅ | Série = nombre de **semaines d'affilée** avec au moins un vrai Shake (post normal, Shake de la semaine compris, même non publié sur le profil). **Shakes éphémères, reshakes et posts de cercle ne comptent pas.** Semaines = remise à zéro du mardi 9 h UTC. Calcul en base (`get_streak`), copie dans le profil tenue à jour à chaque post ajouté ou supprimé. Si je n'ai pas encore publié cette semaine mais que je l'ai fait la semaine dernière, la série est toujours là (« en jeu »). |
| P22 bilan | ✅ | **Recalcul à partir des posts réels** (avant : toutes les séries à 0). En cours : **@raph 3 semaines** ; @kenny, @theov, @ge2so, @bapt22, @fawn28 : 1 semaine. Meilleures séries : @raph 3, @kenny 3, @johnny 2, @shakemoi 2, et 15 comptes à 1. |
| P22 affichage | ✅ | Badge **flamme violette + chiffre** (icône SVG aux couleurs SHAKEmoi, pas l'emoji) à côté du nom sur mon profil et celui des autres, et dans l'aperçu de profil ; le toucher affiche « 3 semaines de Shake d'affilée » + la meilleure série. Pas de badge si la série est à 0. (Récap P20 et suggestions P18 : avec leurs lots.) |
| P22 rappel | ✅ | Notif push le **lundi vers 19 h (heure de Paris, été comme hiver)** si série ≥ 1 et aucun vrai Shake cette semaine : « Ta série de 5 semaines est en jeu ! ». Respecte les réglages (case « Rappel de série de Shakes » dans Paramètres → Notifications). Tâche planifiée en base (`pg_cron`). Toucher la notif ouvre la fenêtre de la flamme. |
| P23 | ✅ | **Flamme dans l'en-tête**, à côté du bouton de publication, avec le chiffre de la série : **grise** tant que je n'ai pas publié de vrai Shake cette semaine, **violette** dès que c'est fait (se rallume tout de suite après publication). La toucher : ma série, **le temps restant avant la remise à zéro**, et si rien n'est publié, **« Publier mon Shake »** qui ouvre la création. **Le lundi**, si la série est en jeu, la flamme grise **clignote doucement** avec un petit point rose. Pas de bannière, pas de carte en plus dans le fil. La fenêtre automatique du Shake de la semaine ne s'ouvre déjà qu'une fois par semaine (K1). |
| P23 thème | ⏭️ | Il n'existe **aucun thème** de Shake de la semaine en base aujourd'hui (juste « Mon shake de la semaine ») : rien à rappeler dans l'écran de création. Quand tu voudras des thèmes, il faudra une petite table « thème de la semaine » (à décider). |
| P24 | ✅ | **Jusqu'à 3 sons épinglés** en haut du profil (sous la bio) : grandes pochettes jouables (M2), titre + artiste, petite **épingle violette**. Deux façons : **« Épingler un son »** (recherche, pour « En ce moment j'écoute ») ou depuis un de mes posts (bouton épingle dans le post). Toucher un titre épinglé : déplacer à gauche / à droite ou désépingler. Visible par tous ceux qui voient le profil (et aussi dans l'aperçu de profil). En base : table `pinned_songs`, **seul le propriétaire modifie**, 3 maximum, imposé en base (testé). Le poids dans la compatibilité (P25) sera ajouté avec P25. |
| P21 | ✅ | Dans chaque cercle, icône **Playlist** dans l'en-tête : l'écran passe sur la **liste de tous les sons partagés** (plus récent en haut ; pochette, titre, artiste, qui l'a partagé, quand) **en gardant l'en-tête du cercle** ; l'icône bulle (ou le retour du téléphone) revient à la conversation. **« Tout écouter »** enchaîne les extraits (un seul son à la fois, M2 ; un son sans extrait est sauté). **Mini-lecteur fixe** : pochette, titre, artiste, barre de progression (touchable), précédent / lecture-pause / suivant. Un son partagé plusieurs fois n'apparaît qu'une fois (« partagé 3 fois », même titre en « feat. » regroupé). **Appui long** sur un son → le message d'origine dans la conversation, surligné. **Écran verrouillé / centre de contrôle** : pochette, titre, précédent, pause, suivant (Media Session). |
| P21 adresse | ✅ (fait avec N2) | `/cercles/<id>/playlist` : actualiser reste sur la playlist, le retour revient à la conversation. |
| P21 limite | 🟡 | Enchaîner quand le téléphone est verrouillé dépend du navigateur (Safari iPhone peut bloquer le son suivant sans geste) : marche bien appli ouverte. |

**Tests (lot 8)**
1. Regarde ton profil : flamme violette « 1 » à côté de ton nom (tu as publié cette semaine) ; touche-la → « 1 semaine de Shake d'affilée · Meilleure série : 3 semaines ».
2. En-tête : la flamme est violette. Sur un compte qui n'a rien publié cette semaine : grise ; la toucher → temps restant + « Publier mon Shake » ; publie → elle devient violette tout de suite.
3. Lundi soir vers 19 h (téléphone avec notifs activées, série ≥ 1, pas de Shake cette semaine) → notif « Ta série … est en jeu ! ».
4. Ton profil → « Épingler un son » → cherche un son → il apparaît en haut avec l'épingle ; touche son titre → déplace-le / désépingle-le. Ouvre un de tes posts → bouton épingle → « Épinglé sur ton profil 📌 ».
5. Un cercle → icône Playlist → « Tout écouter » : les extraits s'enchaînent ; verrouille le téléphone : la pochette et les boutons sont sur l'écran verrouillé ; appui long sur un son → le message d'origine clignote dans la conversation.


## Lot 9 — P25 (compatibilité), P18 (suggestions), P19 (inviter), P29 (jamais de fil vide)
| # | Statut | Explication |
|---|---|---|
| P25 / N6 | ✅ | Compatibilité musicale **refaite et calculée en base** (avant : calcul dans le téléphone, à partir des seuls noms d'artistes, souvent 0 % ou 100 %). Voir la conception ci-dessous. Recalcul de toutes les paires **toutes les 30 min** (tâche planifiée), lecture instantanée. |
| P25 artistes | ✅ | Nouvelle fonction serveur `enrich-artists` : pour chaque artiste partagé, ses **genres** (Spotify) et ses **artistes proches** (Deezer), rangés dans `artist_profiles`. **87 artistes enrichis**. Repasse toute seule pour les nouveaux artistes. |
| P25 affichage | ✅ | Aperçu de profil : « Compatibilité musicale **88 %** » + **l'explication** (« Vous aimez tous les deux le Rap et la Pop · Romsii, HOUDI, Favé en commun »). Si l'un des deux a moins de 5 sons : « **Pas encore assez de sons** » (avec le nombre de chacun). |
| P18 | ✅ | **Suggestions** dans un seul carrousel discret, avec une bascule « **Amis d'amis** / **Mêmes goûts** » et la raison sous chaque personne (« Suivi·e par @raph et 2 autres », « 88 % de goûts en commun », « Dans ton cercle Potes »). Croix pour masquer (définitif), flamme si la personne a une série. Places : **Recherche** (champ vide), **fil** (une seule fois, après le 4e shake), **aperçu de profil** juste après « Suivre » (« **Suis aussi…** »). Les comptes bloqués et ceux que je suis déjà n'apparaissent jamais (imposé en base). |
| P19 | ✅ | **Inviter des amis** : bouton « Inviter » sur mon profil + « Inviter des amis » dans Paramètres. Lien perso **shakemoi.fr/i/&lt;pseudo&gt;** partagé par la feuille de partage du téléphone (WhatsApp, Insta, SMS…) avec un petit texte, bouton copier, et **QR code plein écran** aux couleurs SHAKEmoi (avatar au centre) pour le montrer en soirée. |
| P19 arrivée | ✅ | Page d'arrivée du lien : « **Kenny t'invite sur SHAKEmoi** », ses **3 derniers sons écoutables**, bouton **Rejoindre**. À l'inscription : **on se suit mutuellement** automatiquement, et l'inviteur reçoit « **@léa a rejoint SHAKEmoi grâce à toi 🎉** » (cloche + notif push). Une seule fois par compte, seulement pour un compte créé il y a moins de 2 jours (pas de triche avec un vieux compte). |
| P29 | ✅ | **Plus jamais de fil vide** : à la fin du tuto d'un nouveau compte, écran « **Suis au moins 3 personnes** » (la personne qui a invité en premier, déjà suivie, puis amis d'amis, mêmes goûts, comptes populaires), un toucher par personne, « Encore 2 » → « C'est parti 🎧 », et **Passer** toujours possible. |

### N6 — la compatibilité en 10 lignes
1. On prend les sons de chacun : posts, reshakes (×0,6), Shakes éphémères et réponses en musique (×0,7), sons **épinglés ×2**, sons des 3 derniers mois ×1,5.
2. Il faut **au moins 5 sons différents** chacun, sinon « Pas encore assez de sons ».
3. Chaque son donne : sa **famille** (Rap, Pop, Rock / Indé… 14 familles), ses **genres fins** (drill, afro trap…), son **artiste**, et le **titre**.
4. Les **artistes proches** comptent aussi, à 35 % (aimer SDM et Leto rapproche, même sans artiste en commun).
5. Un genre que tout le monde a (« pop ») pèse moins qu'un genre rare (méthode TF-IDF).
6. On normalise : quelqu'un qui a 200 sons n'écrase plus quelqu'un qui en a 10.
7. Pour chaque paire, on compare les profils type par type (cosinus).
8. Score brut = 35 % familles + 25 % genres + 25 % artistes + 15 % titres.
9. On l'étale sur 0-100 selon le rang parmi toutes les paires (90+ = les 3 % les plus proches), mélangé à 30 % avec la valeur brute : fini les 0 % et 100 % absurdes.
10. On garde l'explication (familles, artistes en commun, artistes proches) pour l'afficher.

**Scores réels entre les 10 comptes les plus actifs** (7 ont assez de sons ; @coucou 4 sons, @aryamoon 3, @krakow_48 4 : « pas encore assez ») :

| Paire | Score | Pourquoi |
|---|---|---|
| @kenny × @raph | **88** | Rap, Pop, Folk ; Romsii, HOUDI, Favé en commun |
| @kenny × @johnny | 77 | Rap, R&B / Soul, Pop ; HOUDI, Aswell |
| @raph × @johnny | 70 | Rap, Rock / Indé, Pop ; HOUDI ; proches : Stony Stone ↔ HOUDI |
| @kenny × @shakemoi | 66 | Rap, Pop, Afro ; Bad Bunny, C. Tangana, Leto ; proches : SDM ↔ Leto |
| @shakemoi × @raph | 62 | Rap, Pop, Chanson ; Bad Bunny ; proches : Johnny Hallyday ↔ Goldman |
| @raph × @bapt22 | 57 | Rap, Chanson, R&B ; Lithe, Natalia Krakowiak |
| @kenny × @bapt22 | 54 | Rap, R&B, Électro ; Natalia Krakowiak, 808NOCHE |
| @lil_mga × @theov | 42 | Rock / Indé, Reggae, Jazz / Funk (aucun artiste commun) |
| @kenny × @theov | 35 | Rap, R&B, Électro ; Trinix |
| @kenny × @lil_mga | 15 | Rock / Indé, Chanson, Reggae ; Tryo — mais peu de choses en commun |
| @lil_mga × @bapt22 | 8 | juste un peu de Chanson |

**3 exemples expliqués**
- **@kenny × @raph = 88** : mêmes familles en tête (Rap, Pop) et **3 artistes en commun** pas très répandus (Romsii, HOUDI, Favé) → c'est la paire la plus proche de tout SHAKEmoi.
- **@raph × @johnny = 70** : un seul artiste en commun (HOUDI), mais SHAKEmoi sait que **Stony Stone est proche de HOUDI** → ça compte.
- **@kenny × @lil_mga = 15** : @lil_mga écoute surtout chanson, rock et reggae, @kenny surtout du rap : seul Tryo les relie → score bas, et c'est juste.

**Tests (lot 9)**
1. Recherche, champ vide : le carrousel « Personnes que tu pourrais connaître » est en haut ; bascule « Mêmes goûts » ; la croix fait disparaître quelqu'un pour de bon.
2. Ouvre l'aperçu de @raph : « Compatibilité musicale 88 % » + l'explication. Sur un compte avec moins de 5 sons : « Pas encore assez de sons ».
3. Suis quelqu'un depuis son aperçu → « Suis aussi… » apparaît dessous.
4. Profil → « Inviter » → « Partager mon lien » (WhatsApp) ; « Montrer mon QR code » → scanne-le avec un autre téléphone → page « Kenny t'invite sur SHAKEmoi » avec 3 sons qui se jouent → Rejoindre → crée un compte → tuto → « Suis au moins 3 personnes » (tu es en premier, déjà suivi) → toi, tu reçois « … a rejoint SHAKEmoi grâce à toi 🎉 » et vous vous suivez. (Testé en base : abonnement dans les 2 sens, une seule notif, pas de doublon si on recommence.)
5. Fil : après le 4e shake, une seule fois, le petit carrousel de suggestions.

## Lot 10 — P20 : vidéos de partage refaites + récap de la semaine
| # | Statut | Explication |
|---|---|---|
| P20 durée | ✅ | **17 s** : **15 s de son** sur le **passage le plus fort de l'extrait** (souvent le refrain, trouvé en analysant le volume de l'extrait de 30 s), **fondu d'entrée (0,8 s) et de sortie (1,5 s)**, puis **2 s de fin « Écoute sur shakemoi.fr »** avec un grand QR code. Avant : 10 s prises au hasard. |
| P20 design | ✅ | Vrai **1080×1920** (avant 720×1280). **Grande pochette** (en 640 px au lieu de 300) avec **zoom lent** et léger battement sur la musique ; **fond animé aux couleurs de la pochette** (3 couleurs extraites, qui dérivent doucement, voile ajusté si la pochette est claire pour garder le texte lisible) ; **titre + artiste** en grand (« - Remastered 2009 » retiré) ; **avatar + @pseudo** « te fait écouter » ; **barres qui suivent la musique** (aux couleurs de la pochette) ; **logo SHAKEmoi** ; fondu d'entrée de l'image. |
| P20 lien | ✅ | Dans la vidéo : juste **« shakemoi.fr »** court et lisible + **petit QR code dans un coin** (il mène au vrai lien du son). Une fois la vidéo prête, deux boutons : **« Story Insta / TikTok »** → le lien est **copié automatiquement** au moment du partage + message « **Lien copié : colle-le en sticker « Lien » sur ta story** » ; **« WhatsApp, SMS… »** → la vidéo **et** le lien en texte (cliquable). Sur ordinateur : la vidéo est téléchargée et le lien copié. |
| P20 poids | ✅ | Débit réglé pour rester **sous 8 Mo** : testé **4,96 Mo** (Blinding Lights) et **5,1 Mo** (Big Boss Lady), MP4 H.264 + son AAC, 1080×1920, 16,98 s, son présent sur 15 s (vérifié en relisant la vidéo produite). |
| P20 3 pochettes | ✅ | Testé sur **Blinding Lights** (sombre → fond brun/ambre), **Here Comes The Sun** (claire, ciel → fond bleu-vert) et **Big Boss Lady** (très colorée → fond rose), plus Goldman (noir et blanc → couleurs SHAKEmoi). Texte lisible partout. |
| P20 iPhone / Android | 🟡 | Je n'ai pas de téléphone : vérifié dans Chrome (ordinateur) seulement. Le moteur choisit MP4 en priorité (Safari iPhone et Chrome Android récents savent l'enregistrer), sinon WebM, sinon une image. **À tester sur ton iPhone et un Android** (test 1 ci-dessous). Si l'écran se verrouille pendant la création, elle continue mais plus lentement : garder l'écran allumé 17 s. |
| P20 récap | ✅ | Chaque semaine (après la remise à zéro du mardi 9 h UTC), chacun a son récap de la semaine écoulée, calculé en base (`get_weekly_recap`) : **3 sons les plus likés**, **genre du moment** (familles N6, à partir des posts, Shakes éphémères et réponses en musique), **meilleur match musical** (P25), **nombre de Shakes et de likes reçus**, **série** (flamme violette). Seulement si j'ai publié ou reçu au moins un like dans la semaine. |
| P20 carte | ✅ | En haut du fil : « **Ton récap de la semaine est prêt 🎧** » (avec Shakes, likes, genre), croix pour la masquer jusqu'à la semaine suivante. La toucher ouvre le récap **en plein écran façon story** : barres en haut, toucher à droite/gauche pour avancer/reculer, défilement auto toutes les 5 s (appui = pause), écrans Intro → Chiffres → Top 3 (sons jouables) → Genre → Meilleur match (« Voir son profil ») → Série → **Partager**. |
| P20 vidéo récap | ✅ | Bouton **Partager** (aussi en haut à droite de chaque écran) : vidéo story **avec le même moteur et le même design**, sur le son le plus liké : « Ma semaine en musique », le top 3, les chiffres + la flamme, le genre et le meilleur match, puis « **Fais ton récap sur shakemoi.fr** » avec le QR de **mon lien d'invitation** (P19). Mêmes deux boutons de partage. |

**Tests (lot 10)**
1. Sur ton **iPhone** puis sur un **Android** : un post → Partager → « Créer la vidéo » (garde l'écran allumé 17 s) → la vidéo se lit dans la vignette → « Story Insta / TikTok » → choisis Instagram → Story : la vidéo est là avec le son ; le message « Lien copié… » est affiché → ajoute le sticker Lien et colle : le lien du son.
2. Même vidéo → « WhatsApp, SMS… » → WhatsApp : la vidéo part avec le texte et le lien, et le lien est cliquable.
3. Regarde la vidéo jusqu'au bout : 15 s de musique qui démarre et finit en douceur, puis « Écoute sur shakemoi.fr » ; scanne le QR avec un autre téléphone → la page du son.
4. Essaie sur 3 sons très différents (pochette claire, sombre, colorée) : le fond prend les couleurs de chaque pochette.
5. Mardi après 9 h (11 h l'été, heure de Paris), si tu as publié la semaine d'avant : carte « Ton récap de la semaine est prêt » en haut du fil → les écrans défilent → Partager → crée la vidéo. (Exemple réel de la semaine du 22 au 29 septembre : @raph 2 Shakes, 1 like, Rap, meilleur match @kenny 88 %, série 3.)

# Section N (prompt du 29/09)

## N3 — Compteurs de commentaires
| # | Statut | Explication |
|---|---|---|
| Diagnostic Bapt | ✅ | Post de @bapt22 « **Fall Back** » (Lithe, 29/09) : le compteur dit **2**, et **la base est juste** : 1 commentaire texte de @raph (« Ouaiiis ouais », 29/09 21 h 51) **+ 1 réponse en musique** de @raph (« 444 » de Lithe, 30/09 8 h 51). **Cause de la confusion** : la fenêtre des commentaires a deux onglets et s'ouvre sur « Commentaires (1) » ; la réponse en musique est dans l'onglet « Sons (1) », sans rien qui le signale. Même cas que le post de Fawn (Blinding Lights : 1 + 1 = 2). |
| Règle | ✅ | Compteur = commentaires texte + réponses en musique, supprimés exclus. Tenu par la base (déclencheurs qui **recomptent** à chaque ajout/suppression, posés la nuit dernière), jamais un +1 seul côté appli. |
| Appli | ✅ | Le fil faisait encore un **+1 / -1 local** après un commentaire : remplacé par une **relecture du vrai compteur** en base. Dans la fenêtre : bandeau « **+ 1 réponse en musique · Écouter** » sur l'onglet texte, et ouverture directe sur l'onglet Sons quand il n'y a que des réponses en musique. |
| Recalcul | ✅ | Script `scripts/recount_counters.sql` (rejouable dans Supabase → SQL Editor) : recalcule commentaires, likes et reshakes de tous les posts et dit combien étaient faux. Lancé ce soir : **121 posts, 0 compteur faux** (commentaires 0, likes 0, reshakes 0). |
| Likes / reshakes | ✅ | Même vérification : justes partout (likes et reshakes recomptés par déclencheur). |
| Cas limite | 🟡 | Si tu as **bloqué** quelqu'un qui avait commenté un post, son commentaire t'est caché mais reste dans le compteur (vu par tous). Très rare ; à revoir si besoin. |

**Tests (N3)** : ouvre le post « Fall Back » de Bapt → fenêtre des commentaires : 1 commentaire + le bandeau « + 1 réponse en musique » → « Écouter » montre « 444 ». Ajoute un commentaire sur un post du fil → le chiffre passe de N à N+1 (lu en base) ; supprime-le → retour à N.

## N5 — Photos de stories qui ne se chargent pas
| # | Statut | Explication |
|---|---|---|
| Cause | ✅ | Sur les **4 stories avec photo** en base : 1 photo **HEIC de 4,3 Mo** (iPhone, avril) **illisible** dans Chrome / Android (seul Safari lit le HEIC) et que le redimensionneur serveur ne sait pas lire non plus ; 1 photo de **1,4 Mo** (story composée de septembre, JPEG qualité 0,9 en 1080×1920) lente à charger. Les liens sont bons (dossier public, pas de lien signé expiré) et tous les fichiers existent. |
| Envoi | ✅ | Photo **HEIC/HEIF convertie en JPEG** dès qu'on la choisit (« Conversion de la photo… » pendant quelques secondes), si le navigateur ne sait pas la lire ; sur iPhone, la compression habituelle la passe en JPEG. Testé avec la vraie photo HEIC : **4,3 Mo → JPEG 239 Ko**, 960×1280. Vaut pour stories, Shakes, messages, cercles **et la photo de profil** (outil de cadrage). Story composée : qualité 0,82 (≈ 2× plus légère). Le convertisseur n'est téléchargé que si besoin. |
| Rotation | ✅ | L'orientation EXIF est appliquée à la compression (`imageOrientation: from-image`) et par le navigateur à l'affichage : rien à corriger. |
| Affichage | ✅ | **Fond de chargement** propre tant que la photo n'est pas prête (le minuteur attend, E1), **nouvel essai automatique** avec le fichier d'origine si la version redimensionnée échoue, puis message « **La photo n'a pas pu se charger** — vérifie ta connexion, le son et le texte restent là ». Plus jamais d'écran noir. |

**Tests (N5)** : sur un **Android** (ou Chrome ordinateur), publie une story avec une photo **HEIC** envoyée depuis un iPhone (AirDrop/mail) → « Conversion de la photo… » puis l'aperçu ; la story s'affiche partout. Coupe le réseau en ouvrant une story photo → fond violet qui pulse, puis le message clair.

## N2 — Retour, adresses par écran, onglets indépendants
| # | Statut | Explication |
|---|---|---|
| Adresses | ✅ | Chaque écran a son adresse : `/` (fil), `/top`, `/recherche`, `/messages`, `/messages/<id>` (conversation), `/cercles/<id>`, `/cercles/<id>/playlist` (P21), `/profil`, `/notifications`, `/u/<pseudo>` (aperçu ou profil d'un ami), `/post/<id>` (post ouvert dans l'appli). **Rafraîchir garde l'écran**, et ouvrir un de ces liens ouvre directement l'écran (conversation, cercle, playlist ou post compris). `/p/<id>` reste la page publique d'un post partagé (identique pour tous, comme décidé avant). |
| Retour | ✅ | Le retour (bouton de l'appli, retour Android, glisser iPhone) **suit l'historique réel** : il ferme d'abord la fenêtre du dessus (aperçu de profil, post, story, commentaires, panneaux), puis la conversation / le cercle / la playlist, puis revient au fil, et seulement ensuite quitte. Arrivé directement par un lien (ex. `/messages/<id>`), le retour ramène à la liste puis à l'accueil au lieu de quitter. Une seule mécanique pour tout : chaque couche déclare son adresse, l'adresse affichée suit toujours ce qui est à l'écran. |
| Onglets | ✅ | **Chaque onglet garde son état et son défilement** quand on va ailleurs puis qu'on revient (les onglets restent ouverts en arrière-plan) : position dans le fil, recherche tapée, période du TOP, conversation ouverte dans Messages… Une conversation laissée ouverte « dort » (elle ne bloque pas le retour des autres onglets) et se retrouve telle quelle. **Toucher l'onglet déjà actif remonte en haut** (sur ordinateur, l'Accueil se rafraîchit aussi). Les notifications se rechargent à chaque visite. Mon profil se met à jour après une publication. |
| PWA / Vercel | ✅ | Toutes ces adresses (sans point) sont déjà renvoyées vers `index.html` par Vercel ; `/u/` garde son aperçu de lien. L'appli installée démarre sur `/` (fil) ; le retour Android de l'appli installée suit la même pile. |
| Vérif | ✅ | Testé dans le navigateur avec une maquette des onglets : Messages → conversation (`/messages/abc`) → onglet Profil (`/profil`, la conversation dort) → retour sur Messages (`/messages/abc` retrouvée) → autre conversation (`/messages/def`, adresse remplacée sans empiler) → aperçu (`/u/raph`) → **retour** `/messages/def` → **retour** `/messages` → **retour** `/`. Fermer un aperçu par son bouton rend l'adresse de l'onglet (`/top`). |
| Limite | 🟡 | Je n'ai pas pu tester connecté (pas de compte de test) : à vérifier sur ton téléphone (tests ci-dessous). Si une fenêtre est ouverte DANS un onglet quand on change d'onglet, elle se rouvre au retour sur l'onglet (comportement voulu), mais l'ordre de fermeture de deux fenêtres empilées dans un onglet en veille peut s'inverser (cas très rare). |

**Tests (N2)**
1. Va sur ton profil, actualise la page : tu restes sur ton profil (`/profil`). Pareil pour TOP, Recherche, Messages.
2. Messages → une conversation (`/messages/…`) → actualise : la conversation est rouverte. Retour Android (ou bouton retour) → la liste → retour → le fil → retour → l'appli se ferme.
3. Un cercle → Playlist → actualise : tu es sur la playlist du cercle.
4. Fil : descends loin → va sur TOP → reviens sur Accueil : tu es au même endroit. Touche Accueil encore : remonte en haut.
5. Dans le fil, ouvre l'aperçu d'un ami (`/u/pseudo`) → retour : l'aperçu se ferme, tu restes sur le fil.
6. Sur l'appli installée (écran d'accueil du téléphone), refais 2 et 5.

## N1 — Story : toucher l'auteur ouvre un aperçu, puis on revient à la story
| # | Statut | Explication |
|---|---|---|
| N1 | ✅ | Dans une story, **toucher l'avatar ou le pseudo** en haut à gauche **met la story en pause** (minuteur, barre de progression **et son**) et ouvre **l'aperçu du profil** qui monte du bas, **par-dessus la story** : avatar, nom, pseudo, abonnés / abonnements, Suivre, compatibilité expliquée (P25), derniers Shakes, bouton « Profil complet ». **Fermer** (croix, **retour** du téléphone ou **glisser vers le bas** par la barre du haut) → on retrouve **la même story au même endroit**, qui reprend (le son aussi s'il jouait). Depuis le profil complet ouvert ainsi, le retour ramène aussi à la story. L'adresse passe à `/u/<pseudo>` le temps de l'aperçu. Testé : aperçu ouvert au-dessus (couche 80 > story 60), story toujours ouverte, retour → aperçu fermé, adresse rendue. |

**Test (N1)** : ouvre la story d'un ami avec un son → touche son avatar : la barre s'arrête, le son se coupe, l'aperçu monte → glisse-le vers le bas → la story reprend où elle était, avec le son.

## N4 — Titre + artiste partout
| # | Statut | Explication |
|---|---|---|
| N4 | ✅ | La story « son seul » affichait déjà titre + artiste quand l'artiste est en base ; **toutes les stories, posts, messages, messages de cercle et réponses en musique ont un artiste** (vérifié en base : 0 manquant). Les 9 vieilles stories sans titre le récupèrent à l'affichage. Passé en revue les **31 endroits** qui affichent un son : 2 n'affichaient que le titre → corrigés : la ligne des **notifications** (« · Fall Back — Lithe ») et les vignettes de la **page d'arrivée d'un profil** partagé (titre + artiste). |

## N6 — Compatibilité plus intelligente
| # | Statut | Explication |
|---|---|---|
| N6 | ✅ | Couvert par **P25** (lot 9) : profil musical par artistes, genres fins (TF-IDF), familles, artistes proches, récence, sons épinglés, explication affichée. |

## Lot 12 — P31 (décisions appliquées) + P30 (pages légales, brouillon)
| # | Statut | Explication |
|---|---|---|
| P31 vocabulaire | ✅ | Passé en revue **tous les textes visibles** (appli, notifications, notifs push, partage, aide, page Confidentialité de l'appli) : les « story / stories » restants sont devenus « **Shake éphémère / Shakes éphémères** » (15 textes : ajouter, supprimer, épingler, « Personne n'a encore vu ce Shake éphémère », rubrique du profil, suppression du compte, notif « ont aimé ton Shake éphémère »…). Gardé exprès : les mentions des **stories Instagram** (vidéo de partage : « Vidéo pour ta story Insta », sticker Lien). Rien changé dans les noms de tables ni de variables. |
| P31 lien de cercle | ✅ | Le lien d'invitation porte maintenant le **code du cercle** : `shakemoi.fr/c/<code>` (au lieu de l'id). Dans les infos du cercle : « **Générer un nouveau lien** » (avec confirmation) → nouveau code de 8 caractères tiré au hasard de façon sûre (sans O/0 ni I/1), **l'ancien lien et l'ancien code ne marchent plus**. **Tous les membres** peuvent le faire. Les **anciens liens `/c/<id>`** et les codes remplacés affichent « **Ce lien n'est plus valide** — demande un nouveau lien à un membre du cercle ». La page d'invitation montre aussi la photo du cercle, et « Rejoindre » ouvre directement le cercle. Aperçu de lien (WhatsApp…) : nom, photo et nombre de membres via le code. |
| P31 règles en base | ✅ | Imposé en base : on ne **rejoint qu'avec un code valide** (l'ancienne fonction par id ne fait plus entrer personne), seul un **membre** peut régénérer, le code ne peut pas être modifié directement, chaque nouveau cercle reçoit un code sûr. **Testé** (transaction annulée) : non-membre → refus pour régénérer et pour entrer par l'id ; ancien code → « lien expiré » ; nouveau code → entre ; changement direct du code → ignoré ; nouveau cercle → code `F5CNKG2V`. Les codes actuels des 19 cercles sont gardés (ceux que vous avez déjà partagés en texte marchent toujours). |
| P31 reshakes | ✅ | Anciens likes / commentaires sur des reshakes : **rien fait**, comme décidé. |

**Tests (P31)**
1. Fais le tour de l'appli (Shake éphémère : publier, voir, supprimer, épingler, archive, profil, notifs) : plus aucun « story » à l'écran, sauf pour Instagram.
2. Un cercle → infos → copie le lien (`/c/XXXXXXXX`) → ouvre-le dans une fenêtre privée : page d'invitation avec la photo. Reviens → « Générer un nouveau lien » → recharge l'ancien lien : « Ce lien n'est plus valide ». Le nouveau marche.
3. Un vieux lien `/c/<long id>` reçu avant ce soir → « Ce lien n'est plus valide ».
| P31 vocabulaire (suite) | ✅ | 4 textes de plus trouvés en relisant ligne par ligne (page Confidentialité de l'appli ×2, « Durée du Shake éphémère » à la création, archive vide). |
| P30 | ✅ brouillon | Premier jet dans **`docs/legal_brouillon.md`** : **Confidentialité** mise à jour (Sentry, notifications push chiffrées, blocage et signalements avec copie du contenu signalé, invitations, compatibilité musicale calculée **uniquement** à partir de ce qui est publié dans SHAKEmoi, série, récap, vidéos fabriquées sur le téléphone, bouton Signaler un bug, GIF, âge minimum 15 ans) et **CGU** entièrement nouvelles (compte, contenus, extraits 30 s, interdits, modération, invitations et cercles, fonctions calculées, suppression). **Rien n'est publié.** Les infos qui me manquent sont marquées **[À COMPLÉTER]** (éditeur, adresse, durées de conservation, régions Vercel / Sentry, délai de modération). Quand tu dis « OK publie » : page `/confidentialite` mise à jour, nouvelle page `/cgu`, liens dans Paramètres et à l'inscription. |

## Lot 13 — Restes P / N et audit de cohérence
| # | Statut | Explication |
|---|---|---|
| Reste P14 | ✅ | « Genres du moment » ajouté au TOP (voir lot 6). |
| Reste P21 | ✅ | Adresse de la playlist faite avec N2. |
| Étape 0 | ✅ | Revérifié : règles SQL en attente appliquées (dossier `supabase/pending/` vide et supprimé), renommage de cercle avec message « a renommé le cercle », double-tap en privé (P9, lot 4), lecture des posts publics pour « Tout SHAKEMOI ». |
| Visites | ✅ | Tour des pages publiques dans le navigateur, sans erreur : `/` (visiteur), `/top`, `/u/raph`, `/i/kenny` (page d'invitation avec 3 sons), `/c/ktay69` (vrai cercle, minuscules acceptées), `/c/ZZZZZZZZ` et un ancien `/c/<id>` (« Ce lien n'est plus valide »). |
| Cohérence | ✅ | Revu ce qui se croise ce soir : les onglets gardés en mémoire (N2) avec la messagerie, les aperçus, le récap et les stories (les vues d'un onglet caché libèrent le retour) ; le profil se met à jour après une publication ; la notif « a rejoint grâce à toi » (cloche + push, réglage « abonnements ») ; liens de cercle par code partout (en-tête de cercle, création, infos, recherche par code, aperçus WhatsApp) ; vocabulaire « Shake éphémère ». |
| Bloqué par toi | 🟡 | Test Playwright ordinateur (P13) et tests connectés : **compte de test** à créer. Sentry (P16) : **clé**. Thèmes du Shake de la semaine (P23) : **décision**. Tests téléphone des vidéos (P20). Publication des pages légales (P30) : **ton OK**. Voir MATIN.md. |

**Bilan de la nuit (sections P et N)** : P1 → P31 et N1 → N6 traités. Restent seulement les points bloqués ci-dessus (clé, compte de test, décision, ton OK, tests sur téléphone).

---

# Section Q — retours après les tests du 01/10 (session du 02/10)

Légende : ✅ fait · 🟡 partiel · ⏭️ reporté · ⏳ pas encore traité

## Étape 0 — restes P / N
| # | Statut | Explication |
|---|---|---|
| Liste | ✅ | Relu `CE_SOIR.md` + `PROMPT_5` : P1 → P31 et N1 → N6 sont tous traités. Il ne reste que des points **bloqués par toi** (déjà dans `MATIN.md`) : clé Sentry (P16), compte de test (P13), clé GIF (M5), OK des pages légales (P30), thèmes du Shake de la semaine (P23), tests sur vrai téléphone (P7, P20). |
| Patch de Jerry | ✅ | Revérifié dans la vraie base : plus de dossier `supabase/pending/`, `rename_circle` + message « a renommé le cercle » en place, likes de messages privés (`message_likes`) en place, règle de lecture des posts publics (Global ≠ Amis) en place. |
| P24 → Q11 | ⏳ | Les sons épinglés (P24) existent en rubrique séparée : ils seront transformés au lot Q4 + Q11. |

## Ton retour en reprenant : « beaucoup de texte illisible » et « des curseurs qui se mettent partout »
| # | Statut | Explication |
|---|---|---|
| Texte illisible | ✅ | Mesuré : **~300 textes** de l'appli (dates, @pseudos, sous-titres, compteurs, textes d'aide, champs vides) étaient en violet transparent avec un contraste de **2 à 3,9 pour 1** sur le fond (il faut au moins 4,5). Tous remontés au-dessus de 4,5 : par exemple le gris-violet le plus utilisé (199 endroits) passe de 3,9 à 5,9. La hiérarchie reste (blanc = principal, violet clair = secondaire). |
| Curseurs | ✅ | Sur téléphone, un appui long ou un **double-tap pour liker** sélectionnait le texte : poignées bleues, loupe, menu « Copier » qui apparaissaient partout. Maintenant la sélection n'existe que dans les champs où on écrit (et le code / lien d'un cercle, faits pour être copiés). Copier un message reste possible par son menu. Plus de cadre de focus après un toucher (seulement au clavier, sur ordinateur). |
| Clavier qui s'ouvre tout seul | ✅ | L'onglet Recherche, « Envoyer à un ami », la fenêtre du Shake de la semaine (qui s'ouvre toute seule une fois par semaine) et « Signaler un bug » mettaient le curseur dans le champ et **ouvraient le clavier sans qu'on touche rien**. Sur téléphone, le champ attend maintenant qu'on le touche (sur ordinateur, rien ne change). |

## Banc d'essai « connecté » (nouveau, sert à toute la section Q)
Sans compte de test, je ne pouvais pas voir l'appli connectée. J'ai monté un **banc d'essai** : l'appli tourne en local avec une adresse de base **factice**, et Playwright répond à sa place avec des données d'exemple (Léa, Bapt, un cercle « Les potes », 40 messages avec photos et sons, des posts). **Rien ne touche la vraie base, aucun mot de passe.** Commande : `npm run test:mock`. Fichiers : `e2e/mock/backend.ts`, `playwright.mock.config.ts`, `e2e/*.mock.spec.ts`.

## Lot Q1 — Q10, Q7, Q6, Q13, Q12
| # | Statut | Explication |
|---|---|---|
| Q10 logo | ✅ | La grande image de droite (`icon` = le logo) est **retirée** de toutes les notifs (envoyées par le serveur et par l'appli). Nouvelle petite icône **`/badge-96.png`** : le S de SHAKEmoi **blanc sur fond transparent, 96×96** (avant : le favicon en couleur, qu'Android transforme en carré blanc). Généré par `scripts/make-badge.mjs`. |
| Q10 textes | ✅ | Titre = **la personne** (son nom affiché, sinon son pseudo), texte court, plus jamais « SHAKEmoi » en titre. Exemples : **« Bapt » — « a aimé ton Shake · Lithe »** ; « Léa » — « s'est abonné·e à toi » ; « Léa et 3 autres » — « ont aimé ton Shake éphémère » ; message privé : « Bapt » — « 🎵 Fall Back — Lithe » ; cercle : « Les potes » — « Bapt : ça part ! » ; série : « Ta flamme est en jeu 🔥 » — « Série de 3 semaines · publie un Shake avant mardi matin » ; test : « C'est activé ! ». Fonction `push` redéployée (v4). |
| Q10 vérif téléphone | 🟡 | Je n'ai pas de téléphone : **à toi** (test 1 plus bas). Ce que tu dois voir sur Android : le S blanc à gauche (barre d'état et notif), **plus rien à droite**. iPhone : iOS affiche toujours l'icône de l'appli installée à gauche (il ignore `icon` et `badge`), titre et texte comme ci-dessus. |
| Q7 cause | ✅ | **Trouvée dans la vraie base** : la règle de modification des cercles est réservée au **créateur**. Quand un autre membre changeait la photo, la base modifiait 0 ligne **sans erreur** : la photo s'affichait sur le moment, puis disparaissait au rechargement. Cas réel : **@raph a mis 2 fois une photo sur « J B L »** (cercle créé par @kenny) le 01/10 → refusées en silence. La colonne `photo_url` existe bien, le stockage était OK (les 2 photos y sont), le cache n'y est pour rien (nom de fichier unique à chaque envoi). |
| Q7 correctif | ✅ | Fonction `set_circle_photo` (comme `rename_circle`) : **tout membre** change la photo, et **seulement la photo** (adresse de notre stockage uniquement). Petit message dans la conversation « **Léa a changé la photo du cercle** » (aussi en aperçu dans la liste). Erreur claire si ça échoue, plus jamais silencieux. La nouvelle photo suit tout de suite : en-tête, infos, liste, colonne ordinateur (temps réel), page d'invitation. **Testé en base** (transaction annulée) : membre non créateur → OK + message ; non-membre → refusé ; adresse externe → refusée ; fabriquer le message à la main → refusé. |
| Q7 bilan | ✅ | **19 cercles** : 1 avait une photo (« Jheje »), 18 n'en avaient pas. **1 photo perdue retrouvée** dans le stockage et remise : « J B L » (la dernière envoyée par @raph). Il restait aussi la photo d'un cercle supprimé depuis (rien à faire). ⚠️ La photo de « Jheje » est dans l'ancien espace privé : les membres la voient, mais pas la page d'invitation ; il suffit de la remettre une fois (déjà noté en B5). |
| Q6 | ✅ | Adresse lisible **`/messages/<pseudo>`** (l'ancien `/messages/<id>` marche toujours), `/cercles/<id>`, `/cercles/<id>/playlist`, `/post/<id>`, `/profil`, `/u/<pseudo>`. **Test Playwright** (téléphone + ordinateur) : ouvrir une conversation → actualiser → on y est toujours, tout en bas ; pareil pour un cercle, le profil et un post. **6/6 OK.** |
| Q13 cause | ✅ | **Reproduit sur le banc** : un cercle s'ouvrait **107 à 161 px au-dessus** du dernier message. Deux causes : (1) l'appli visait le séparateur « Non lus » (règle P12) au lieu du bas ; (2) on faisait défiler en bas **avant** que les photos aient leur taille, puis elles poussaient le contenu (un seul recalage après 0,2 s, trop tôt en 4G). |
| Q13 correctif | ✅ | La conversation est **ancrée en bas** : à chaque changement de hauteur (photo, GIF, pochette qui finit de charger), elle se recale, **tant que tu n'as pas remonté toi-même** (dès que tu fais défiler, elle ne bouge plus ; revenir tout en bas réactive l'ancre). La liste n'apparaît **qu'une fois placée** : aucun défilement visible depuis le haut. Les photos ont une **taille fixe réservée** (rien ne saute). On arrive toujours sur le dernier message (Q13 remplace « on arrive sur les non-lus » ; le séparateur « Non lus » reste quand on remonte). Nouveau message reçu en bas → descend ; remonté → bouton « ↓ nouveaux messages ». Même chose après actualisation et en revenant d'une autre conversation. **Test Playwright** avec des photos chargées en retard (1,2 s) : dernier message visible, 0 px d'écart. |
| Q12 | ✅ | Badge de la flamme (profil, aperçu de profil) : **pastille opaque sombre** avec contour, chiffre **blanc extra-gras 13 px** (avant 11 px sur fond transparent) → contraste > 12:1, même sur une pochette claire derrière. Flamme de l'en-tête : chiffre **toujours blanc** (avant violet pâle quand la flamme était grise, ~3:1), dans une pastille. Petite fenêtre au toucher : fond opaque, texte blanc / violet très clair. Flamme grise éclaircie pour rester visible. |

**Tests (lot Q1)**
1. **Notifs (Android, appli fermée)** : depuis un 2ᵉ compte, like un de tes Shakes → la notif montre le S blanc à gauche, **rien à droite**, titre = le prénom, texte « a aimé ton Shake · Titre ». Puis appli ouverte en arrière-plan : pareil. iPhone (appli installée) : décris-moi ce que tu vois.
2. **Photo de cercle** : dans un cercle **que tu n'as pas créé** → infos → Photo → cadre → OK → « Photo enregistrée » + « Tu as changé la photo du cercle » dans la conversation. Actualise : la photo est toujours là, dans la liste aussi. Ouvre « J B L » : la photo de Raph est revenue.
3. **Actualiser** : ouvre une conversation (l'adresse devient `/messages/pseudo`) → actualise → tu es toujours dedans, en bas. Pareil dans un cercle et sa playlist.
4. **Ouvrir en bas** : ouvre une conversation avec des photos / GIF / sons → tu arrives directement sur le dernier message, sans voir défiler. Remonte un peu, fais-toi envoyer un message → bouton « ↓ 1 nouveau message ».
5. **Flamme** : en-tête, ton profil, l'aperçu d'un ami qui a une série → le chiffre se lit bien ; touche-la → la petite fenêtre se lit bien.
6. **Curseurs** : double-tape un message pour le liker, appuie longtemps sur un texte du fil → plus de poignées bleues ni de loupe. Va sur Recherche → le clavier ne s'ouvre plus tout seul.

## Lot Q2 — Q1 + Q5 : aperçu de profil lisible, rapide, qui se ferme en glissant
| # | Statut | Explication |
|---|---|---|
| Q1 cause | ✅ | **Trouvée** (reproduite sur le banc) : l'aperçu s'affiche « par-dessus » l'appli, et tout ce qui s'affiche par-dessus héritait de la couleur de texte par défaut de la page… **presque noire** (restes d'un thème clair jamais adapté). Résultat : « @pseudo » en haut et « Message » écrits en noir sur violet foncé. Ça touchait aussi d'autres fenêtres. |
| Q1 correctif | ✅ | Couleurs de base de l'appli passées en sombre une fois pour toutes (texte blanc par défaut partout, contrôles natifs sombres). En-tête de l'aperçu : fond plein, **@pseudo blanc extra-gras**, petite barre de prise ; **Message** : fond plein + contour net, texte blanc gras (contraste > 12:1) ; « Profil complet » lisible aussi. Le fond derrière est assombri à 75 % et flouté : une pochette blanche derrière ne gêne plus. |
| Q1 glisser | ✅ | **Glisser vers le bas ferme l'aperçu**, comme Instagram : le panneau suit le doigt, le fond s'éclaircit ; au-delà d'un quart de l'écran (ou avec un geste rapide) il part vers le bas, sinon il revient en place. Ça ne démarre **que si le contenu est tout en haut** (sinon on fait défiler le fil normalement), ou depuis la barre du haut. Un geste surtout horizontal est laissé aux autres gestes. Le retour du téléphone le ferme toujours (N2). **Test Playwright tactile** : petit glissé → revient ; contenu défilé → défile sans fermer ; grand glissé → fermé et adresse rendue ; geste rapide court → fermé. |
| Q3 (début) | ✅ | Nouveau module commun `src/lib/motion.ts` : **la courbe et la durée de Messages ↔ Cercles** (0,28 s, `cubic-bezier(.2,.8,.2,1)`), « réduire les animations » respecté. Messages ↔ Cercles et le TOP l'utilisent (valeurs identiques : rien ne change pour eux), l'aperçu de profil aussi (ouverture, fermeture, glisser). |
| Q5 une requête | ✅ | Fonction SQL **`get_profile_header`** : profil + compteurs + « je suis / il me suit » + abonnés en commun + compatibilité + série + Shakes éphémères, **en un seul aller-retour** (11 ms côté serveur, mesuré). Elle respecte les règles d'accès de la personne qui regarde (blocages, privé, cercles). |
| Q5 tout de suite | ✅ | Ce qu'on connaît déjà (avatar, nom, @ du post, du commentaire, de la liste… touché) s'affiche **immédiatement** ; le reste a des **squelettes** (blocs qui respirent) : plus jamais une roue sur écran vide. |
| Q5 préchargement | ✅ | Dès que le doigt **se pose** sur un avatar ou un nom (fil, recherche, notifications, commentaires, post, likes, abonnés, suggestions, TOP, cercles), ou au **survol** sur ordinateur, l'en-tête et la 1re page du fil commencent à charger, avant même que l'aperçu s'ouvre. |
| Q5 cache | ✅ | Rouvrir le même profil **dans la minute** : instantané, sans requête ; au-delà, affiché tout de suite puis rafraîchi discrètement. |
| Q5 fil | ✅ | Fil chargé par **pages de 12** (avant 24), la suite au défilement ; la 1re page arrive en même temps que l'en-tête. Miniatures en petite taille (300 px). |
| Q5 mesures | ✅ | Banc d'essai, 4G simulée (150 ms par aller-retour), affichage complet = en-tête + compatibilité + 9 pochettes chargées. **Avant** : nom affiché après ~450 ms (écran vide avant), complet ~800 ms, **14 requêtes** en 3 vagues. **Après** : à froid (lien, notification) complet **~420-510 ms, 3-4 requêtes** ; en touchant un avatar : **nom immédiat**, complet **~300 ms après le toucher, 2 requêtes** ; réouverture dans la minute : **~30-50 ms, 0 requête**. (En vrai 4G il faut ajouter le temps du serveur, ~10 ms pour l'en-tête : l'écart avant / après est encore plus grand, car avant les vagues s'additionnaient.) |

**Tests (lot Q2)**
1. Ouvre l'aperçu d'un ami depuis le fil : « @pseudo » en haut et « Message » se lisent bien ; avatar, nom et @ sont là **tout de suite**, les chiffres arrivent juste après.
2. Glisse le panneau vers le bas depuis le haut : il suit ton doigt et se ferme ; glisse un tout petit peu et lâche : il revient. Fais défiler son fil, puis glisse vers le bas : ça remonte le fil (ça ne ferme pas) ; une fois tout en haut, glisser ferme.
3. Ferme puis rouvre le même profil : instantané.
4. Profil d'un ami avec beaucoup de Shakes : 12 pochettes d'abord, la suite arrive en descendant.
5. Regarde les autres fenêtres (commentaires, likes, abonnés, infos du cercle, flamme) : tout le texte est blanc / violet clair, rien en noir.

## Lot Q3 — Q2 (post suivant / précédent) + Q3 (transitions)
| # | Statut | Explication |
|---|---|---|
| Q2 glisser | ✅ | Post ouvert depuis une **grille de profil** (le mien, un ami, l'aperçu) ou le **TOP** : **glisser à gauche / à droite** passe au post suivant / précédent **de la même liste, dans l'ordre de la grille**. Le post suit le doigt (même mécanique, même courbe et même durée que Messages ↔ Cercles) ; relâcher avant un quart de l'écran annule. |
| Q2 flèches | ✅ | Petites flèches sur les côtés (discrètes sur téléphone, plus grandes et plus contrastées sur ordinateur) + **flèches du clavier** (et Échap pour fermer). Pas de flèche gauche sur le 1er post, pas de droite sur le dernier. |
| Q2 instantané | ✅ | **Trois posts montés côte à côte** (précédent, affiché, suivant) : le suivant est déjà chargé (post, likes, commentaires, réponses en musique) ; un cran plus loin est préchargé en mémoire. Revenir sur un post déjà vu est immédiat (gardé 1 min). La grille charge la page suivante quand on approche du bout. |
| Q2 son | ✅ | Le son du post quitté **s'arrête** ; celui du nouveau post **ne démarre pas tout seul** (règle M2). |
| Q2 chiffres | ✅ | Commentaires, likes, reshakes, « qui a liké », partage, envoyer à un ami : tout suit le post affiché (chaque post a ses propres données). L'adresse suit aussi (`/post/<id>`). |
| Q2 bout | ✅ | Au bout de la liste, **pas de boucle** : le post bouge un peu (résistance) et revient. |
| Q2 retour | ✅ | Le retour (ou la croix) ferme le post et ramène **à la grille, sur la vignette du dernier post vu** (la grille suit pendant qu'on fait défiler les posts). |
| Q2 fermer en glissant | ✅ | **Glisser vers le bas** (depuis la pochette, ou n'importe où si le contenu est tout en haut) : le post **suit le doigt et rétrécit**, le fond s'éclaircit et la grille réapparaît (capture `e2e/screens/q2-glisser-bas.png`). Au-delà du seuil (ou geste rapide) : **la pochette revient se poser sur sa vignette** ; sinon le post revient en place **avec un petit rebond**. Le défilement des commentaires n'est pas gêné. |
| Q2 ouverture | ✅ | L'inverse : le post **s'agrandit depuis sa vignette**. Même courbe et même durée que la fermeture et que Messages ↔ Cercles. Ouvert sans vignette (fil, notification) : il apparaît en douceur. |
| Q2 directions | ✅ | La direction est décidée **dès les 10 premiers pixels** : franchement horizontal = post voisin, vers le bas = fermer, vers le haut = faire défiler. Jamais les deux à la fois. Un appel ou une notif qui interrompt le geste : tout revient en place. |
| Q2 téléphone | ✅ | Sur téléphone, le post ouvert prend **tout l'écran** (avant : une carte avec des marges) : plus de place pour la pochette et un geste plus naturel, comme la galerie photo. Sur ordinateur : fenêtre centrée comme avant. |
| Q2 tests | ✅ | **Playwright** (vrais événements tactiles sur téléphone, souris + clavier sur ordinateur) : flèches, clavier, glisser à gauche / à droite, résistance au 1er post, geste interrompu → revient, glisser vers le bas → fermé et vignette du dernier post vu à l'écran, retour → fermé. |
| Q3 référence | ✅ | **Messages ↔ Cercles n'a pas bougé** (mêmes valeurs, juste rangées dans `lib/motion.ts`). Cette mécanique (`useSwipeTabs`) est le composant réutilisable des onglets glissables ; le TOP l'utilise déjà, le Classement (Q4) l'utilisera. |
| Q3 partout | ✅ | **Une seule courbe et une seule durée par défaut pour toute l'appli** (0,28 s, celles de Messages ↔ Cercles) : toutes les ouvertures / fermetures de fenêtres qui n'avaient pas de réglage propre la prennent automatiquement. |
| Q3 revue | ✅ | Ce qui détonnait, et ce qui est corrigé : **fenêtres du bas** (likes, partage, archives, vues d'un Shake éphémère, abonnés, infos du cercle, signaler) : 3 « ressorts » de raideurs différentes + des fondus de 0,2 s → même courbe ; **tuto** : changement d'écran en 0,28 s « ease-out » → même courbe ; **changement d'onglet du bas** : fondu 0,15 s → 0,18 s même courbe (fondu seulement : un glissement décalerait les boutons fixes) ; **playlist du cercle** : apparaissait d'un coup → glisse par-dessus la conversation (qui reste en place dessous) ; **aperçu de profil** et **post** : refaits (Q1, Q2). Gardés tels quels : les petites animations décoratives (cœur du double-tap, pop des icônes du tuto, vinyle), et l'ouverture d'une conversation, instantanée comme WhatsApp. |
| Q3 accessibilité | ✅ | « **Réduire les animations** » du téléphone respecté partout (animations de l'appli et effets CSS ; la barre de temps du récap reste). Uniquement `transform` / `opacity`, déplacement direct pendant les gestes (pas de recalcul React à chaque image), aucune bibliothèque ajoutée. |

**Tests (lot Q3)**
1. Ton profil → touche une pochette → le post s'agrandit depuis la vignette. Glisse à gauche : le post suivant arrive tout de suite (pochette, likes, commentaires à lui). Glisse à droite : le précédent. Sur le 1er post, glisse à droite : ça résiste.
2. Lance le son d'un post, passe au suivant : le son s'arrête, le nouveau ne démarre pas tout seul.
3. Passe 5 ou 6 posts, puis glisse vers le bas : le post rétrécit, la grille réapparaît, et la pochette se pose sur sa vignette (la grille est au bon endroit). Glisse un tout petit peu vers le bas et lâche : petit rebond.
4. Dans un post, descends dans les commentaires puis remonte : ça défile normalement, sans fermer.
5. Même chose depuis le profil d'un ami et depuis le TOP (sons les plus shakés / likés).
6. Ordinateur : flèches sur les côtés et flèches du clavier ; Échap ferme.
7. Un cercle → icône Playlist : la playlist glisse depuis la droite ; la bulle (ou retour) la referme, la conversation est restée au même endroit.
8. Réglages du téléphone → Accessibilité → « Réduire les animations » : l'appli ne fait plus que des apparitions directes.

## Lot Q4 — Q4 (Classement en 3 onglets) + Q11 (Shakes épinglés dans la grille)
| # | Statut | Explication |
|---|---|---|
| Q4 onglets | ✅ | **Trois onglets centrés** : **Amis** (à gauche, ouvert par défaut) · **Global** (l'ancien « Tout SHAKEMOI ») · **Découvrir** (nouveau). On glisse ou on touche : **exactement la mécanique de Messages ↔ Cercles** (même composant `useSwipeTabs`) : le contenu et le trait rose suivent le doigt, relâcher à mi-chemin termine ou annule. La période (7 j / 30 j / Depuis toujours) ne s'affiche que pour Amis et Global. |
| Q4 mémoire | ✅ | Le dernier onglet choisi est **gardé à l'actualisation et à la réouverture de l'appli**. |
| Q4 texte | ✅ | « Tout SHAKEMOI » remplacé partout (onglet, sous-titres) : « Global », « Sur SHAKEmoi (Global) ». |
| Q4 Découvrir | 🟡 | L'onglet est en place ; son contenu (le moteur de recommandation Q8) arrive au lot suivant. En attendant il affiche « Des sons choisis pour toi — bientôt ici ». |
| Q11 principe | ✅ | **P24 remplacé** : plus de rubrique « Sons épinglés » au-dessus du fil (retirée de mon profil et de l'aperçu). On épingle **ses propres Shakes déjà publiés**, **jusqu'à 3**, **en haut de la grille**, avec une **petite épingle violette** dans le coin de la vignette. Ordre des épinglés : le dernier épinglé en premier ; le reste de la grille reste chronologique. |
| Q11 épingler | ✅ | Deux façons : menu **« … »** du post (« Épingler en haut du profil » / « Désépingler », avec « Supprimer » déplacé dans le même menu) ou **appui long sur la vignette** de mon profil. Au-delà de 3 : « Remplacer le plus ancien épinglé par celui-ci ? ». La grille se remet dans l'ordre tout de suite. |
| Q11 partout | ✅ | Visible par tous ceux qui voient le profil (profil complet, aperçu de profil) ; le passage d'un post à l'autre (Q2) suit l'ordre de la grille, épinglés compris (testé). |
| Q11 en base | ✅ | Colonne `posts.pinned_at` + fonctions `pin_post` / `unpin_post` : seulement **mes** Shakes visibles sur mon profil (pas un reshake, pas un post privé ni de cercle), 3 maximum, impossible de modifier l'épinglage à la main. **Testé** (transaction annulée) : 1er et 2e épinglés → OK ; 4e → « plein » ; avec remplacement → le plus ancien (EKKO) est désépinglé, on reste à 3 ; modification directe → refusée. |
| Q11 reprise P24 | ✅ | En base il y avait **2 sons épinglés** : « EKKO » (HOUDI) de @kenny correspondait à un de ses Shakes → **devenu un Shake épinglé** ; « Fuentes de Ortiz » de @yohpes ne correspondait à aucun de ses Shakes → **abandonné** (la ligne reste dans l'ancienne table, plus rien ne l'affiche). |
| Q11 goûts | ✅ | Un Shake épinglé garde son **poids fort** dans la compatibilité (×2 au total, comme avant), et le gardera dans le profil de goût de Découvrir (Q8). |

**Tests (lot Q4)**
1. Classement : trois onglets centrés, « Amis » ouvert. Glisse vers la gauche → « Global », encore → « Découvrir » ; relâche à mi-chemin → ça revient. Ferme l'appli, rouvre : tu es sur le dernier onglet choisi.
2. Ton profil : appui long sur une de tes pochettes → « Épingler en haut du profil » → elle passe en premier avec l'épingle violette. Ouvre un autre de tes posts → « … » → « Épingler en haut du profil ». Fais-le une 4e fois → on te propose de remplacer le plus ancien.
3. Ton profil vu par un ami (ou ton aperçu) : les épinglés sont en haut ; plus de rubrique « Sons épinglés ».
4. Ouvre l'épinglé et glisse à gauche : tu passes au plus récent des autres, dans l'ordre de la grille.
5. Ton profil : « EKKO » est épinglé en haut (repris de ton ancien son épinglé).

## Lot Q5 — Q8 (Découvrir : moteur de recommandation) + Q9 (« Choisis 3 artistes »)
La conception (données, sources, score, évaluation, architecture) est dans **`docs/reco.md`**, écrite avant de coder.

| # | Statut | Explication |
|---|---|---|
| Q8 profil de goût unique | ✅ | Une seule source, `taste_signals` : **tous** les gestes avec tes poids (épinglé 1,5 · Shake 1 · reshake 0,8 · réponse en musique 0,7 · Shake éphémère 0,6 · like 0,5 · like de Shake éphémère 0,4 · écoute > 15 s 0,3 · passé en < 5 s −0,2 · « Pas pour moi » −1 et −0,3 sur l'artiste · artiste choisi au tuto 1 → qui s'efface), récence (moitié du poids en 60 jours, sauf épinglés). Vecteurs **artistes (+ proches) · genres fins en TF-IDF · familles · titres** (`user_taste`). **La compatibilité (P25) et les suggestions « mêmes goûts » (P18) lisent maintenant ce même profil** (avant : un calcul à part). Effet : @kenny × @raph passe de 88 à 95 % (leurs likes comptent désormais). |
| Q8 écoutes | ✅ | Nouvelle table `listen_events`, alimentée par le lecteur M2 : durée vraiment écoutée (avec le son), fin (terminé / passé / pause). Les Shakes éphémères en sourdine ne comptent pas. |
| Q8 sources | ✅ | **a. potes** (sons publiés / reshakés / likés en public par les gens qui me ressemblent, pondérés par la compatibilité, mémoire 120 jours) · **artistes que mes potes écoutent** · **b. artistes proches** Deezer (avec leur rang) · **c. plus de mes artistes** · **d. Last.fm titres similaires** (prêt, **actif dès que tu ajoutes la clé**) · **e. classements Deezer par famille + nouveautés** · **f. tendances SHAKEmoi**. Jamais de privé ni de cercle. Nouveau compte : artistes choisis au tuto, sons de la personne qui a invité, tendances. |
| Q8 score | ✅ | goût 0,40 · potes 0,35 · source 0,15 · tendances / popularité 0,05 · fraîcheur 0,05. Retirés : déjà shakés / likés / reshakés / partagés, « Pas pour moi », montrés 3 fois sans écoute (3 semaines). **Diversité** : 2 titres max par artiste sur 20 (1 seul si tu le connais déjà bien), familles en proportion de ton profil, **4 places sur 20 d'exploration** dans des familles voisines (celles qu'aiment aussi les gens qui aiment tes familles), jamais un artiste que tu aimes déjà. |
| Q8 raisons | ✅ | Une ligne par son, avec une petite icône : « Parce que tu as shaké Tiakola » · « Aimé par Bapt · 92 % compatibles » · « Léa écoute Gazo · 88 % compatibles » · « Plus de BEN plg » · « Dans ton style Afro » · « Nouveauté Rap » · « Pour sortir de ta bulle · Électro » · « Tendance sur SHAKEmoi ». |
| Q8 architecture | ✅ | **Fonction serveur `reco-catalog`** (seule à parler à Deezer / Last.fm, 8 requêtes/s max, cache 30 j par artiste, classements 1 fois par jour, toutes les 20 min par petits paquets) → `catalog_tracks` : **1 778 titres** aujourd'hui (titres phares de 79 artistes et de leurs proches, 12 familles, nouveautés). **Calcul en base** → `user_recos` (top 50 de chacun avec score, raison, composantes). Recalcul : **chaque nuit** (≈ 4 h 30) pour tout le monde, et **à l'ouverture si la liste a plus de 24 h ou si tu as donné 5 nouveaux signaux** (calcul en base, aucune API extérieure). **L'onglet fait une seule lecture** (`get_my_recos`). Extraits par la chaîne M1 (`/api/preview?deezer=…`). |
| Q8 onglet | ✅ | Classement → **Découvrir** : « Choisis pour toi », ~20 sons, **pochette jouable**, titre, artiste, **la raison**, logo de ton appli, **Shaker** (publié tout de suite → « Shaké »), **✕ Pas pour moi** (la ligne part, et le moteur apprend). **Tout écouter** = le **même lecteur que la playlist du cercle** (lecteur enchaîné sorti dans un composant commun `QueuePlayer`, utilisé par les deux). **Tirer vers le bas** (ou « Une autre série ») = nouvelle série ; la liste se renouvelle chaque jour. Squelettes pendant le chargement. |
| Q8 suivi | ✅ | `reco_events` : **affiché** (une fois par son et par série), **écouté**, **écouté en entier**, **Shaké**, **Pas pour moi**, avec le rang et le type de raison. Requête de suivi ci-dessous. |
| Q8 évaluation | 🟡 | Voir `docs/reco.md` § 7. 8 comptes, **32 sons cachés** (les 20 % les plus récents de chacun). Top 20 : **moteur** son 2 · **artiste 7 (22 %)** · famille 28 (88 %) — **base « tendances Global »** son 3 · artiste 5 (16 %) · famille 26 (81 %). **Mieux sur l'artiste et la famille, pas « nettement » sur le son exact** : sur les 32, seuls **3** avaient déjà été partagés par quelqu'un avant (le reste = surtout des likes sur des posts publiés après, imprévisibles) ; le moteur en retrouve 2 (rangs 3 et 20). 8 combinaisons de poids essayées : peu d'effet → ce sont les sources qui comptent (ajout de « ce que mes potes écoutent » au niveau de l'artiste = ce qui a le plus aidé). Les vrais juges : `reco_events` dans 2-3 semaines, et toi (contrôle humain ci-dessous). |
| Q9 étape | ✅ | Dans le tuto, **après le choix de l'appli d'écoute, avant « Suis au moins 3 personnes »** (gardé) : **« Choisis au moins 3 artistes que tu aimes »**. Grandes photos rondes, état choisi bien visible (**coche + contour violet**), **recherche** (Deezer), **puces par famille** (Pour toi · Rap FR · Afro · Latin · R&B · Pop · Électro · Rock ; « Pour toi » = un mélange d'artistes populaires en France de chaque famille), et **3-4 artistes proches apparaissent juste à côté** de celui qu'on choisit. **Continuer** à partir de 3 (« Encore 2 » avant), **Passer** toujours possible. Photos en 250 px. |
| Q9 enregistrement | ✅ | `save_artist_picks` : les artistes vont dans le profil de goût avec un poids ~1 qui **diminue à mesure que la personne publie et like** (× 5 / (5 + nb de vrais gestes)) ; Découvrir est recalculé tout de suite ; genres et artistes proches arrivent par l'enrichissement automatique. Donc aussi dans la compatibilité et les suggestions. Testé en base (transaction annulée). |
| Q9 comptes existants | ✅ | Rien de forcé. **Paramètres → « Mes artistes préférés »** (modifier à tout moment) et **« Revoir le tuto »** qui enchaîne sur l'étape. |
| Relais | ✅ | `/api/artists` (Vercel) : Deezer ne se laisse pas appeler depuis le navigateur. Cache CDN 1 jour (recherche 1 h). |

### Contrôle humain — top 10 de 5 vrais comptes (à juger par toi)
**@kenny** : 1. MONACO — HOUDI · *Shaké par Raph · 95 % compatibles* · 2. Trucs sentimentaux — BEN plg · *Plus de BEN plg* · 3. ALL I EVER DO — Adrien Nunez · *Plus de Adrien Nunez* · 4. Hoodie — Bekar · *Parce que tu as reshaké BEN plg* · 5. Vivre pour le meilleur — Johnny Hallyday · *Pour sortir de ta bulle · Chanson / Variété* · 6. ELLE VOULAIT ME VOIR — Coelho · *Parce que tu as reshaké BEN plg* · 7. Dans mon élément — Georgio · *idem* · 8. Gros spectacle — ISHA · *idem* · 9. Booska Fuck Off — B.B. Jacques · *idem* · 10. Kukoč — AJ Tracey · *Pour sortir de ta bulle · R&B / Soul*

**@raph** : 1. Trucs sentimentaux — BEN plg · *Plus de BEN plg* · 2. ALL I EVER DO — Adrien Nunez · *Plus de Adrien Nunez* · 3. Plus belle la vie — Romsii · *Shaké par Kenny · 95 % compatibles* · 4. Hoodie — Bekar · *Parce que tu as shaké BEN plg* · 5. Kukoč — AJ Tracey · *Pour sortir de ta bulle · R&B / Soul* · 6. ELLE VOULAIT ME VOIR — Coelho · 7. Dans mon élément — Georgio · 8. Trafiquant d'encre — Souldia · *Parce que tu as shaké Rymz* · 9. Gros spectacle — ISHA · 10. La fille du Nord — Hugues Aufray · *Pour sortir de ta bulle · Chanson / Variété*

**@theov** : 1. Lady (Ezra Collective Version) · *Plus de Ezra Collective* · 2. Boom Draw — Julian Marley · *Plus de Julian Marley* · 3. Abusey Junction — Kokoroko · *Parce que tu as shaké Ezra Collective* · 4. Dance Inna London — Nubiyan Twist · *idem* · 5. Tadow — Masego · *Pour sortir de ta bulle · R&B / Soul* · 6. Space — French Fuse · 7. Mi Viejo — Ratatat · 8. Pulp Fiction — Monster Florence · 9. Winning — Stephen Marley · *Parce que tu as shaké Julian Marley* · 10. Fall Back (feat. Lil Tjay) — Lithe · *Pour sortir de ta bulle · R&B / Soul*

**@bapt22** : 1. Tempt Me — Lithe · *Plus de Lithe* · 2. Histoire sans fin — BEN plg · *Shaké par Raph · 60 % compatibles* · 3. Jungle — A Boogie wit da Hoodie · *Parce que tu as shaké Lithe* · 4. Know Me — NAV · *idem* · 5. Just Keep Watching — Tate McRae · *Pour sortir de ta bulle · Pop* · 6. DON'T WANNA GO HOME — Adrien Nunez · *Shaké par Kenny · 54 % compatibles* · 7. Like That — Future · 8. Kukoč — AJ Tracey · 9. Janice STFU — Drake · *Parce que tu as shaké Lithe* · 10. Sports car — Tate McRae · *Pour sortir de ta bulle · Pop*

**@coucou** : 1. Histoire sans fin — BEN plg · *Reshaké par Kenny · 65 % compatibles* · 2. Encore une fois — Orelsan · *Plus de Orelsan* · 3. La pluie (feat. Stromae) — Orelsan · 4. DON'T WANNA GO HOME — Adrien Nunez · *Shaké par Kenny · 65 %* · 5. Fall Back — Lithe · *Pour sortir de ta bulle · R&B / Soul* · 6. Casseurs Flowters Infinity — Gringe · *Parce que tu as shaké Orelsan* · 7. 15h02 — Casseurs Flowters · 8. Effet de Surplomb — Gringe · 9. Inachevés — Casseurs Flowters · 10. Vivre pour le meilleur — Johnny Hallyday · *Pour sortir de ta bulle · Chanson / Variété*

### Suivi (dans 2-3 semaines, Supabase → SQL Editor)
```
select reason_kind, count(*) filter (where event='shown') vus,
  round(100.0*count(*) filter (where event='play')/nullif(count(*) filter (where event='shown'),0),1) "% écoutés",
  round(100.0*count(*) filter (where event='shake')/nullif(count(*) filter (where event='shown'),0),1) "% shakés",
  round(100.0*count(*) filter (where event='dismiss')/nullif(count(*) filter (where event='shown'),0),1) "% pas pour moi"
from reco_events group by 1 order by 2 desc;
```

**Tests (lot Q5)**
1. Classement → **Découvrir** : ~20 sons, chacun avec sa raison. Touche une pochette : l'extrait joue. « Tout écouter » : ça enchaîne, mini-lecteur en bas (et sur l'écran verrouillé).
2. « Shaker » sur un son → « Shaké » ; il est dans ton fil. ✕ sur un autre → il disparaît.
3. Tire la liste vers le bas (tout en haut) → une nouvelle série. Reviens demain → nouvelle sélection.
4. Paramètres → « Mes artistes préférés » : choisis Ninho → 3-4 artistes proches apparaissent à côté ; « Rap FR », « Afro »… ; cherche un artiste ; Enregistrer. Reviens sur Découvrir : la sélection en tient compte (artistes choisis = « Parce que tu aimes … »).
5. Paramètres → « Revoir le tuto » : après le choix de l'appli, l'étape « Choisis au moins 3 artistes » (Continuer grisé avant 3, Passer possible), puis « Suis au moins 3 personnes ».
6. Juge le contrôle humain ci-dessus : dis-moi ce qui sonne faux pour tes potes.

## Lot Q6 — Q14 : un tuto concret et interactif
Captures de chaque écran (banc d'essai, téléphone 390 px) : **`docs/captures/q14-tuto.jpg`**.

| # | Statut | Explication |
|---|---|---|
| Q14 principe | ✅ | Fini les slides abstraites (vinyle, icônes) : **chaque écran est un vrai bout d'interface animé**, avec de **vrais titres du moment** (pochettes + extraits pris dans le catalogue de Découvrir, une seule petite lecture) et, si le réseau est lent, des exemples embarqués (Meuda, Djadja, Calm Down, Blinding Lights). Une phrase par écran, tutoiement, un emoji. |
| 1. Partage le son du moment | ✅ 👆 | La recherche se tape toute seule (« Tiakola »), la pochette apparaît, le bouton « Publier mon Shake » pulse. **À toi** : touche la pochette → **l'extrait joue vraiment** (lecteur M2) → « ✓ Bien joué ! ». |
| 2. Réagis à la musique de tes potes | ✅ 👆👆 | Un post de Léa. **À toi** : **double-tap** sur la pochette → gros cœur animé, le compteur passe à 13 → « Bien joué ». On voit aussi « répondre en musique ». |
| 3. Les Shakes éphémères | ✅ | Un mini Shake éphémère de Bapt : barres de progression, **compte à rebours qui défile** (23:59:41…), sticker du son. « Visible 24 h par tes abonnés ». |
| 4. Tes cercles | ✅ | Une mini conversation « Les potes » (messages qui arrivent, un son partagé) ; touche l'icône playlist → **la playlist du cercle glisse** (même transition que dans l'appli). |
| 5. Ta flamme | ✅ 👆 | Flamme grise « 3 semaines… publie avant mardi ! ». **À toi** : « Publier mon Shake » → **elle s'allume en violet**, passe à 4 → « Bien joué ». |
| 6. Découvre | ✅ | « Léa · 92 % » + l'explication, puis un mini Découvrir avec ses raisons (« Parce que tu as shaké Tiakola », « Aimé par Léa · 92 % compatibles », « Dans ton style Afro ») et les boutons Shaker. |
| Configuration | ✅ | Ensuite : **Tu écoutes où ?** (O1) → **Choisis au moins 3 artistes** (Q9) → **Suis au moins 3 personnes** (P29) → arrivée sur un fil déjà rempli. |
| Toujours possible | ✅ | « **Suivant** » toujours là (même sans faire le geste : il est juste moins mis en avant), « **Passer** », barre de progression (touchable), **glisser** pour avancer / revenir, flèches du clavier, **rejouer** depuis Paramètres → « Revoir le tuto » (qui enchaîne aussi sur les artistes). |
| Léger | ✅ | Aucune vidéo, aucune image lourde : les vrais composants de l'appli en version démo + des données d'exemple embarquées ; le son ne part que si on touche. Animations dans le style Q3 (même courbe, même durée). |
| Test | ✅ | **Playwright de bout en bout** (nouveau compte simulé) : les 6 écrans, double-tap validé, flamme allumée, playlist ouverte, choix de l'appli, « Encore 3 » grisé puis 3 artistes, et l'écran « Suis au moins 3 personnes ». |

**Tests (lot Q6)**
1. Paramètres → « Revoir le tuto » : 6 écrans ; touche la pochette du 1er (l'extrait joue), double-tape le post du 2e (cœur), publie au 5e (la flamme s'allume).
2. Glisse vers la gauche / la droite pour avancer / revenir ; « Passer » saute à « Tu écoutes où ? ».
3. Après l'appli d'écoute : « Choisis au moins 3 artistes », puis (nouveau compte) « Suis au moins 3 personnes ».

## Retouche (03/10) — récap de la semaine dans le TOP
| # | Statut | Explication |
|---|---|---|
| Récap toujours visible | ✅ | La carte « **Ton récap de la semaine 🎧** » (Shakes, likes reçus, genre, flamme) est maintenant **en haut de l'onglet TOP, au-dessus des onglets Amis / Global / Découvrir** : visible tout le temps, **sans croix**. La toucher ouvre le récap en plein écran (façon story) avec « Partager » (vidéo). S'il n'y a pas encore de récap (rien publié la semaine d'avant) : « Publie un Shake cette semaine : ton récap arrive mardi 🎧 ». La carte du fil reste aussi (avec sa croix). Test Playwright : visible sur Amis et Découvrir, ouverture du récap. |

**Test** : onglet TOP → la carte du récap est en haut ; change d'onglet (Global, Découvrir) → elle reste ; touche-la → le récap s'ouvre.

## Correctif (03/10) — Découvrir et « Choisis 3 artistes » ne marchaient pas en vrai
| # | Statut | Explication |
|---|---|---|
| Cause | ✅ | **Trouvée dans les journaux de la base** : 15 erreurs « DELETE requires a WHERE clause » cette nuit. Les connexions de l'appli chargent une protection (`safeupdate`) qui refuse tout `DELETE` / `UPDATE` sans condition ; la fonction qui reconstruit le profil de goût (appelée par Découvrir et par l'enregistrement des artistes) en faisait un, et le classement en faisait deux. **Mes tests ne l'avaient pas vu** : ils passaient par une connexion sans cette protection, et le banc d'essai simule la base. |
| Correctif | ✅ | Les 5 requêtes concernées ont leur condition (`WHERE true`). Vérifié : **plus aucun** `DELETE`/`UPDATE` sans condition dans toutes les fonctions de la base. Testé comme l'appli (compte connecté, délai max 8 s) : Découvrir **1,1 s, 20 sons** ; enregistrement de 3 artistes **1,2 s**. |
| Inscription | ✅ | **« Suis au moins 3 personnes » retiré** : après « Choisis 3 artistes », on arrive directement sur le fil (la personne qui t'a invité reste suivie automatiquement, comme avant). |

**Test** : Classement → Découvrir : la liste s'affiche. Paramètres → « Mes artistes préférés » : choisis-en 3 → Enregistrer → ça se ferme sans erreur. « Revoir le tuto » : après les artistes, retour au fil.


# Section R — peaufinage (05/10/2026)

Règles de la section : chaque migration / fonction en base est **appelée au moins une fois sur la vraie base** après application (en tant que vrai utilisateur, avec les mêmes limites que l'appli : rôle `authenticated`, 8 s, dans une transaction annulée) ; quand un problème est signalé, on cherche **tous les cas de même nature**.

## Étape 0a — R10, partie sauvegarde (avant toute migration)

| Point | Statut | Détail |
|---|---|---|
| Ce que Supabase sauvegarde | ⚠️ rien | Projet en **offre gratuite** : aucune sauvegarde accessible (réservées au Pro et plus ; la doc recommande aux projets gratuits leurs propres copies). Base 27 Mo, fichiers 41 Mo (30 fichiers, 5 espaces). |
| Sauvegarde nocturne | ✅ prête, ⏳ secrets | `.github/workflows/backup.yml` + `scripts/backup/backup.sh` : chaque nuit 02:17 UTC, rôles + structure + données (comptes compris) + tâches planifiées + secrets du coffre (clés des notifications) ; fichiers le dimanche. |
| Dépôt public | ✅ | Chiffrement **age** avant toute sortie ; envoi sur **Backblaze B2** privé (choisi : pas de carte bancaire, contrairement à R2) ; rien dans le dépôt, aucun artefact, journaux = totaux seulement ; tout secret dans GitHub → Secrets. |
| Rotation | ✅ | 7 nuits (`daily/`) + 8 dimanches (`weekly/`, base et fichiers). |
| Test de restauration | ✅ mécanique / ⏳ vraies données | **À chaque passage** : retéléchargement de l'archive, déchiffrement, restauration dans une base Supabase vide lancée sur la machine de GitHub, comptage table par table. **Essai réel sur GitHub (mode essai, base d'exemple) : 502 lignes sur 502, en 125 s** ([run 37366829706](https://github.com/kennykennyjohnny/SHAKEmoi/actions/runs/37366829706)). Deux problèmes trouvés et corrigés en route : un réglage de rôle réservé refusé (rôles restaurés à part) et des tables internes du stockage protégées (exclues : on n'utilise que `buckets` / `objects`). Avec les vraies données : automatique dès que Kenny a posé les 8 secrets. |
| Alerte | ✅ | E-mail de GitHub en cas d'échec + **bandeau sur la page Admin** (table `backup_runs`, fonction `admin_backup_status`, vérifiées sur la vraie base : l'admin voit, un autre compte ne voit rien) ; rouge si échec ou plus de 36 h sans sauvegarde réussie. |
| Restauration | ✅ | `docs/restauration.md` (clic par clic : mise en place, récupérer un fichier, tout remettre dans un projet neuf) + tâche **Restauration** (`restore.yml`) : taper RESTAURER, refuse une base non vide ou la base actuelle, remplace l'ancienne adresse du projet, recompte, remet les fichiers. |
| Pour Kenny | ⏳ | ~20 min : compte Backblaze, clé age, chaîne de connexion, clés S3 Supabase, 8 secrets GitHub (`docs/restauration.md`). Tant que ce n'est pas fait, la tâche de nuit échoue et GitHub envoie un e-mail : c'est voulu (pas de sauvegarde = alerte). |

## Étape 0b — la section Q vérifiée en vrai

| Point | Résultat | Détail |
|---|---|---|
| En ligne | ✅ | Le site sert la dernière version (« Mes artistes préférés », récap TOP, plus de « Suis 3 personnes ») ; 10/10 tests sur le site en ligne. |
| Découvrir (Q8) | ✅ | `get_my_recos` appelé en tant que Kenny : 20 sons en 1,3 s (calcul), 8 ms ensuite ; série suivante OK. |
| Mes artistes préférés (Q9) | ✅ | `save_artist_picks` (3 artistes) : OK en 1,4 s, recalcule les recos. |
| Shakes épinglés (Q11) | ✅ | `pin_post` / `unpin_post` OK. |
| Photo de cercle (Q7) | ✅ | Par un membre **non créateur** : photo changée + message « a changé la photo ». |
| Aperçu de profil (Q5) | ✅ | `get_profile_header` : 16 ms. |
| Même nature que le bug du 03/10 | ✅ | Toutes les fonctions de la base passées au crible : plus aucun DELETE / UPDATE sans WHERE (refusés par la vraie base). |
| **Bug trouvé : calculs de goût** | ✅ corrigé | Les tâches de 02:30 (`shakemoi-taste` et `shakemoi-reco-nightly`) recalculaient les goûts **en même temps** → « duplicate key user_taste_pkey », échec les nuits du 04 et du 05/10 ; même risque si quelqu'un ouvre Découvrir pendant la tâche. Verrous + tables de travail nettoyées + tâche de nuit à 02:45. Rappelé sur la vraie base : `compute_taste_all`, `compute_recos_all`, `get_my_recos`, `save_artist_picks` → OK. |
| Erreurs dans les journaux (24 h) | ✅ corrigé | 406 sur `follows` (vérification « je suis abonné ? » qui exigeait une ligne) → `maybeSingle` ; 403 sur `story_views` (l'appli enregistrait une « vue » de ses propres Shakes éphémères, refusée par la base) → plus envoyé. |
| Banc d'essai | ✅ | 34 tests OK ; « glisser pour fermer l'aperçu de profil » est instable quand la machine est chargée (4 échecs sur 8 aussi sur la version d'avant : timing des gestes simulés, pas l'appli). |

## Lot R1 — R8 : le lien d'invitation depuis Instagram

**Cause exacte (reproduite)** : au chargement, l'appli recale l'adresse sur l'onglet affiché (`/`) — **même pour un visiteur**. Donc `shakemoi.fr/i/kenny` devenait `shakemoi.fr/` en une fraction de seconde. Dans le navigateur d'Instagram, l'invitation tenait encore (mémorisée dans ce navigateur), mais dès que la personne faisait « Ouvrir dans Chrome / Safari » (ou rouvrait le lien plus tard), c'est l'adresse `/` qui partait : **plus d'invitation**. Le navigateur d'Instagram ne partage rien (ni stockage, ni session) avec le vrai navigateur. Test qui le montrait : « adresse après chargement : reçu `/` ». Vérifié aussi : la redirection `shakemoi.fr` → `www` garde bien le chemin et `?ref=` ; le service worker et l'appli installée ne touchent pas à l'adresse ; les aperçus WhatsApp / Instagram lisent bien les balises.

| Point | Statut | Détail |
|---|---|---|
| Adresse gardée | ✅ | Visiteur : l'adresse du lien reste (`/i/`, `/s/`, `/p/`, `/u/`, `/c/<code>`, `/m` — testé un par un). Après « Rejoindre » : `/?ref=kenny`. |
| Parrain par 3 chemins | ✅ | Adresse (`?ref=`), stockage (30 jours), **compte** : envoyé à l'inscription (`options.data.referrer`) et **la base enregistre l'invitation elle-même à la création du compte** (abonnement mutuel + notif), même si l'appli ne va pas au bout. Vérifié sur la vraie base (inscription simulée puis annulée). Le lien du mail de confirmation rapporte `?ref=`. |
| Déjà connecté | ✅ | Le lien accepte l'invitation (si le compte est récent) puis ouvre le profil avec « Suivre ». |
| Bandeau navigateur intégré | ✅ | Instagram, Facebook, TikTok, Snapchat, LinkedIn, X : Android → **Ouvrir dans Chrome** (lien `intent://…`, invitation comprise) ; iPhone → « Touche ••• puis Ouvrir dans le navigateur externe » + **Copier le lien** (avec `?ref=`). Pas de bandeau dans un vrai navigateur (WhatsApp ouvre Chrome). Captures : `docs/captures/R/r8-bandeau-android.png`, `r8-bandeau-iphone.png`. |
| Même nature | ✅ | « Rejoindre » et « S'inscrire » ouvraient la **connexion** au lieu de l'inscription → corrigé partout. Invitation de cercle : `/c/<code>` reste dans l'adresse. Aperçu du lien : « Kenny t'invite sur SHAKEmoi » (prénom, plus « @kenny »). |
| Tests | ✅ | `e2e/invite.mock.spec.ts` : 12 tests (Instagram Android / iPhone, Chrome, navigateur neuf, inscription avec parrain, ouverture du lien dans un autre navigateur, déjà connecté, 5 adresses). |

**Test téléphone (5 min, avec un 2ᵉ téléphone ou un ami)** : 1) Mets `shakemoi.fr/i/kenny` dans une story ou un DM Instagram. 2) Sur l'autre téléphone, ouvre-le depuis Instagram : bandeau « Tu es dans le navigateur d'Instagram ». 3) Android : « Ouvrir dans Chrome » ; iPhone : ••• → « Ouvrir dans le navigateur externe ». 4) « Kenny t'invite » s'affiche encore → Rejoindre → inscription. 5) Tu reçois « … a rejoint SHAKEmoi grâce à toi » et vous vous suivez tous les deux.
