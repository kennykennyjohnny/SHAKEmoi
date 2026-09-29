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

// Délai maximum par requête (I7) : sur un mauvais réseau, une requête ne
// tourne plus à l'infini ; l'écran peut afficher « Réessayer ». Les envois
// de fichiers ont droit à plus de temps.
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
const timedFetch: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const ms = url.includes('/storage/v1/object') ? 60_000 : 20_000;
  return fetch(input, { ...init, signal: timeoutSignal(ms) });
};

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: timedFetch },
});
export { SUPABASE_URL, SUPABASE_ANON_KEY };
