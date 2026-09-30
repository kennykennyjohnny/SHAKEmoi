-- NUIT — Index sur les clés étrangères qui n'en avaient pas (conseil Supabase).
-- Ajouts seulement, idempotent.
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1
      AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', 'idx_' || r.conname, r.tbl, r.col);
  END LOOP;
END $$;
