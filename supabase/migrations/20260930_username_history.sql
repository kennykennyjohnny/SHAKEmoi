-- G2 (suite, OK de Kenny) — Trace des anciens pseudos et redirection des
-- anciens liens /u/Ancien. Idempotent. Ne touche qu'au pseudo (username) ;
-- le nom d'affichage reste libre.

CREATE TABLE IF NOT EXISTS public.old_usernames (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  old_username text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS old_usernames_lower_idx ON public.old_usernames (lower(old_username));
ALTER TABLE public.old_usernames ENABLE ROW LEVEL SECURITY;
-- Pas de lecture directe : on passe par resolve_username.

CREATE OR REPLACE FUNCTION public.users_profile_log_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    INSERT INTO old_usernames (user_id, old_username) VALUES (OLD.id, OLD.username);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_profile_log_username ON public.users_profile;
CREATE TRIGGER users_profile_log_username AFTER UPDATE OF username ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.users_profile_log_username();

-- Profil d'un lien /u/<pseudo> : pseudo actuel sans tenir compte des
-- majuscules, sinon un ancien pseudo (le plus récent).
CREATE OR REPLACE FUNCTION public.resolve_username(p_username text)
RETURNS TABLE (id uuid, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT u.id, u.username FROM users_profile u
    WHERE lower(u.username) = lower(trim(p_username))
    ORDER BY (u.username = trim(p_username)) DESC LIMIT 1)
  UNION ALL
  (SELECT u.id, u.username FROM old_usernames o JOIN users_profile u ON u.id = o.user_id
    WHERE lower(o.old_username) = lower(trim(p_username))
      AND NOT EXISTS (SELECT 1 FROM users_profile x WHERE lower(x.username) = lower(trim(p_username)))
    ORDER BY o.changed_at DESC LIMIT 1)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_username(text) TO anon, authenticated;
