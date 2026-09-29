-- ⚠️ EN ATTENTE DE L'OK DE KENNY — NE PAS LANCER SANS VALIDATION.
-- F1 : nettoyer les reshakes interdits par la nouvelle règle, puis poser la
-- contrainte d'unicité en base. Ça SUPPRIME 3 posts (des reshakes).
--
-- Au 29/09/2026 :
--   - 1 reshake en double (Kenny a reshaké 2 fois le post 70843e93…) :
--       on garde le premier (358ade4a…, 14/04 09:24), on supprime 61e41c58… (14/04 11:38)
--   - 2 reshakes de son propre post :
--       3f2771e8… (Raph, 16/12/2025) et 7416de4c… (Kenny, 14/04/2026)
-- Les likes/commentaires de ces 3 reshakes partent avec eux (en pratique ils
-- sont comptés sur le post d'origine).

BEGIN;

DELETE FROM public.posts WHERE id IN (
  '61e41c58-7012-4236-adc9-8e0fcbc3b052',  -- doublon
  '3f2771e8-a3f6-4ef2-9016-a184886d38d1',  -- reshake de son propre post
  '7416de4c-8f0f-4d25-88b9-0ba424d94853'   -- reshake de son propre post
) AND is_reshake;

-- Un seul reshake par personne et par post, garanti par la base.
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_reshake_per_user
  ON public.posts (user_id, original_post_id) WHERE is_reshake;

COMMIT;
