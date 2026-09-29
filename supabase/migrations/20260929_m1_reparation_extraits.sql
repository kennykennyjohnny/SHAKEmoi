-- M1 : réparation des extraits (généré par scripts/check-previews.mjs)
BEGIN;
CREATE TEMP TABLE f (id text, t text, a text, url text, src text) ON COMMIT DROP;
INSERT INTO f VALUES
  ('02lQpb5bZvaAJLw5VdZoC0', NULL, 'Glorious', 'https://www.shakemoi.fr/api/preview?deezer=2976434131', 'deezer'),
  ('0cqRj7pUJDkTCEsJkx8snD', NULL, 'Taylor Swift', 'https://www.shakemoi.fr/api/preview?deezer=550269982', 'deezer'),
  ('0LdIVAcALGjlmKnwN36WMg', 'Fall Back', 'Lithe', 'https://www.shakemoi.fr/api/preview?deezer=3495884741', 'deezer'),
  ('0oNhCr87Maw9he7xu9yrcR', 'Mauvaise nouvelle', 'BEN plg', 'https://www.shakemoi.fr/api/preview?deezer=3773671992', 'deezer'),
  ('0uMMLry3hzWGn3q3loqMkm', NULL, 'Los Lobos', 'https://www.shakemoi.fr/api/preview?deezer=3819736', 'deezer'),
  ('0VjIjW4GlUZAMYd2vXMi3b', 'Blinding Lights', 'The Weeknd', 'https://www.shakemoi.fr/api/preview?deezer=908604612', 'deezer'),
  ('0xpx6Vk2EO7DZ8h9paHR1z', 'Mentir au psy', 'BEN plg', 'https://www.shakemoi.fr/api/preview?deezer=4179780392', 'deezer'),
  ('167wDaMPEunxMWamiMiLS2', 'Sans couleur', '808NOCHE', 'https://www.shakemoi.fr/api/preview?deezer=3861863581', 'deezer'),
  ('18emlNOPRTT9V2oNlz9Xn4', 'Ailleurs', 'Krakow', NULL, 'none'),
  ('1agLiWjSBYSTsKZLudOunC', NULL, 'Skales', 'https://www.shakemoi.fr/api/preview?deezer=2200632547', 'deezer'),
  ('1B3C07wByneayjyexYHkTi', 'Pascal OP', 'Sheu', 'https://www.shakemoi.fr/api/preview?deezer=3485400721', 'deezer'),
  ('1cOU0KX7YbaT5a0L6m8D96', 'MONACO', 'HOUDI', 'https://www.shakemoi.fr/api/preview?deezer=2554678632', 'deezer'),
  ('1fxXLLaGdjkRhOpNjjWK9U', 'Génération Couvre Feu', 'Boogie', 'https://www.shakemoi.fr/api/preview?deezer=3817934981', 'deezer'),
  ('1jSRu1IRoB6DPKsWTVGzTB', 'Pineapple', 'Leto', 'https://www.shakemoi.fr/api/preview?deezer=3940103361', 'deezer'),
  ('1QbOvACeYanja5pbnJbAmk', 'Take Me Home, Country Roads', 'John Denver', 'https://www.shakemoi.fr/api/preview?deezer=769749482', 'deezer'),
  ('1T5Q8MLqpSoiuQDvZ2ygkg', 'Allumer le feu', 'Johnny Hallyday', 'https://www.shakemoi.fr/api/preview?deezer=921379', 'deezer'),
  ('1T8rMFY5DayEfuwnkIPYm8', 'Histoire sans fin', 'BEN plg', 'https://www.shakemoi.fr/api/preview?deezer=4179780432', 'deezer'),
  ('26x4p1r5ZdS1X9gCi5gcF0', NULL, 'Romsii', 'https://www.shakemoi.fr/api/preview?deezer=4116598861', 'deezer'),
  ('2H6uszniwJ1kaVnHH6N05a', 'B.B.B. (Snapchat)', 'Armanii', 'https://www.shakemoi.fr/api/preview?deezer=3607428292', 'deezer'),
  ('2hwxHtaQRwgDigEkHbR3Zg', 'Vivre pour le meilleur', 'Johnny Hallyday', 'https://www.shakemoi.fr/api/preview?deezer=922465', 'deezer'),
  ('2uFlBIfS4XKyOVPKiIrj5L', 'Me Maten - Live at NPR''s Tiny Desk', 'C. Tangana', 'https://www.shakemoi.fr/api/preview?deezer=1341633272', 'deezer'),
  ('2yWlGEgEfPot0lv3OAjuG3', 'Just Keep Watching (From F1® The Movie)', 'Tate McRae', 'https://www.shakemoi.fr/api/preview?deezer=3387508461', 'deezer'),
  ('3cqLrAhTy0JYcYmGe6Dvje', 'Je te promets', 'Johnny Hallyday', 'https://www.shakemoi.fr/api/preview?deezer=2178580', 'deezer'),
  ('3mIFUU4vUWHwWgYDD0xr1p', 'Macarena', 'Los Del Mar', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ba/c8/a5/bac8a5b3-2c1b-4288-3948-4648536b2474/mzaf_10854194532404579321.plus.aac.p.m4a', 'itunes'),
  (NULL, '4 Kampé', 'Joé Dwèt Filé', 'https://www.shakemoi.fr/api/preview?deezer=3045428971', 'deezer'),
  ('41L3O37CECZt3N7ziG2z7l', 'Yummy', 'Justin Bieber', 'https://www.shakemoi.fr/api/preview?deezer=845095592', 'deezer'),
  ('46j0Lkjf4fOs8eh0UE2DCr', 'Mille et une raisons', 'Arpin Lépine', 'https://www.shakemoi.fr/api/preview?deezer=3577283311', 'deezer'),
  ('4oJxjHkaEq07v25iTcDIxT', 'RENÉ CAOVILLA', 'Gambi', 'https://www.shakemoi.fr/api/preview?deezer=3921078891', 'deezer'),
  ('4ylWMuGbMXNDgDd8lErEle', 'The Greatest Show', 'Hugh Jackman', 'https://www.shakemoi.fr/api/preview?deezer=420269102', 'deezer'),
  ('5ipwKipeDAluChn5C5RGsZ', 'EKKO', 'HOUDI', 'https://www.shakemoi.fr/api/preview?deezer=3769651932', 'deezer'),
  ('5lr3MUJlQSskK6PRqCRlop', 'A la pêche aux moules', 'La Reine des chansons pour enfants et bébés', 'https://www.shakemoi.fr/api/preview?deezer=135077510', 'deezer'),
  ('5WEF0icHWmAZBBMglBd599', 'WELTiTA', 'Bad Bunny', 'https://www.shakemoi.fr/api/preview?deezer=3171003021', 'deezer'),
  ('6fHsRYBBQiMEMcqJoElTFP', NULL, 'Romsii', 'https://www.shakemoi.fr/api/preview?deezer=4116598851', 'deezer'),
  ('6PrKZUXJPmBiobMN44yR8Y', NULL, 'Ennio Morricone', 'https://www.shakemoi.fr/api/preview?deezer=3089031', 'deezer'),
  ('6VNXmo59yDYgcwLS17UNAW', 'CAFé CON RON', 'Bad Bunny', 'https://www.shakemoi.fr/api/preview?deezer=3171003091', 'deezer'),
  ('6xGqzMcQIM4hTBR3Buf8r9', 'Convaincu', 'Valentin Mouville', 'https://www.shakemoi.fr/api/preview?deezer=3724374192', 'deezer'),
  ('7kLSUaQSKH9rt9tJKKRwZV', 'Symphony No. 40 in G Minor, K. 550: I. Allegro molto', 'Wolfgang Amadeus Mozart', 'https://www.shakemoi.fr/api/preview?deezer=71797434', 'deezer'),
  ('7pkMiyznBjnJyIlklKvvYX', 'Rouge et noir', 'Kemmler', 'https://www.shakemoi.fr/api/preview?deezer=3965838831', 'deezer'),
  (NULL, 'Abysses', 'Vald', 'https://www.shakemoi.fr/api/preview?deezer=3681648072', 'deezer'),
  (NULL, 'AILLEURS', 'HOUDI', 'https://www.shakemoi.fr/api/preview?deezer=3517132011', 'deezer'),
  (NULL, 'Ailleurs', 'Orelsan', 'https://www.shakemoi.fr/api/preview?deezer=3637839292', 'deezer'),
  (NULL, 'Astronaute', 'An''Om', 'https://www.shakemoi.fr/api/preview?deezer=3481004631', 'deezer'),
  (NULL, 'Attack', 'Thirty Seconds To Mars', 'https://www.shakemoi.fr/api/preview?deezer=3090873', 'deezer'),
  (NULL, 'Bienvenue', 'Glorious', 'https://www.shakemoi.fr/api/preview?deezer=140731161', 'deezer'),
  (NULL, 'BIG BOSS LADY', 'Theodora', 'https://www.shakemoi.fr/api/preview?deezer=3060824511', 'deezer'),
  (NULL, 'BPM', 'Favé', 'https://www.shakemoi.fr/api/preview?deezer=3527632601', 'deezer'),
  (NULL, 'Ça parle mal', 'Bouss', 'https://www.shakemoi.fr/api/preview?deezer=2843641482', 'deezer'),
  (NULL, 'Cadaqués en Novembre_freestyle 2025', 'Bigflo & Oli', 'https://www.shakemoi.fr/api/preview?deezer=3712460612', 'deezer'),
  (NULL, 'CARTIER SANTOS', 'SDM', 'https://www.shakemoi.fr/api/preview?deezer=3015707071', 'deezer'),
  (NULL, 'Convaincu', 'Valentin Mouville', 'https://www.shakemoi.fr/api/preview?deezer=3724374192', 'deezer'),
  (NULL, 'Electronic Heart', 'NIVEK FFORHS', 'https://www.shakemoi.fr/api/preview?deezer=3441626201', 'deezer'),
  (NULL, 'Elle a fait un bébé toute seule', 'Jean-Jacques Goldman', 'https://www.shakemoi.fr/api/preview?deezer=582170', 'deezer'),
  (NULL, 'FASHION DESIGNA', 'Theodora', 'https://www.shakemoi.fr/api/preview?deezer=3060824431', 'deezer'),
  (NULL, 'Fumée nocive', 'Krakow', 'https://www.shakemoi.fr/api/preview?deezer=2473884081', 'deezer'),
  (NULL, 'Gelem Gelem', 'Trinix', 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/72/2a/42/722a4248-dfc3-23bb-1652-107b38475d91/mzaf_3939353835646089140.plus.aac.p.m4a', 'itunes'),
  (NULL, 'Get Up', 'Lithe', 'https://www.shakemoi.fr/api/preview?deezer=3554147331', 'deezer'),
  (NULL, 'Here Comes The Sun - Remastered 2009', 'The Beatles', 'https://www.shakemoi.fr/api/preview?deezer=116348126', 'deezer'),
  (NULL, 'In The Dark (with Stray Kids)', 'DJ Snake', 'https://www.shakemoi.fr/api/preview?deezer=3630391182', 'deezer'),
  (NULL, 'Jack Sparrow', 'Hans Zimmer', 'https://www.shakemoi.fr/api/preview?deezer=1762557427', 'deezer'),
  (NULL, 'Just Keep Watching', 'Tate McRae', 'https://www.shakemoi.fr/api/preview?deezer=3387508461', 'deezer'),
  (NULL, 'La main verte - Live', 'Tryo', 'https://www.shakemoi.fr/api/preview?deezer=142797454', 'deezer'),
  (NULL, 'Last Name', 'Aswell', 'https://www.shakemoi.fr/api/preview?deezer=3608927312', 'deezer'),
  (NULL, 'Le trou du cul de ma bite', 'Jean Pierre Fromage', 'https://www.shakemoi.fr/api/preview?deezer=1599992972', 'deezer'),
  (NULL, 'LES OISEAUX RARES', 'Theodora', 'https://www.shakemoi.fr/api/preview?deezer=3380338521', 'deezer'),
  (NULL, 'Les sardines', 'Patrick Sébastien', 'https://www.shakemoi.fr/api/preview?deezer=1571416', 'deezer'),
  (NULL, 'Marilyn', 'Mady Riama', 'https://www.shakemoi.fr/api/preview?deezer=3716701582', 'deezer'),
  (NULL, 'melodrama', 'disiz', 'https://www.shakemoi.fr/api/preview?deezer=3558373981', 'deezer'),
  (NULL, 'Melodyne (feat. Gisèle)', 'Stony Stone', 'https://www.shakemoi.fr/api/preview?deezer=3663660652', 'deezer'),
  (NULL, 'Minimum ça', 'Dr. Yaro', 'https://www.shakemoi.fr/api/preview?deezer=3039610501', 'deezer'),
  (NULL, 'No Woman, No Cry - Live At The Lyceum, London/1975', 'Bob Marley & The Wailers', 'https://www.shakemoi.fr/api/preview?deezer=2433303', 'deezer'),
  (NULL, 'Ordinary', 'Alex Warren', 'https://www.shakemoi.fr/api/preview?deezer=3210709941', 'deezer'),
  (NULL, 'Pa Pa Paw', 'Damso', 'https://www.shakemoi.fr/api/preview?deezer=3381260831', 'deezer'),
  (NULL, 'paradis', 'Django', 'https://www.shakemoi.fr/api/preview?deezer=3018326821', 'deezer'),
  (NULL, 'Passe par chez moi', 'Bianca Costa', 'https://www.shakemoi.fr/api/preview?deezer=3640116642', 'deezer'),
  (NULL, 'Popular (with Playboi Carti & Madonna) - From The Idol Vol. 1 (Music from the HBO Original Series)', 'The Weeknd', 'https://www.shakemoi.fr/api/preview?deezer=2321977215', 'deezer'),
  (NULL, 'Raphael', 'Carla Bruni', 'https://www.shakemoi.fr/api/preview?deezer=78749542', 'deezer'),
  (NULL, 'RESTE-LÀ', 'Tiakola', NULL, 'none'),
  (NULL, 'Riama', 'Mady Riama', 'https://www.shakemoi.fr/api/preview?deezer=3386321991', 'deezer'),
  (NULL, 'The Fate of Ophelia', 'Taylor Swift', 'https://www.shakemoi.fr/api/preview?deezer=3579685431', 'deezer'),
  (NULL, 'V''la l''émotion', 'KRYPTOO', 'https://www.shakemoi.fr/api/preview?deezer=3656886442', 'deezer'),
  (NULL, 'Vetted', 'Lithe', 'https://www.shakemoi.fr/api/preview?deezer=3284569071', 'deezer'),
  (NULL, 'VIBES', 'Favé', 'https://www.shakemoi.fr/api/preview?deezer=2332941935', 'deezer'),
  (NULL, 'WILDFLOWER', 'Billie Eilish', 'https://www.shakemoi.fr/api/preview?deezer=2801558062', 'deezer');
UPDATE public.posts x SET preview_url = f.url, preview_source = f.src FROM f
WHERE (x.preview_url IS NULL OR x.preview_url LIKE '%dzcdn.net%')
  AND ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));
UPDATE public.stories x SET preview_url = f.url, preview_source = f.src FROM f
WHERE (x.preview_url IS NULL OR x.preview_url LIKE '%dzcdn.net%')
  AND ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));
UPDATE public.messages x SET preview_url = f.url, preview_source = f.src FROM f
WHERE (x.preview_url IS NULL OR x.preview_url LIKE '%dzcdn.net%')
  AND ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));
UPDATE public.circle_messages x SET preview_url = f.url, preview_source = f.src FROM f
WHERE (x.preview_url IS NULL OR x.preview_url LIKE '%dzcdn.net%')
  AND ((f.id IS NOT NULL AND x.track_id = f.id)
    OR (f.id IS NULL AND x.track_id IS NULL AND lower(x.track_name) = lower(f.t) AND lower(coalesce(x.artist,'')) = lower(f.a)));
COMMIT;
