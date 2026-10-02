-- Q8 (3/3) : catalogue, classement, lecture instantanée, évaluation. Voir docs/reco.md.

-- ---------- Catalogue (écrit par la fonction serveur reco-catalog) ----------
CREATE TABLE IF NOT EXISTS public.reco_jobs (key text PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.reco_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.catalog_mark(p_key text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO reco_jobs (key, ran_at) VALUES (p_key, now()) ON CONFLICT (key) DO UPDATE SET ran_at = now();
$$;
CREATE OR REPLACE FUNCTION public.catalog_due(p_key text, p_hours int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM reco_jobs WHERE key = p_key AND ran_at > now() - make_interval(hours => p_hours));
$$;

-- Ajoute / fusionne des titres : les sources se cumulent (on garde le meilleur score par source).
CREATE OR REPLACE FUNCTION public.catalog_upsert(p_rows jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; n int := 0; k text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    k := song_key(r->>'title', r->>'artist');
    IF k IS NULL OR k = '|' THEN CONTINUE; END IF;
    INSERT INTO catalog_tracks AS c (song_key, title, artist, artist_key, deezer_id, cover_url, preview_url, deezer_rank, release_date, sources, fetched_at)
    VALUES (k, r->>'title', r->>'artist', artist_key(r->>'artist'), (r->>'deezer_id')::bigint, r->>'cover_url', r->>'preview_url',
            (r->>'deezer_rank')::int, nullif(r->>'release_date', '')::date, jsonb_build_object(r->>'source', (r->>'score')::float8), now())
    ON CONFLICT (song_key) DO UPDATE SET
      deezer_id = coalesce(c.deezer_id, EXCLUDED.deezer_id),
      cover_url = coalesce(EXCLUDED.cover_url, c.cover_url),
      preview_url = coalesce(c.preview_url, EXCLUDED.preview_url),
      deezer_rank = coalesce(EXCLUDED.deezer_rank, c.deezer_rank),
      release_date = coalesce(c.release_date, EXCLUDED.release_date),
      sources = c.sources || jsonb_build_object(r->>'source',
        greatest(coalesce((c.sources->>(r->>'source'))::float8, 0), (r->>'score')::float8)),
      fetched_at = now();
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Artistes de départ : les 6 artistes forts de chaque profil + les artistes
-- choisis au tuto ; ceux jamais rafraîchis (ou depuis 30 jours) d'abord.
CREATE OR REPLACE FUNCTION public.reco_artist_seeds(p_limit int DEFAULT 20)
RETURNS TABLE (artist_key text, name text, deezer_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
BEGIN
  -- Les artistes choisis au tuto ont aussi leur fiche (pour les retrouver ici).
  INSERT INTO artist_profiles (artist_key, name, deezer_id, picture_url, source)
  SELECT DISTINCT ON (ap.artist_key) ap.artist_key, ap.name, ap.deezer_id, ap.picture_url, 'tuto'
  FROM artist_picks ap WHERE NOT EXISTS (SELECT 1 FROM artist_profiles p WHERE p.artist_key = ap.artist_key)
  ON CONFLICT DO NOTHING;
  RETURN QUERY
  WITH strong AS (
    SELECT t.feat AS k FROM (
      SELECT ut.feat, row_number() OVER (PARTITION BY ut.user_id ORDER BY ut.raw DESC) AS rn
      FROM user_taste ut WHERE ut.typ = 'a') t WHERE t.rn <= 6
    UNION SELECT ap.artist_key FROM artist_picks ap
  )
  SELECT p.artist_key, p.name, p.deezer_id FROM artist_profiles p JOIN strong s ON s.k = p.artist_key
  WHERE p.catalog_at IS NULL OR p.catalog_at < now() - interval '30 days'
  ORDER BY p.catalog_at NULLS FIRST LIMIT p_limit;
END $$;

-- Sons forts de chacun (pour Last.fm « titres similaires »).
CREATE OR REPLACE FUNCTION public.reco_track_seeds(p_limit int DEFAULT 12)
RETURNS TABLE (skey text, track_name text, artist text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT ON (s.skey) s.skey, s.track_name, s.artist FROM taste_signals(NULL) s
  WHERE s.w > 0.6 AND NOT EXISTS (SELECT 1 FROM catalog_tracks c WHERE c.sources ? ('lfm:' || s.skey))
  ORDER BY s.skey, s.w DESC LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.catalog_mark(text), public.catalog_due(text, int), public.catalog_upsert(jsonb),
  public.reco_artist_seeds(int), public.reco_track_seeds(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_mark(text), public.catalog_due(text, int), public.catalog_upsert(jsonb),
  public.reco_artist_seeds(int), public.reco_track_seeds(int) TO service_role;

-- ---------- Le classement d'une personne ----------
-- p_before : comme si on était à cette date (évaluation hors ligne).
-- p_fresh_series : écarter ce qui a déjà été montré aujourd'hui (« tirer pour une nouvelle série »).
CREATE OR REPLACE FUNCTION public.reco_rank(p_user uuid, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 50, p_fresh_series boolean DEFAULT false)
RETURNS TABLE (rank int, skey text, track jsonb, score double precision, reason text, reason_kind text, components jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE
  v_cut timestamptz := coalesce(p_before, now());
  v_nsig int;
  v_new boolean;
  v_top3 text[];
  v_neigh text[];
  v_pos int;
  v_page int;
  v_explore boolean;
  v_found boolean;
  c record;
  w_content float8; w_social float8; w_src float8; w_trend float8;
BEGIN
  DROP TABLE IF EXISTS rk_taste, rk_mine, rk_seed, rk_fam, rk_cand, rk_scored, rk_pick, rk_quota, rk_crowd;

  -- 1. Mon goût (le même que pour la compatibilité).
  IF p_before IS NULL THEN
    CREATE TEMP TABLE rk_taste ON COMMIT DROP AS SELECT ut.typ, ut.feat, ut.v, ut.raw FROM user_taste ut WHERE ut.user_id = p_user;
  ELSE
    CREATE TEMP TABLE rk_taste ON COMMIT DROP AS SELECT tv.typ, tv.feat, tv.v, tv.raw FROM taste_vectors(p_before) tv WHERE tv.user_id = p_user;
  END IF;
  CREATE TEMP TABLE rk_mine ON COMMIT DROP AS SELECT s.skey, s.akey, s.kind, s.w FROM taste_signals(p_before) s WHERE s.user_id = p_user;
  SELECT count(*) INTO v_nsig FROM rk_mine WHERE w > 0;
  v_new := v_nsig < 5;

  CREATE TEMP TABLE rk_seed ON COMMIT DROP AS
  SELECT t.feat AS akey, t.raw / nullif(max(t.raw) OVER (), 0) AS w FROM rk_taste t WHERE t.typ = 'a' AND t.raw > 0;
  CREATE TEMP TABLE rk_fam ON COMMIT DROP AS
  SELECT t.feat AS fam, t.raw / nullif(sum(t.raw) OVER (), 0) AS share FROM rk_taste t WHERE t.typ = 'f' AND t.raw > 0;
  SELECT array_agg(fam ORDER BY share DESC) INTO v_top3 FROM (SELECT fam, share FROM rk_fam ORDER BY share DESC LIMIT 3) x;
  v_top3 := coalesce(v_top3, '{}');
  -- Familles voisines : celles qu'aiment AUSSI les gens qui aiment mes familles
  -- principales (co-occurrence dans les profils de goût), hors mes 3 familles.
  WITH mine AS (SELECT rf.fam, rf.share FROM rk_fam rf ORDER BY rf.share DESC LIMIT 3),
  others AS (SELECT ut.user_id, ut.feat AS fam, ut.raw / sum(ut.raw) OVER (PARTITION BY ut.user_id) AS share
             FROM user_taste ut WHERE ut.typ = 'f' AND ut.user_id <> p_user AND ut.raw > 0),
  co AS (SELECT o2.fam, sum(m.share * o1.share * o2.share) AS w
         FROM mine m JOIN others o1 ON o1.fam = m.fam JOIN others o2 ON o2.user_id = o1.user_id
         WHERE o2.fam <> ALL (v_top3) GROUP BY o2.fam)
  SELECT array_agg(z.fam ORDER BY z.w DESC) INTO v_neigh FROM (SELECT co.fam, co.w FROM co ORDER BY co.w DESC LIMIT 3) z;
  v_neigh := coalesce(v_neigh, '{}');

  -- 2. Candidats.
  CREATE TEMP TABLE rk_cand (
    skey text, title text, artist text, akey text, cover_url text, preview_url text, deezer_id bigint,
    spotify_url text, deezer_url text, post_id uuid, release_date date, drank int,
    src text, src_score float8 DEFAULT 0, seed text,
    social float8 DEFAULT 0, who uuid, who_kind text, who_compat int,
    trend float8 DEFAULT 0
  ) ON COMMIT DROP;

  -- a. Social : partagé / reshaké / liké EN PUBLIC par des gens qui me ressemblent (ou que je suis).
  INSERT INTO rk_cand (skey, title, artist, akey, cover_url, preview_url, spotify_url, deezer_url, post_id, src, social, who, who_kind, who_compat)
  SELECT song_key(p.track_name, p.artist), p.track_name, p.artist, artist_key(p.artist), p.cover_url, p.preview_url, p.spotify_url, p.deezer_url, p.id,
         'social', coalesce(ts.score, 50) / 100.0 * act.w * power(0.5, greatest(0, extract(epoch FROM (v_cut - act.at))) / 86400.0 / 60),
         act.uid, act.kind, ts.score
  FROM (
    SELECT p2.id AS post_id, p2.user_id AS uid, 1.0 AS w, 'post' AS kind, p2.created_at AS at FROM posts p2
      WHERE p2.is_reshake IS NOT TRUE AND p2.circle_id IS NULL AND p2.is_private IS NOT TRUE
    UNION ALL SELECT r.original_post_id, r.user_id, 0.8, 'reshake', r.created_at FROM posts r
      WHERE r.is_reshake AND r.circle_id IS NULL AND r.is_private IS NOT TRUE
    UNION ALL SELECT l.post_id, l.user_id, 0.5, 'like', l.created_at FROM likes l
  ) act
  JOIN posts p ON p.id = act.post_id AND p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL
  LEFT JOIN taste_scores ts ON ts.user_a = least(p_user, act.uid) AND ts.user_b = greatest(p_user, act.uid)
  LEFT JOIN follows f ON f.follower_id = p_user AND f.following_id = act.uid
  WHERE act.uid <> p_user AND act.at < v_cut AND (ts.score >= 40 OR f.follower_id IS NOT NULL)
    AND NOT is_blocked_between(p_user, act.uid) AND NOT is_blocked_between(p_user, p.user_id);

  -- Artistes partagés EN PUBLIC par des gens qui me ressemblent (récents d'abord) :
  -- « réseau ». Sert à faire entrer leurs titres phares et à les remonter.
  CREATE TEMP TABLE rk_crowd ON COMMIT DROP AS
  SELECT x.akey, sum(x.w) AS w, (array_agg(x.uid ORDER BY x.w DESC))[1] AS who, (array_agg(x.compat ORDER BY x.w DESC))[1] AS compat
  FROM (
    SELECT artist_key(p.artist) AS akey, p.user_id AS uid, ts.score AS compat,
           coalesce(ts.score, 50) / 100.0 * power(0.5, greatest(0, extract(epoch FROM (v_cut - p.created_at))) / 86400.0 / 60) AS w
    FROM posts p
    LEFT JOIN taste_scores ts ON ts.user_a = least(p_user, p.user_id) AND ts.user_b = greatest(p_user, p.user_id)
    LEFT JOIN follows f ON f.follower_id = p_user AND f.following_id = p.user_id
    WHERE p.user_id <> p_user AND p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.track_name IS NOT NULL AND p.created_at < v_cut
      AND (ts.score >= 40 OR f.follower_id IS NOT NULL) AND NOT is_blocked_between(p_user, p.user_id)
  ) x WHERE x.akey IS NOT NULL GROUP BY x.akey;

  -- b-e. Catalogue : artistes proches, plus de mes artistes, classements par genre, nouveautés, Last.fm.
  INSERT INTO rk_cand (skey, title, artist, akey, cover_url, preview_url, deezer_id, deezer_url, release_date, drank, src, src_score, seed)
  SELECT c.song_key, c.title, c.artist, c.artist_key, c.cover_url, c.preview_url, c.deezer_id,
         'https://www.deezer.com/track/' || c.deezer_id, c.release_date, c.deezer_rank,
         split_part(s.key, ':', 1),
         s.value::float8 * CASE split_part(s.key, ':', 1)
           WHEN 'rel' THEN coalesce(sd.w, 0)
           WHEN 'top' THEN greatest(coalesce(sd.w, 0) * 0.85, least(1, coalesce(cr.w, 0)) * 0.7)
           WHEN 'chart' THEN coalesce(fm.share, 0) * 1.5
           WHEN 'fresh' THEN coalesce(fm.share, 0) * 1.5
           WHEN 'lfm' THEN 0.9
           ELSE 0 END,
         substr(s.key, length(split_part(s.key, ':', 1)) + 2)
  FROM catalog_tracks c
  CROSS JOIN LATERAL jsonb_each_text(c.sources) AS s(key, value)
  LEFT JOIN rk_seed sd ON split_part(s.key, ':', 1) IN ('rel', 'top') AND sd.akey = substr(s.key, length(split_part(s.key, ':', 1)) + 2)
  LEFT JOIN rk_fam fm ON split_part(s.key, ':', 1) IN ('chart', 'fresh') AND fm.fam = substr(s.key, length(split_part(s.key, ':', 1)) + 2)
  LEFT JOIN rk_crowd cr ON split_part(s.key, ':', 1) = 'top' AND cr.akey = substr(s.key, 5)
  WHERE sd.akey IS NOT NULL OR fm.fam IS NOT NULL OR cr.akey IS NOT NULL
     OR (s.key LIKE 'lfm:%' AND substr(s.key, 5) IN (SELECT m.skey FROM rk_mine m WHERE m.w > 0));

  -- f. Tendances SHAKEmoi (Global, 30 derniers jours).
  INSERT INTO rk_cand (skey, title, artist, akey, cover_url, preview_url, spotify_url, deezer_url, post_id, src, trend)
  SELECT DISTINCT ON (t.k) t.k, p.track_name, p.artist, artist_key(p.artist), p.cover_url, p.preview_url, p.spotify_url, p.deezer_url, p.id, 'trend', t.n
  FROM (SELECT song_key(track_name, artist) k, count(*)::float8 n FROM posts
        WHERE circle_id IS NULL AND is_private IS NOT TRUE AND track_name IS NOT NULL AND created_at < v_cut AND created_at > v_cut - interval '30 days'
        GROUP BY 1) t
  JOIN posts p ON song_key(p.track_name, p.artist) = t.k AND p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.created_at < v_cut
  ORDER BY t.k, p.created_at DESC;

  -- Nouveau compte : les sons de la personne qui m'a invité.
  IF v_new THEN
    INSERT INTO rk_cand (skey, title, artist, akey, cover_url, preview_url, spotify_url, deezer_url, post_id, src, src_score, who, who_kind)
    SELECT song_key(p.track_name, p.artist), p.track_name, p.artist, artist_key(p.artist), p.cover_url, p.preview_url, p.spotify_url, p.deezer_url, p.id,
           'invite', 0.8, p.user_id, 'invite'
    FROM invites i JOIN posts p ON p.user_id = i.inviter_id AND p.circle_id IS NULL AND p.is_private IS NOT TRUE AND p.is_reshake IS NOT TRUE
    WHERE i.invitee_id = p_user AND p.created_at < v_cut;
  END IF;

  -- 3. Un son = une ligne (métadonnées du catalogue en priorité : extrait fiable).
  CREATE TEMP TABLE rk_scored ON COMMIT DROP AS
  WITH m AS (
    SELECT DISTINCT ON (c.skey) c.skey, c.title, c.artist, c.akey, c.cover_url, c.preview_url, c.deezer_id, c.spotify_url, c.deezer_url, c.post_id, c.release_date, c.drank
    FROM rk_cand c ORDER BY c.skey, (c.deezer_id IS NULL), (c.cover_url IS NULL)
  ),
  so AS (  -- meilleure personne (social)
    SELECT DISTINCT ON (c.skey) c.skey, c.who, c.who_kind, c.who_compat FROM rk_cand c WHERE c.src = 'social' OR c.src = 'invite'
    ORDER BY c.skey, c.social DESC, c.src_score DESC
  ),
  sr AS (  -- meilleure source catalogue
    SELECT DISTINCT ON (c.skey) c.skey, c.src, c.src_score, c.seed FROM rk_cand c WHERE c.src IN ('rel', 'top', 'chart', 'fresh', 'lfm', 'invite')
    ORDER BY c.skey, c.src_score DESC
  ),
  ag AS (
    SELECT c.skey, sum(c.social) AS social, count(DISTINCT c.who) FILTER (WHERE c.src = 'social') AS n_people, max(c.trend) AS trend
    FROM rk_cand c GROUP BY c.skey
  )
  SELECT m.*, ag.social, ag.n_people, ag.trend, sr.src, coalesce(sr.src_score, 0) AS src_score, sr.seed,
         so.who, so.who_kind, so.who_compat,
         coalesce(cw.w, 0) AS crowd, cw.who AS crowd_who, cw.compat AS crowd_compat,
         0::float8 AS content, NULL::text AS fam, false AS picked, 0::float8 AS score
  FROM m JOIN ag USING (skey) LEFT JOIN sr USING (skey) LEFT JOIN so USING (skey)
  LEFT JOIN rk_crowd cw ON cw.akey = m.akey
  WHERE m.skey NOT IN (SELECT x.skey FROM rk_mine x WHERE x.skey IS NOT NULL)          -- déjà shaké / liké / écarté…
    AND (m.akey IS NULL OR m.akey NOT IN (SELECT x.akey FROM rk_mine x WHERE x.kind = 'dismiss' AND x.akey IS NOT NULL GROUP BY 1 HAVING count(*) >= 2));

  -- Montré 3 fois sans être écouté → oublié 3 semaines ; nouvelle série → pas ce qui a été montré aujourd'hui.
  IF p_before IS NULL THEN
    DELETE FROM rk_scored s WHERE s.skey IN (
      SELECT e.song_key FROM reco_events e WHERE e.user_id = p_user AND e.created_at > now() - interval '21 days'
      GROUP BY e.song_key HAVING count(*) FILTER (WHERE e.event = 'shown') >= 3 AND count(*) FILTER (WHERE e.event IN ('play', 'play_full', 'shake')) = 0)
      OR (p_fresh_series AND s.skey IN (SELECT e.song_key FROM reco_events e WHERE e.user_id = p_user AND e.event = 'shown' AND e.created_at > date_trunc('day', now())));
  END IF;

  -- 4. Goût : proximité du son (artiste, artistes proches, genres, famille) avec mon profil.
  --    Artiste inconnu : on prend le profil de l'artiste de départ (son « proche »).
  UPDATE rk_scored s SET content = x.content, fam = x.fam
  FROM (
    SELECT s2.skey,
      0.5 * (coalesce(ta.v, 0) + 0.35 * coalesce(rel.v, 0)) + 0.3 * coalesce(gg.v, 0) + 0.2 * coalesce(ff.v, 0) AS content,
      coalesce(CASE WHEN s2.src IN ('chart', 'fresh') THEN s2.seed END, fam1.f) AS fam
    FROM rk_scored s2
    LEFT JOIN artist_profiles ap ON ap.artist_key = s2.akey
    LEFT JOIN artist_profiles sp ON sp.artist_key = s2.seed
    CROSS JOIN LATERAL (SELECT
        CASE WHEN cardinality(ap.genres) > 0 THEN ap.genres ELSE coalesce(sp.genres, '{}') END AS genres,
        CASE WHEN cardinality(ap.related) > 0 THEN ap.related ELSE coalesce(sp.related, '{}') END AS related) pr
    LEFT JOIN rk_taste ta ON ta.typ = 'a' AND ta.feat = s2.akey
    LEFT JOIN LATERAL (SELECT sum(t.v) AS v FROM rk_taste t WHERE t.typ = 'a' AND t.feat = ANY (pr.related)) rel ON true
    LEFT JOIN LATERAL (SELECT sum(t.v) / sqrt(greatest(cardinality(pr.genres), 1)) AS v FROM rk_taste t WHERE t.typ = 'g' AND t.feat = ANY (pr.genres)) gg ON true
    LEFT JOIN LATERAL (SELECT sum(t.v) AS v FROM rk_taste t WHERE t.typ = 'f' AND t.feat IN (SELECT genre_family(g) FROM unnest(pr.genres) g)) ff ON true
    LEFT JOIN LATERAL (SELECT y.f FROM (SELECT DISTINCT genre_family(g) AS f FROM unnest(pr.genres) g) y WHERE y.f IS NOT NULL
                       ORDER BY (SELECT rf.share FROM rk_fam rf WHERE rf.fam = y.f) DESC NULLS LAST LIMIT 1) fam1 ON true
  ) x
  WHERE x.skey = s.skey;

  -- 5. Score : composantes ramenées entre 0 et 1, puis pondérées (nouveau compte : plus de tendances).
  IF v_new THEN w_content := 0.35; w_social := 0.15; w_src := 0.2; w_trend := 0.3;
  ELSE w_content := 0.40; w_social := 0.35; w_src := 0.15; w_trend := 0.05; END IF;
  UPDATE rk_scored s SET score =
      w_content * s.content / nullif(mx.c, 0)
    + w_social * (coalesce(s.social, 0) + 0.5 * s.crowd) / nullif(mx.so, 0)
    + w_src * s.src_score / nullif(mx.sr, 0)
    + w_trend * greatest(coalesce(s.trend, 0) / nullif(mx.tr, 0), least(1, ln(1 + coalesce(s.drank, 0)) / ln(1000001.0)))
    + 0.05 * CASE WHEN s.release_date > v_cut::date - 60 THEN 1 ELSE 0 END
  FROM (SELECT greatest(max(content), 1e-9) c, greatest(max(coalesce(social, 0) + 0.5 * crowd), 1e-9) so, greatest(max(src_score), 1e-9) sr, greatest(max(trend), 1e-9) tr FROM rk_scored) mx;
  UPDATE rk_scored s SET score = coalesce(s.score, 0);

  -- 6. Diversité (glouton, page de 20) : 2 titres max par artiste, familles en
  --    proportion de mon profil, 1 place sur 5 pour explorer une famille voisine.
  CREATE TEMP TABLE rk_quota ON COMMIT DROP AS SELECT f.fam, greatest(2, ceil(16 * f.share))::int AS q FROM rk_fam f;
  CREATE TEMP TABLE rk_pick (pos int, skey text, akey text, fam text, page int, explore boolean) ON COMMIT DROP;
  FOR v_pos IN 1..p_limit LOOP
    v_page := (v_pos - 1) / 20;
    v_explore := (v_pos % 5 = 0) AND NOT v_new AND cardinality(v_neigh) > 0;
    v_found := false;
    IF v_explore THEN
      SELECT * INTO c FROM rk_scored s WHERE NOT s.picked AND s.fam = ANY (v_neigh)
        AND (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.akey = s.akey) < 2
      ORDER BY s.score DESC LIMIT 1;
      v_found := FOUND;
      IF NOT v_found THEN v_explore := false; END IF;
    END IF;
    IF NOT v_found THEN
      SELECT * INTO c FROM rk_scored s WHERE NOT s.picked
        AND (s.akey IS NULL OR (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.akey = s.akey) < 2)
        AND (s.fam IS NULL OR (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.fam = s.fam AND NOT k.explore)
                              < coalesce((SELECT q.q FROM rk_quota q WHERE q.fam = s.fam), 2))
      ORDER BY s.score DESC LIMIT 1;
      v_found := FOUND;
    END IF;
    IF NOT v_found THEN  -- plus rien qui respecte tout : on relâche les familles
      SELECT * INTO c FROM rk_scored s WHERE NOT s.picked
        AND (s.akey IS NULL OR (SELECT count(*) FROM rk_pick k WHERE k.page = v_page AND k.akey = s.akey) < 2)
      ORDER BY s.score DESC LIMIT 1;
      v_found := FOUND;
    END IF;
    EXIT WHEN NOT v_found;
    UPDATE rk_scored SET picked = true WHERE rk_scored.skey = c.skey;
    INSERT INTO rk_pick VALUES (v_pos, c.skey, c.akey, c.fam, v_page, v_explore);
  END LOOP;

  -- 7. Raison en une ligne (jamais de privé ni de cercle : le social ne vient que du public).
  RETURN QUERY
  SELECT k.pos, s.skey,
    jsonb_build_object('title', s.title, 'artist', s.artist, 'cover_url', s.cover_url, 'preview_url', s.preview_url,
      'deezer_id', s.deezer_id, 'spotify_url', s.spotify_url, 'deezer_url', s.deezer_url, 'post_id', s.post_id),
    s.score,
    CASE rk.kind
      WHEN 'explore' THEN 'Pour sortir de ta bulle · ' || s.fam
      WHEN 'social' THEN
        CASE s.who_kind WHEN 'like' THEN 'Aimé par ' WHEN 'reshake' THEN 'Reshaké par ' ELSE 'Shaké par ' END || coalesce(wp.display_name, wp.username, 'un ami')
        || CASE WHEN s.who_compat IS NOT NULL THEN ' · ' || s.who_compat || ' % compatibles' ELSE ', que tu suis' END
      WHEN 'invite' THEN 'Partagé par ' || coalesce(wp.display_name, wp.username) || ', qui t''a invité·e'
      WHEN 'crowd' THEN coalesce(cp.display_name, cp.username, 'Un ami') || ' écoute ' || s.artist
        || CASE WHEN s.crowd_compat IS NOT NULL THEN ' · ' || s.crowd_compat || ' % compatibles' ELSE ', que tu suis' END
      WHEN 'rel' THEN
        CASE (SELECT x.kind FROM rk_mine x WHERE x.akey = s.seed AND x.w > 0 ORDER BY x.w DESC LIMIT 1)
          WHEN 'post' THEN 'Parce que tu as shaké ' WHEN 'pin' THEN 'Parce que tu as shaké ' WHEN 'reshake' THEN 'Parce que tu as reshaké '
          WHEN 'like' THEN 'Parce que tu as liké ' WHEN 'story_like' THEN 'Parce que tu as liké ' WHEN 'story' THEN 'Parce que tu as partagé '
          WHEN 'reply' THEN 'Parce que tu as partagé ' WHEN 'listen' THEN 'Parce que tu as écouté '
          ELSE CASE WHEN EXISTS (SELECT 1 FROM artist_picks ap WHERE ap.user_id = p_user AND ap.artist_key = s.seed) THEN 'Parce que tu aimes ' ELSE 'Proche de ' END
        END || coalesce(sp.name, initcap(s.seed))
      WHEN 'top' THEN 'Plus de ' || coalesce(sp.name, s.artist)
      WHEN 'lfm' THEN 'Proche d''un son que tu as shaké'
      WHEN 'fresh' THEN 'Nouveauté ' || coalesce(s.fam, s.seed)
      WHEN 'trend' THEN 'Tendance sur SHAKEmoi'
      ELSE 'Dans ton style ' || coalesce(s.fam, (SELECT f.fam FROM rk_fam f ORDER BY f.share DESC LIMIT 1), 'du moment')
    END,
    rk.kind,
    jsonb_build_object('content', round(s.content::numeric, 3), 'social', round(coalesce(s.social, 0)::numeric, 3),
      'source', s.src, 'source_score', round(s.src_score::numeric, 3), 'seed', s.seed, 'trend', s.trend, 'family', s.fam, 'people', s.n_people, 'crowd', round(s.crowd::numeric, 3))
  FROM rk_pick k JOIN rk_scored s ON s.skey = k.skey
  LEFT JOIN users_profile wp ON wp.id = s.who
  LEFT JOIN users_profile cp ON cp.id = s.crowd_who
  LEFT JOIN artist_profiles sp ON sp.artist_key = s.seed
  CROSS JOIN LATERAL (SELECT CASE
      WHEN k.explore THEN 'explore'
      WHEN s.who IS NOT NULL AND s.who_kind = 'invite' THEN 'invite'
      WHEN coalesce(s.social, 0) >= 0.25 AND s.who IS NOT NULL THEN 'social'
      WHEN s.crowd >= 0.3 AND s.crowd_who IS NOT NULL AND (s.akey IS DISTINCT FROM s.seed OR s.src = 'top') AND NOT EXISTS (SELECT 1 FROM rk_taste t WHERE t.typ = 'a' AND t.feat = s.akey AND t.raw > 0.3) THEN 'crowd'
      WHEN s.src IN ('rel', 'top') AND s.akey = s.seed THEN 'top'
      WHEN s.src IN ('rel', 'top', 'lfm') AND s.src_score >= 0.2 THEN s.src
      WHEN s.src = 'fresh' THEN 'fresh'
      WHEN coalesce(s.trend, 0) > 0 AND s.content < 0.05 THEN 'trend'
      WHEN s.who IS NOT NULL THEN 'social'
      ELSE 'style' END AS kind) rk
  ORDER BY k.pos;
END $$;
REVOKE ALL ON FUNCTION public.reco_rank(uuid, timestamptz, int, boolean) FROM public, anon, authenticated;

-- ---------- La liste précalculée ----------
CREATE TABLE IF NOT EXISTS public.reco_state (
  user_id uuid PRIMARY KEY REFERENCES public.users_profile(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  signals_at int NOT NULL DEFAULT 0
);
ALTER TABLE public.reco_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.compute_recos(p_user uuid, p_fresh_series boolean DEFAULT false) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  DROP TABLE IF EXISTS rc_out;
  CREATE TEMP TABLE rc_out ON COMMIT DROP AS SELECT * FROM reco_rank(p_user, NULL, 50, p_fresh_series);
  DELETE FROM user_recos WHERE user_id = p_user;
  INSERT INTO user_recos (user_id, rank, song_key, track, score, reason, reason_kind, components, generated_at)
  SELECT p_user, o.rank, o.skey, o.track, o.score, o.reason, o.reason_kind, o.components, now() FROM rc_out o;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO reco_state (user_id, generated_at, signals_at)
  VALUES (p_user, now(), (SELECT coalesce(max(n_signals), 0) FROM user_taste_meta WHERE user_id = p_user))
  ON CONFLICT (user_id) DO UPDATE SET generated_at = now(), signals_at = EXCLUDED.signals_at;
  DROP TABLE rc_out;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.compute_recos(uuid, boolean) FROM public, anon, authenticated;

-- Toutes les nuits : goûts puis listes de tout le monde.
CREATE OR REPLACE FUNCTION public.compute_recos_all() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid; n int := 0;
BEGIN
  PERFORM compute_taste_all();
  FOR u IN SELECT id FROM users_profile LOOP
    PERFORM compute_recos(u);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.compute_recos_all() FROM public, anon, authenticated;

-- L'onglet Découvrir : UNE lecture. Recalcul (SQL seulement, sans API
-- extérieure) si la liste a plus de 24 h ou si j'ai donné 5 nouveaux signaux.
-- p_series : 0 = la série du jour ; tirer vers le bas = la suivante.
CREATE OR REPLACE FUNCTION public.get_my_recos(p_series int DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  me uuid := auth.uid();
  st reco_state;
  v_sig int;
  v_total int;
  v_off int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connecte-toi.'; END IF;
  SELECT * INTO st FROM reco_state WHERE user_id = me;
  SELECT count(*) INTO v_sig FROM taste_signals(NULL) s WHERE s.user_id = me AND s.w > 0;
  IF st.user_id IS NULL OR st.generated_at < now() - interval '24 hours' OR v_sig - st.signals_at >= 5 THEN
    PERFORM build_user_taste();
    PERFORM compute_recos(me);
  END IF;
  SELECT count(*) INTO v_total FROM user_recos WHERE user_id = me;
  v_off := greatest(0, p_series) * 20;
  IF v_off >= v_total AND v_total > 0 THEN
    -- On a fait le tour : une nouvelle liste, sans ce qui a été montré aujourd'hui.
    PERFORM compute_recos(me, true);
    v_off := 0;
  END IF;
  RETURN jsonb_build_object(
    'generated_at', (SELECT generated_at FROM reco_state WHERE user_id = me),
    'series', p_series,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('rank', r.rank, 'song_key', r.song_key, 'track', r.track,
                 'reason', r.reason, 'reason_kind', r.reason_kind) ORDER BY r.rank)
               FROM user_recos r WHERE r.user_id = me AND r.rank > v_off AND r.rank <= v_off + 20), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_my_recos(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_recos(int) TO authenticated;

-- ---------- Tâches planifiées ----------
CREATE OR REPLACE FUNCTION public.run_reco_catalog() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reco_artist_seeds(1)) OR catalog_due('charts', 20) THEN
    PERFORM net.http_post(
      url := 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/reco-catalog',
      body := jsonb_build_object('seeds', 20, 'seconds', 100),
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret')),
      timeout_milliseconds := 140000);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.run_reco_catalog() FROM public, anon, authenticated;
SELECT cron.unschedule('shakemoi-reco-catalog') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shakemoi-reco-catalog');
SELECT cron.schedule('shakemoi-reco-catalog', '*/20 * * * *', $$ SELECT public.run_reco_catalog() $$);
-- Nuit (≈ 4 h 30 Paris) : tout le monde.
SELECT cron.unschedule('shakemoi-reco-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shakemoi-reco-nightly');
SELECT cron.schedule('shakemoi-reco-nightly', '30 2 * * *', $$ SELECT public.compute_recos_all() $$);
