-- ✅ APPLIQUÉ le 29/09/2026 (migration « reshakes_en_double »), avec l'OK de Kenny.
-- F1 : 3 reshakes interdits supprimés (détail dans MATIN.md), contrainte en base.
-- Commentaires et likes de ces reshakes : déplacés sur le post d'origine (rien de perdu).

UPDATE public.comments c SET post_id = r.original_post_id
FROM public.posts r
WHERE c.post_id = r.id AND r.id IN ('61e41c58-7012-4236-adc9-8e0fcbc3b052','3f2771e8-a3f6-4ef2-9016-a184886d38d1','7416de4c-8f0f-4d25-88b9-0ba424d94853');

INSERT INTO public.likes (post_id, user_id, created_at)
SELECT r.original_post_id, l.user_id, l.created_at
FROM public.likes l JOIN public.posts r ON r.id = l.post_id
WHERE r.id IN ('61e41c58-7012-4236-adc9-8e0fcbc3b052','3f2771e8-a3f6-4ef2-9016-a184886d38d1','7416de4c-8f0f-4d25-88b9-0ba424d94853')
ON CONFLICT (post_id, user_id) DO NOTHING;

DELETE FROM public.posts WHERE id IN (
  '61e41c58-7012-4236-adc9-8e0fcbc3b052',
  '3f2771e8-a3f6-4ef2-9016-a184886d38d1',
  '7416de4c-8f0f-4d25-88b9-0ba424d94853'
) AND is_reshake;

CREATE UNIQUE INDEX IF NOT EXISTS posts_one_reshake_per_user
  ON public.posts (user_id, original_post_id) WHERE is_reshake;
