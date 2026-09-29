-- ⚠️ EN ATTENTE DE L'OK DE KENNY — NE PAS LANCER SANS VALIDATION.
-- G2 : mettre les pseudos existants dans la règle (minuscules) et rendre
-- l'unicité sans casse obligatoire en base.
--
-- Situation au 29/09/2026 : 27 pseudos sur 30 hors règle, tous à cause des
-- majuscules (aucun espace ni accent). Un seul conflit : « Raph » et « raph ».
--   - « Raph »  (9a598e97…, créé le 16/12/2025, 18 posts) → raph
--   - « raph »  (d23678a7…, créé le 10/02/2026, 0 post)   → raph2
-- Les anciens liens /u/Kenny continuent de marcher (recherche sans casse).
-- Les personnes voient leur pseudo passer en minuscules, rien d'autre.

BEGIN;

-- 1. Le conflit d'abord.
UPDATE public.users_profile SET username = 'raph2' WHERE id = 'd23678a7-7919-4aca-b2aa-b4d7f03fb1ac' AND username = 'raph';
UPDATE public.users_profile SET username = 'raph'  WHERE id = '9a598e97-a3e8-4ce7-99c7-3a34517f88ce' AND username = 'Raph';

-- 2. Tous les autres en minuscules (le déclencheur vérifie la règle).
UPDATE public.users_profile SET username = lower(username) WHERE username <> lower(username);

-- 3. Vérification : doit renvoyer 0 ligne.
SELECT username FROM public.users_profile WHERE username !~ '^[a-z0-9._-]{3,20}$';

-- 4. Unicité sans casse garantie par la base.
CREATE UNIQUE INDEX IF NOT EXISTS users_profile_username_lower_unique ON public.users_profile (lower(username));

COMMIT;
