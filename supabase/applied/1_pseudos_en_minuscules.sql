-- ✅ APPLIQUÉ le 29/09/2026 (migration « pseudos_en_minuscules »), avec l'OK de Kenny.
-- G2 : pseudos (@) en minuscules, unicité sans casse en base.
-- Les noms d'affichage restent libres ; ceux qui étaient vides reprennent le pseudo tel quel.
-- Anciens pseudos gardés dans old_usernames (migration username_history) → /u/Ancien redirige.

-- 0. Nom d'affichage vide : on garde l'apparence actuelle (le pseudo tel quel, majuscules comprises).
UPDATE public.users_profile SET display_name = username WHERE display_name IS NULL OR trim(display_name) = '';

-- 1. Le conflit « Raph » / « raph ».
UPDATE public.users_profile SET username = 'raph2' WHERE id = 'd23678a7-7919-4aca-b2aa-b4d7f03fb1ac' AND username = 'raph';
UPDATE public.users_profile SET username = 'raph'  WHERE id = '9a598e97-a3e8-4ce7-99c7-3a34517f88ce' AND username = 'Raph';

-- 2. Tous les autres pseudos en minuscules (le déclencheur vérifie la règle et garde l'ancien pseudo).
UPDATE public.users_profile SET username = lower(username) WHERE username <> lower(username);

-- 3. Unicité sans casse garantie par la base.
CREATE UNIQUE INDEX IF NOT EXISTS users_profile_username_lower_unique ON public.users_profile (lower(username));
