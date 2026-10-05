-- R10 : témoin des sauvegardes nocturnes (écrit par la tâche GitHub « Sauvegarde »,
-- lu par la page Admin). Appliquée et vérifiée sur la vraie base le 05/10/2026
-- (admin : voit la ligne ; autre compte : rien).
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'db' CHECK (kind IN ('db','db+files')),
  ok boolean NOT NULL,
  restore_ok boolean,
  db_bytes bigint,
  files_bytes bigint,
  tables int,
  rows_total bigint,
  files int,
  message text
);
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backup_runs_admin_read ON public.backup_runs;
CREATE POLICY backup_runs_admin_read ON public.backup_runs FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.backup_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.backup_runs FROM authenticated;
GRANT SELECT ON public.backup_runs TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_backup_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'last_ok', (SELECT to_jsonb(b) FROM public.backup_runs b WHERE ok AND coalesce(restore_ok, true) ORDER BY created_at DESC LIMIT 1),
    'last', (SELECT to_jsonb(b) FROM public.backup_runs b ORDER BY created_at DESC LIMIT 1),
    'runs_7d', (SELECT count(*) FROM public.backup_runs WHERE created_at > now() - interval '7 days'))
$$;
REVOKE ALL ON FUNCTION public.admin_backup_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_backup_status() TO authenticated;
