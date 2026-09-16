-- ============================================================
-- SHAKEmoi — Durcissement sécurité (étape 0, suite) — appliqué en prod le 2026-09-16
-- Bloque l'exécution anonyme des dernières fonctions SECURITY DEFINER
-- (log_mood / update_music_taste / update_streak = fonctions de trigger ;
--  is_circle_member = helper). On garde l'accès aux rôles connectés/serveur.
-- ============================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'log_mood()',
    'update_music_taste()',
    'update_streak()',
    'is_circle_member(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;
