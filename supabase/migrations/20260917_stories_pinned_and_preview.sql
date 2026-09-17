-- ============================================================
-- SHAKEmoi — Stories : épinglage à vie + cache d'extrait
-- Appliqué en prod le 2026-09-17
-- ============================================================

-- Épingler une story sur son profil : elle n'expire plus.
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Extrait 30s mémorisé à la création (évite de le re-résoudre à chaque lecture).
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS preview_url text;

CREATE INDEX IF NOT EXISTS idx_stories_pinned ON public.stories(user_id, is_pinned)
  WHERE is_pinned = true;
