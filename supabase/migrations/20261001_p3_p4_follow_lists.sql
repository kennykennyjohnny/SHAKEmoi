-- P3 : abonnés en commun (« Suivi par Léa, Bapt et 4 autres »), calculé en base.
-- P4 : listes d'abonnés / abonnements de n'importe quel profil, avec « Vous suit »,
--      les gens que je suis en premier, recherche et pages.
-- La table follows ne contient que des identifiants et une date : rien d'autre
-- n'est exposé (le profil public = pseudo, nom, avatar, comme partout ailleurs).

-- Personnes que JE suis et qui suivent p_user. total = nombre complet.
CREATE OR REPLACE FUNCTION public.get_mutual_followers(p_user uuid, p_limit int DEFAULT 3, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, username text, display_name text, profile_album_cover_url text, total bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH m AS (
    SELECT f2.follower_id AS uid, f2.created_at
    FROM follows f1
    JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = p_user
    WHERE f1.follower_id = auth.uid() AND f1.following_id <> p_user AND f2.follower_id <> auth.uid()
  )
  SELECT u.id, u.username, u.display_name, u.profile_album_cover_url, count(*) OVER () AS total
  FROM m JOIN users_profile u ON u.id = m.uid
  ORDER BY m.created_at DESC
  LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset);
$$;
REVOKE ALL ON FUNCTION public.get_mutual_followers(uuid, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mutual_followers(uuid, int, int) TO authenticated;

-- Abonnés (kind = 'followers') ou abonnements ('following') de p_user.
-- i_follow : je suis cette personne ; follows_me : elle me suit (badge « Vous suit »).
CREATE OR REPLACE FUNCTION public.get_follow_list(p_user uuid, p_kind text, p_search text DEFAULT NULL, p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, username text, display_name text, profile_album_cover_url text, i_follow boolean, follows_me boolean)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH l AS (
    SELECT CASE WHEN p_kind = 'followers' THEN f.follower_id ELSE f.following_id END AS uid, f.created_at
    FROM follows f
    WHERE (p_kind = 'followers' AND f.following_id = p_user)
       OR (p_kind = 'following' AND f.follower_id = p_user)
  )
  SELECT u.id, u.username, u.display_name, u.profile_album_cover_url,
         EXISTS (SELECT 1 FROM follows a WHERE a.follower_id = auth.uid() AND a.following_id = u.id) AS i_follow,
         EXISTS (SELECT 1 FROM follows b WHERE b.follower_id = u.id AND b.following_id = auth.uid()) AS follows_me
  FROM l JOIN users_profile u ON u.id = l.uid
  WHERE p_search IS NULL OR btrim(p_search) = ''
     OR u.username ILIKE '%' || replace(replace(btrim(p_search), '%', '\%'), '_', '\_') || '%'
     OR u.display_name ILIKE '%' || replace(replace(btrim(p_search), '%', '\%'), '_', '\_') || '%'
  -- Les gens que je suis en premier, puis moi, puis les plus récents.
  ORDER BY EXISTS (SELECT 1 FROM follows a WHERE a.follower_id = auth.uid() AND a.following_id = u.id) DESC,
           (u.id = auth.uid()) DESC, l.created_at DESC, u.id
  LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset);
$$;
REVOKE ALL ON FUNCTION public.get_follow_list(uuid, text, text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_list(uuid, text, text, int, int) TO authenticated;
