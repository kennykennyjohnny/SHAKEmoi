-- Q8 (1/3) : UN seul profil de goût pour Découvrir, la compatibilité (P25) et
-- les suggestions d'amis (P18). Voir docs/reco.md.

-- ---------- Tables ----------
-- Écoutes dans l'appli (lecteur M2) : début, durée écoutée, fin.
CREATE TABLE IF NOT EXISTS public.listen_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users_profile(id) ON DELETE CASCADE,
  song_key text NOT NULL,
  track_name text, artist text,
  source text,                         -- fil, découvrir, cercle, profil…
  listened_ms int NOT NULL CHECK (listened_ms >= 0 AND listened_ms <= 600000),
  ended text CHECK (ended IN ('end', 'skip', 'pause', 'switch', 'close')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listen_user ON public.listen_events (user_id, created_at DESC);
ALTER TABLE public.listen_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listen_insert ON public.listen_events;
CREATE POLICY listen_insert ON public.listen_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS listen_read ON public.listen_events;
CREATE POLICY listen_read ON public.listen_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Ce qui se passe dans Découvrir : affiché, écouté, écouté en entier, Shaké, Pas pour moi.
CREATE TABLE IF NOT EXISTS public.reco_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users_profile(id) ON DELETE CASCADE,
  song_key text NOT NULL,
  track_name text, artist text,
  event text NOT NULL CHECK (event IN ('shown', 'play', 'play_full', 'shake', 'dismiss')),
  rank int, reason_kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reco_events_user ON public.reco_events (user_id, event, created_at DESC);
ALTER TABLE public.reco_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reco_events_insert ON public.reco_events;
CREATE POLICY reco_events_insert ON public.reco_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS reco_events_read ON public.reco_events;
CREATE POLICY reco_events_read ON public.reco_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Q9 : « Choisis au moins 3 artistes que tu aimes ».
CREATE TABLE IF NOT EXISTS public.artist_picks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users_profile(id) ON DELETE CASCADE,
  artist_key text NOT NULL,
  name text NOT NULL,
  deezer_id text,
  picture_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_key)
);
ALTER TABLE public.artist_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS artist_picks_own ON public.artist_picks;
CREATE POLICY artist_picks_own ON public.artist_picks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Le profil de goût (vecteurs normalisés : a = artistes, g = genres fins, f = familles, t = titres).
CREATE TABLE IF NOT EXISTS public.user_taste (
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  typ char(1) NOT NULL CHECK (typ IN ('a', 'g', 'f', 't')),
  feat text NOT NULL,
  v double precision NOT NULL,
  raw double precision NOT NULL,
  PRIMARY KEY (user_id, typ, feat)
);
ALTER TABLE public.user_taste ENABLE ROW LEVEL SECURITY; -- lu seulement par les fonctions

