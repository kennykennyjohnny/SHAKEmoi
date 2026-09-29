-- =====================================================
-- SHAKEMOI V3 - COMPLETE DATABASE SETUP
-- Toutes les tables pour les fonctionnalités innovantes
-- =====================================================

-- =====================================================
-- 1. TIME CAPSULES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.time_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  unlock_date TIMESTAMPTZ NOT NULL,
  is_group BOOLEAN DEFAULT false,
  mood_at_creation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  CONSTRAINT unlock_date_future CHECK (unlock_date > created_at)
);

CREATE TABLE IF NOT EXISTS public.time_capsule_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES public.time_capsules(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover TEXT NOT NULL,
  preview_url TEXT,
  added_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  personal_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.time_capsule_participants (
  capsule_id UUID REFERENCES public.time_capsules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users_profile(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (capsule_id, user_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_capsules_unlock ON public.time_capsules(unlock_date);
CREATE INDEX IF NOT EXISTS idx_capsules_creator ON public.time_capsules(creator_id);
CREATE INDEX IF NOT EXISTS idx_capsules_opened ON public.time_capsules(opened_at) WHERE opened_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_capsule_tracks_capsule ON public.time_capsule_tracks(capsule_id);

-- RLS Policies
ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_capsule_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_capsule_participants ENABLE ROW LEVEL SECURITY;

-- Time Capsules: voir ses propres capsules et celles où on est participant
CREATE POLICY "time_capsules_select"
ON public.time_capsules FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid() OR
  id IN (SELECT capsule_id FROM public.time_capsule_participants WHERE user_id = auth.uid())
);

CREATE POLICY "time_capsules_insert"
ON public.time_capsules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "time_capsules_update"
ON public.time_capsules FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

-- Time Capsule Tracks
CREATE POLICY "time_capsule_tracks_select"
ON public.time_capsule_tracks FOR SELECT
TO authenticated
USING (
  capsule_id IN (
    SELECT id FROM public.time_capsules
    WHERE creator_id = auth.uid() OR
    id IN (SELECT capsule_id FROM public.time_capsule_participants WHERE user_id = auth.uid())
  )
);

CREATE POLICY "time_capsule_tracks_insert"
ON public.time_capsule_tracks FOR INSERT
TO authenticated
WITH CHECK (
  capsule_id IN (
    SELECT id FROM public.time_capsules
    WHERE creator_id = auth.uid() OR
    id IN (SELECT capsule_id FROM public.time_capsule_participants WHERE user_id = auth.uid())
  )
);

-- Time Capsule Participants
CREATE POLICY "time_capsule_participants_select"
ON public.time_capsule_participants FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  capsule_id IN (SELECT id FROM public.time_capsules WHERE creator_id = auth.uid())
);

CREATE POLICY "time_capsule_participants_insert"
ON public.time_capsule_participants FOR INSERT
TO authenticated
WITH CHECK (
  capsule_id IN (SELECT id FROM public.time_capsules WHERE creator_id = auth.uid())
);

-- =====================================================
-- 2. SHAKE MOMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shake_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover TEXT NOT NULL,
  preview_url TEXT,
  spotify_url TEXT,
  is_authentic BOOLEAN DEFAULT true,
  mood_emoji TEXT,
  notification_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_shakemoment_per_day UNIQUE(user_id, DATE(created_at))
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shake_moments_user ON public.shake_moments(user_id);
CREATE INDEX IF NOT EXISTS idx_shake_moments_date ON public.shake_moments(DATE(created_at) DESC);
CREATE INDEX IF NOT EXISTS idx_shake_moments_created ON public.shake_moments(created_at DESC);

-- RLS
ALTER TABLE public.shake_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shake_moments_select"
ON public.shake_moments FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
);

CREATE POLICY "shake_moments_insert"
ON public.shake_moments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. MUSIC TASTE & COMPATIBILITY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_music_taste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  genre TEXT,
  play_count INTEGER DEFAULT 1,
  last_played TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, artist_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_music_taste_user ON public.user_music_taste(user_id);
CREATE INDEX IF NOT EXISTS idx_music_taste_artist ON public.user_music_taste(artist_id);
CREATE INDEX IF NOT EXISTS idx_music_taste_play_count ON public.user_music_taste(play_count DESC);

-- RLS
ALTER TABLE public.user_music_taste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_music_taste_select"
ON public.user_music_taste FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "user_music_taste_insert_update"
ON public.user_music_taste FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_music_taste_update"
ON public.user_music_taste FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Table pour cacher les scores de compatibilité calculés
CREATE TABLE IF NOT EXISTS public.user_compatibility_cache (
  user_a UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  compatibility_score INTEGER NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  common_artists_count INTEGER DEFAULT 0,
  common_genres_count INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b),
  CONSTRAINT different_users CHECK (user_a != user_b),
  CONSTRAINT ordered_users CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_compatibility_score ON public.user_compatibility_cache(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_compatibility_users ON public.user_compatibility_cache(user_a, user_b);

ALTER TABLE public.user_compatibility_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_compatibility_cache_select"
ON public.user_compatibility_cache FOR SELECT
TO authenticated
USING (
  user_a = auth.uid() OR user_b = auth.uid()
);

-- =====================================================
-- 4. TIMED COMMENTS (amélioration de la table comments)
-- =====================================================

-- Ajouter les colonnes pour les timed comments si elles n'existent pas
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS timestamp_seconds INTEGER CHECK (timestamp_seconds >= 0 AND timestamp_seconds <= 30),
ADD COLUMN IF NOT EXISTS is_timed BOOLEAN DEFAULT false;

-- Index pour les timed comments
CREATE INDEX IF NOT EXISTS idx_comments_timed ON public.comments(post_id, timestamp_seconds) WHERE is_timed = true;

-- =====================================================
-- 5. FONCTIONS UTILES
-- =====================================================

-- Fonction: Mettre à jour automatiquement les goûts musicaux
CREATE OR REPLACE FUNCTION public.update_music_taste()
RETURNS TRIGGER AS $$
BEGIN
  -- Extraire l'artist_id du post (à améliorer avec les vraies données Spotify)
  INSERT INTO public.user_music_taste (user_id, artist_id, artist_name, play_count)
  VALUES (
    NEW.user_id,
    COALESCE(NEW.track_id, NEW.artist),
    NEW.artist,
    1
  )
  ON CONFLICT (user_id, artist_id)
  DO UPDATE SET
    play_count = user_music_taste.play_count + 1,
    last_played = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour les goûts automatiquement
DROP TRIGGER IF EXISTS trigger_update_music_taste ON public.posts;
CREATE TRIGGER trigger_update_music_taste
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_music_taste();

-- Fonction: Calculer le score de compatibilité entre deux users
CREATE OR REPLACE FUNCTION public.calculate_compatibility(
  user_a_id UUID,
  user_b_id UUID
)
RETURNS TABLE(
  score INTEGER,
  common_artists_count INTEGER,
  common_genres_count INTEGER
) AS $$
DECLARE
  v_user_a UUID;
  v_user_b UUID;
  v_common_artists INTEGER;
  v_common_genres INTEGER;
  v_score INTEGER;
BEGIN
  -- S'assurer que user_a < user_b pour la cohérence
  IF user_a_id < user_b_id THEN
    v_user_a := user_a_id;
    v_user_b := user_b_id;
  ELSE
    v_user_a := user_b_id;
    v_user_b := user_a_id;
  END IF;

  -- Compter les artistes en commun
  SELECT COUNT(DISTINCT a.artist_id)
  INTO v_common_artists
  FROM public.user_music_taste a
  INNER JOIN public.user_music_taste b ON a.artist_id = b.artist_id
  WHERE a.user_id = v_user_a AND b.user_id = v_user_b;

  -- Compter les genres en commun
  SELECT COUNT(DISTINCT a.genre)
  INTO v_common_genres
  FROM public.user_music_taste a
  INNER JOIN public.user_music_taste b ON a.genre = b.genre
  WHERE a.user_id = v_user_a
    AND b.user_id = v_user_b
    AND a.genre IS NOT NULL
    AND b.genre IS NOT NULL;

  -- Calculer le score (max 100)
  v_score := LEAST(100, (v_common_artists * 5) + (v_common_genres * 2));

  -- Sauvegarder dans le cache
  INSERT INTO public.user_compatibility_cache (user_a, user_b, compatibility_score, common_artists_count, common_genres_count)
  VALUES (v_user_a, v_user_b, v_score, v_common_artists, v_common_genres)
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    compatibility_score = v_score,
    common_artists_count = v_common_artists,
    common_genres_count = v_common_genres,
    calculated_at = NOW();

  RETURN QUERY SELECT v_score, v_common_artists, v_common_genres;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Obtenir les capsules déverrouillables
CREATE OR REPLACE FUNCTION public.get_unlockable_capsules()
RETURNS TABLE(
  capsule_id UUID,
  creator_id UUID,
  title TEXT,
  tracks_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.creator_id,
    tc.title,
    COUNT(tct.id) as tracks_count
  FROM public.time_capsules tc
  LEFT JOIN public.time_capsule_tracks tct ON tc.id = tct.capsule_id
  WHERE tc.unlock_date <= NOW()
    AND tc.opened_at IS NULL
    AND (
      tc.creator_id = auth.uid() OR
      tc.id IN (SELECT capsule_id FROM public.time_capsule_participants WHERE user_id = auth.uid())
    )
  GROUP BY tc.id, tc.creator_id, tc.title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.time_capsules TO authenticated;
GRANT ALL ON public.time_capsule_tracks TO authenticated;
GRANT ALL ON public.time_capsule_participants TO authenticated;
GRANT ALL ON public.shake_moments TO authenticated;
GRANT ALL ON public.user_music_taste TO authenticated;
GRANT ALL ON public.user_compatibility_cache TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ SHAKEMOI V3 - Base de données complète créée avec succès!';
  RAISE NOTICE '🎁 Time Capsules: Activées';
  RAISE NOTICE '📸 ShakeMoments: Activés';
  RAISE NOTICE '💯 Compatibilité musicale: Activée';
  RAISE NOTICE '⏱️ Timed comments: Activés';
  RAISE NOTICE '🎵 Prêt à secouer le monde musical!';
END $$;
