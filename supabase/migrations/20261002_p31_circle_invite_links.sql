-- P31 : lien d'invitation de cercle régénérable. Le lien porte un code
-- (/c/<code>) au lieu de l'id du cercle ; tout membre peut générer un nouveau
-- code, ce qui rend l'ancien lien invalide. On ne rejoint plus un cercle avec
-- son seul id : il faut un code valide (règle imposée ici, en base).

-- Code de 8 caractères sans lettres ambiguës (pas de O/0, I/1), tiré au hasard
-- de façon sûre (pgcrypto), unique.
CREATE OR REPLACE FUNCTION public.new_circle_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path TO 'public' AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
BEGIN
  LOOP
    b := extensions.gen_random_bytes(8);
    c := '';
    FOR i IN 0..7 LOOP
      c := c || substr(alphabet, 1 + (get_byte(b, i) % 32), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM circles WHERE upper(invite_code) = c);
  END LOOP;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.new_circle_code() FROM public, anon, authenticated;

-- Tout nouveau cercle reçoit un code sûr (celui proposé par l'appli est remplacé).
CREATE OR REPLACE FUNCTION public.circles_set_invite_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.invite_code := public.new_circle_code();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.circles_set_invite_code() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS circles_invite_code ON public.circles;
CREATE TRIGGER circles_invite_code BEFORE INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.circles_set_invite_code();

-- On ne change le code que par la fonction dédiée (pas par une simple mise à jour).
CREATE OR REPLACE FUNCTION public.circles_lock_invite_code()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invite_code IS DISTINCT FROM OLD.invite_code AND current_setting('shakemoi.regen', true) IS DISTINCT FROM 'on' THEN
    NEW.invite_code := OLD.invite_code;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS circles_invite_code_lock ON public.circles;
CREATE TRIGGER circles_invite_code_lock BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.circles_lock_invite_code();

-- Page d'invitation (visiteur ou membre) : aperçu par le code.
CREATE OR REPLACE FUNCTION public.get_circle_invite(p_code text)
RETURNS TABLE(id uuid, name text, photo_url text, member_count bigint, is_member boolean, invite_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.photo_url,
         (SELECT count(*) FROM circle_members m WHERE m.circle_id = c.id),
         auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = auth.uid()),
         c.invite_code
  FROM circles c
  WHERE length(btrim(coalesce(p_code, ''))) >= 4 AND upper(c.invite_code) = upper(btrim(p_code))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_circle_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_circle_invite(text) TO anon, authenticated;

-- Rejoindre avec un code valide. Renvoie l'id du cercle.
CREATE OR REPLACE FUNCTION public.join_circle_by_code(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_id FROM circles WHERE length(btrim(coalesce(p_code, ''))) >= 4 AND upper(invite_code) = upper(btrim(p_code));
  IF v_id IS NULL THEN RAISE EXCEPTION 'invite link expired'; END IF;
  IF EXISTS (SELECT 1 FROM circle_removals WHERE circle_id = v_id AND user_id = uid) THEN
    RAISE EXCEPTION 'removed from circle';
  END IF;
  INSERT INTO circle_members (circle_id, user_id) VALUES (v_id, uid) ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.join_circle_by_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_circle_by_code(text) TO authenticated;

-- L'ancienne façon (avec l'id) ne fait plus entrer personne : seulement « déjà membre ».
CREATE OR REPLACE FUNCTION public.join_circle(p_circle_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM circles WHERE id = p_circle_id) THEN RAISE EXCEPTION 'circle not found'; END IF;
  IF EXISTS (SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = uid) THEN RETURN true; END IF;
  RAISE EXCEPTION 'invite link expired';
END $$;

-- Nouveau lien : n'importe quel membre (comme le renommage, P8).
CREATE OR REPLACE FUNCTION public.regenerate_circle_invite(p_circle_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  v_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connecte-toi pour changer le lien.'; END IF;
  IF NOT public.is_circle_member(p_circle_id, uid) THEN
    RAISE EXCEPTION 'Seuls les membres du cercle peuvent changer le lien.';
  END IF;
  v_code := public.new_circle_code();
  PERFORM set_config('shakemoi.regen', 'on', true);
  UPDATE circles SET invite_code = v_code WHERE id = p_circle_id;
  PERFORM set_config('shakemoi.regen', 'off', true);
  RETURN v_code;
END $$;
REVOKE ALL ON FUNCTION public.regenerate_circle_invite(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_circle_invite(uuid) TO authenticated;

-- L'aperçu par id ne sert plus aux visiteurs (anciens liens = invalides).
REVOKE ALL ON FUNCTION public.get_circle_preview(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_preview(uuid) TO authenticated;
