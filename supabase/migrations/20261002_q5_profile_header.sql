-- Q5 : l'aperçu de profil en UNE requête.
-- Avant : profil, puis 6 requêtes (abonnés, suivis, je suis ?, Shakes
-- éphémères, à la une, nombre de shakes), puis compatibilité, abonnés en
-- commun, série, blocage… ~14 requêtes en 3 vagues successives.
-- SECURITY INVOKER : chaque morceau respecte les règles d'accès de la
-- personne qui regarde (posts privés / de cercle, Shakes éphémères des seuls
-- abonnements, blocages). Les fonctions appelées gardent leurs propres règles.
CREATE OR REPLACE FUNCTION public.get_profile_header(p_user uuid DEFAULT NULL, p_username text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_profile jsonb;
  v_block text := 'none';
  v_mutual jsonb := NULL;
BEGIN
  SELECT u.id, jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
           'bio', u.bio, 'profile_album_cover_url', u.profile_album_cover_url)
    INTO v_id, v_profile
  FROM users_profile u
  WHERE (p_user IS NOT NULL AND u.id = p_user)
     OR (p_user IS NULL AND p_username IS NOT NULL AND u.username = lower(p_username))
  LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  IF v_me IS NOT NULL AND v_me <> v_id THEN
    v_block := coalesce(public.get_block_status(v_id), 'none');
  END IF;
  IF v_block <> 'none' THEN
    RETURN jsonb_build_object('profile', v_profile, 'block', v_block);
  END IF;

  IF v_me IS NOT NULL AND v_me <> v_id THEN
    SELECT jsonb_build_object(
             'users', coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'username', m.username, 'display_name', m.display_name,
                        'profile_album_cover_url', m.profile_album_cover_url)), '[]'::jsonb),
             'total', coalesce(max(m.total), 0))
      INTO v_mutual
    FROM public.get_mutual_followers(v_id, 3, 0) m;
  END IF;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'block', v_block,
    'counts', jsonb_build_object(
      'shakes', (SELECT count(*) FROM posts p WHERE p.user_id = v_id AND p.is_reshake IS NOT TRUE AND p.is_private IS NOT TRUE AND p.circle_id IS NULL),
      'followers', (SELECT count(*) FROM follows f WHERE f.following_id = v_id),
      'following', (SELECT count(*) FROM follows f WHERE f.follower_id = v_id)),
    'is_following', v_me IS NOT NULL AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v_me AND f.following_id = v_id),
    'follows_me', v_me IS NOT NULL AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v_id AND f.following_id = v_me),
    'mutual', v_mutual,
    'taste', CASE WHEN v_me IS NOT NULL AND v_me <> v_id THEN public.get_taste(v_id) END,
    'streak', public.get_streak(v_id),
    'stories', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM stories s
                 WHERE s.user_id = v_id AND s.expires_at > now()), '[]'::jsonb),
    'pinned_stories', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at) FROM stories s
                 WHERE s.user_id = v_id AND s.is_pinned), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.get_profile_header(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_header(uuid, text) TO anon, authenticated;