CREATE TABLE IF NOT EXISTS public.user_taste_meta (
  user_id uuid PRIMARY KEY REFERENCES public.users_profile(id) ON DELETE CASCADE,
  n_signals int NOT NULL DEFAULT 0,
  n_songs int NOT NULL DEFAULT 0,
  built_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_taste_meta ENABLE ROW LEVEL SECURITY;

-- Catalogue de titres candidats (rempli par la fonction serveur reco-catalog).
CREATE TABLE IF NOT EXISTS public.catalog_tracks (
  song_key text PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  artist_key text,
  deezer_id bigint,
  spotify_id text,
  isrc text,
  cover_url text,
  preview_url text,
  deezer_rank int,
  release_date date,
  -- d'où il vient : {"rel:tiakola": 0.9, "top:tiakola": 1, "chart:Rap": 0.8, "lfm:…": 0.7}
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_artist ON public.catalog_tracks (artist_key);
ALTER TABLE public.catalog_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_read ON public.catalog_tracks;
CREATE POLICY catalog_read ON public.catalog_tracks FOR SELECT TO authenticated USING (true);

-- Artistes : proches AVEC leur rang et leur id Deezer, photo (Q9), date du catalogue.
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS related_ranked jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS picture_url text;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS catalog_at timestamptz;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS fans int;

-- La liste précalculée (top 50) de chacun.
CREATE TABLE IF NOT EXISTS public.user_recos (
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  rank int NOT NULL,
  song_key text NOT NULL,
  track jsonb NOT NULL,
  score double precision NOT NULL,
  reason text NOT NULL,
  reason_kind text NOT NULL,
  components jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rank)
);
ALTER TABLE public.user_recos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_recos_read ON public.user_recos;
CREATE POLICY user_recos_read ON public.user_recos FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------- Les signaux (poids de docs/reco.md) ----------
-- p_before : ne garder que ce qui s'est passé avant (évaluation hors ligne).
CREATE OR REPLACE FUNCTION public.taste_signals(p_before timestamptz DEFAULT NULL)
RETURNS TABLE (user_id uuid, skey text, track_name text, artist text, akey text, w double precision, kind text, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH cut AS (SELECT coalesce(p_before, now()) AS t),
  raw AS (
    SELECT p.user_id, p.track_name, p.artist, p.created_at AS at,
           CASE WHEN p.pinned_at IS NOT NULL AND p_before IS NULL THEN 1.5 ELSE 1.0 END AS w,
           CASE WHEN p.pinned_at IS NOT NULL AND p_before IS NULL THEN 'pin' ELSE 'post' END AS kind
      FROM posts p WHERE p.is_reshake IS NOT TRUE AND p.circle_id IS NULL
    UNION ALL
    SELECT r.user_id, coalesce(o.track_name, r.track_name), coalesce(o.artist, r.artist), r.created_at, 0.8, 'reshake'
      FROM posts r LEFT JOIN posts o ON o.id = r.original_post_id WHERE r.is_reshake AND r.circle_id IS NULL
    UNION ALL
    SELECT m.user_id, m.track_name, m.artist, m.created_at, 0.7, 'reply' FROM music_reactions m
    UNION ALL
    SELECT s.user_id, s.track_name, s.artist, s.created_at, 0.6, 'story' FROM stories s
    UNION ALL
    SELECT l.user_id, p.track_name, p.artist, l.created_at, 0.5, 'like'
      FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.circle_id IS NULL AND p.user_id <> l.user_id
    UNION ALL
    SELECT sl.user_id, s.track_name, s.artist, sl.created_at, 0.4, 'story_like'
      FROM story_likes sl JOIN stories s ON s.id = sl.story_id WHERE s.user_id <> sl.user_id
    UNION ALL
    SELECT x.user_id, x.track_name, x.artist, x.created_at, 0.3, 'listen' FROM (
      SELECT DISTINCT ON (le.user_id, le.song_key, le.created_at::date) le.user_id, le.track_name, le.artist, le.created_at
      FROM listen_events le WHERE le.listened_ms >= 15000) x
    UNION ALL
    SELECT le.user_id, le.track_name, le.artist, le.created_at, -0.2, 'skip'
      FROM listen_events le WHERE le.listened_ms < 5000 AND le.ended = 'skip'
    UNION ALL
    SELECT re.user_id, re.track_name, re.artist, re.created_at, -1.0, 'dismiss'
      FROM reco_events re WHERE re.event = 'dismiss'
  )
  SELECT r.user_id, song_key(r.track_name, r.artist), r.track_name, r.artist, artist_key(r.artist),
         r.w * CASE WHEN r.kind = 'pin' THEN 1 ELSE power(0.5, greatest(0, extract(epoch FROM (cut.t - r.at))) / 86400.0 / 60) END,
         r.kind, r.at
  FROM raw r, cut
  WHERE r.track_name IS NOT NULL AND r.user_id IS NOT NULL AND (p_before IS NULL OR r.at < p_before);
$$;
REVOKE ALL ON FUNCTION public.taste_signals(timestamptz) FROM public, anon, authenticated;

-- ---------- Les vecteurs de goût (pour tout le monde : le TF-IDF compare à tous) ----------
CREATE OR REPLACE FUNCTION public.taste_vectors(p_before timestamptz DEFAULT NULL)
RETURNS TABLE (user_id uuid, typ char(1), feat text, v double precision, raw double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH s AS (SELECT * FROM taste_signals(p_before)),
  nsig AS (SELECT s.user_id, count(*) AS n FROM s WHERE s.w > 0 GROUP BY 1),
  -- Q9 : artistes choisis au tuto, poids 1 qui s'efface avec les vrais usages.
  picks AS (
    SELECT ap.user_id, ap.artist_key AS akey, 5.0 / (5 + coalesce(n.n, 0)) AS w
    FROM artist_picks ap LEFT JOIN nsig n ON n.user_id = ap.user_id
    WHERE p_before IS NULL OR ap.created_at < p_before
  ),
  arts AS (
    SELECT s.user_id, s.akey, CASE WHEN s.kind = 'dismiss' THEN -0.3 ELSE s.w END AS w FROM s WHERE s.akey IS NOT NULL
    UNION ALL SELECT * FROM picks
  ),
  raw AS (
    SELECT a.user_id, 'a'::char(1) AS typ, a.akey AS feat, a.w FROM arts a
    UNION ALL
    SELECT a.user_id, 'a', r.rel, a.w * 0.35 FROM arts a JOIN artist_profiles p ON p.artist_key = a.akey CROSS JOIN LATERAL unnest(p.related) AS r(rel) WHERE a.w > 0
    UNION ALL
    SELECT a.user_id, 'g', g.genre, a.w FROM arts a JOIN artist_profiles p ON p.artist_key = a.akey CROSS JOIN LATERAL unnest(p.genres) AS g(genre)
    UNION ALL
    SELECT a.user_id, 'f', f.fam, a.w FROM arts a JOIN artist_profiles p ON p.artist_key = a.akey
      CROSS JOIN LATERAL (SELECT DISTINCT genre_family(x) AS fam FROM unnest(p.genres) x WHERE genre_family(x) IS NOT NULL) f
    UNION ALL
    SELECT s.user_id, 't', s.skey, s.w FROM s
  ),
  agg AS (SELECT r.user_id, r.typ, r.feat, sum(r.w) AS w FROM raw r GROUP BY 1, 2, 3 HAVING sum(r.w) > 0),
  nu AS (SELECT count(DISTINCT agg.user_id) AS n FROM agg),
  df AS (SELECT agg.typ, agg.feat, count(DISTINCT agg.user_id) AS df FROM agg GROUP BY 1, 2),
  tf AS (
    SELECT a.user_id, a.typ, a.feat, a.w AS raw, a.w * (ln((1.0 + nu.n) / (1.0 + df.df)) + 1) AS v
    FROM agg a JOIN df ON df.typ = a.typ AND df.feat = a.feat CROSS JOIN nu
  ),
  nrm AS (SELECT tf.user_id, tf.typ, sqrt(sum(tf.v * tf.v)) AS n FROM tf GROUP BY 1, 2)
  SELECT tf.user_id, tf.typ, tf.feat, tf.v / nullif(nrm.n, 0), tf.raw
  FROM tf JOIN nrm ON nrm.user_id = tf.user_id AND nrm.typ = tf.typ;
$$;
REVOKE ALL ON FUNCTION public.taste_vectors(timestamptz) FROM public, anon, authenticated;

-- Matérialise le profil de goût de tout le monde.
CREATE OR REPLACE FUNCTION public.build_user_taste()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  CREATE TEMP TABLE t_tv ON COMMIT DROP AS SELECT * FROM taste_vectors(NULL);
  DELETE FROM user_taste;
  INSERT INTO user_taste (user_id, typ, feat, v, raw) SELECT user_id, typ, feat, v, raw FROM t_tv WHERE v IS NOT NULL;
  INSERT INTO user_taste_meta (user_id, n_signals, n_songs, built_at)
  SELECT s.user_id, count(*) FILTER (WHERE s.w > 0), count(DISTINCT s.skey) FILTER (WHERE s.w > 0), now()
  FROM taste_signals(NULL) s GROUP BY s.user_id
  ON CONFLICT (user_id) DO UPDATE SET n_signals = EXCLUDED.n_signals, n_songs = EXCLUDED.n_songs, built_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  DROP TABLE t_tv;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.build_user_taste() FROM public, anon, authenticated;
