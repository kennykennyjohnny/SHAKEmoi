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
- J1 Bloquer / Signaler (personne, post, message) — exigé par les stores.
- D4 / D6 vraies notifications push (appli fermée) — nécessite Web Push + service worker + clés VAPID.
- G9 Connexion Google / Apple.

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
