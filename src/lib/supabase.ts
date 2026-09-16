import { createClient } from '@supabase/supabase-js';

// SHAKEMOI - Supabase Configuration
// Les clés viennent EXCLUSIVEMENT des variables d'environnement :
//   - en local : fichier .env (gitignoré) — voir .env.example
//   - en prod  : variables d'environnement Vercel
// Aucune clé n'est codée en dur dans le source.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[SHAKEmoi] Configuration Supabase manquante : définis VITE_SUPABASE_URL et " +
      "VITE_SUPABASE_ANON_KEY (fichier .env en local — voir .env.example — ou variables " +
      "d'environnement Vercel en prod)."
  );
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL, SUPABASE_ANON_KEY };
