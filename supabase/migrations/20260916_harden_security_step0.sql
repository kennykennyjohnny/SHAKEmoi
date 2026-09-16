-- ============================================================
-- SHAKEmoi — Durcissement sécurité (étape 0) — appliqué en prod le 2026-09-16
-- ============================================================

-- 1) RLS sur time_capsule_participants (seule table exposée) + policies
ALTER TABLE public.time_capsule_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tcp_select" ON public.time_capsule_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.time_capsules tc
               WHERE tc.id = capsule_id AND tc.user_id = auth.uid())
  );
CREATE POLICY "tcp_insert" ON public.time_capsule_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tcp_update" ON public.time_capsule_participants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tcp_delete" ON public.time_capsule_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) Supprimer les vues SECURITY DEFINER inutilisées (user_stats exposait email)
DROP VIEW IF EXISTS public.posts_with_user;
DROP VIEW IF EXISTS public.user_stats;

-- 3) Fixer search_path sur toutes les fonctions du schéma public (26 findings)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
  END LOOP;
END $$;

-- 4) Bloquer l'exécution anonyme des RPC compteurs (anti-abus), garder les connectés
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'increment_likes(uuid)','decrement_likes(uuid)',
    'increment_comments(uuid)','decrement_comments(uuid)',
    'increment_reshakes_count(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;
