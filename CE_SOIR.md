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
| G3 | 🟡 | « Modifier le profil » : pseudo mis en minuscules, vérifié (règle + doublon) avant d'enregistrer, et affiché seulement si la base accepte. Reste la contrainte en base (LOT 6). |

## Backlog v2 (hors périmètre ce soir)
- J1 Bloquer / Signaler (personne, post, message) — exigé par les stores.
- D4 / D6 vraies notifications push (appli fermée) — nécessite Web Push + service worker + clés VAPID.
- G9 Connexion Google / Apple.

## En attente de ton OK
(rien pour l'instant)
