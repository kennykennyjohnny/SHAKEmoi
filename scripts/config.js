// SHAKEMOI - Supabase Configuration

// ⚠️ IMPORTANT: Remplace ces valeurs par tes credentials Supabase
// Tu peux les trouver sur : https://app.supabase.com/project/[TON-PROJECT]/settings/api

const SUPABASE_URL = 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';

// Initialiser le client Supabase
let supabase;

try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase initialized');
} catch (error) {
  console.error('❌ Erreur initialisation Supabase:', error);
  alert('Erreur de configuration. Vérifie tes credentials Supabase dans scripts/config.js');
}

// Export global
window.supabase = supabase;
