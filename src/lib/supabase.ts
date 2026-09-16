import { createClient } from '@supabase/supabase-js';

// SHAKEMOI - Supabase Configuration
// Priorité aux variables d'environnement (local .env / Vercel). À défaut, on
// retombe sur les valeurs publiques du projet : la clé `anon` est PUBLIQUE par
// design (elle part de toute façon dans le bundle navigateur), protégée par le
// RLS — la coder en fallback n'est donc pas une faille, et ça garantit que
// l'app démarre même si les variables d'env ne sont pas configurées.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL, SUPABASE_ANON_KEY };
