// SHAKEMOI - Supabase Configuration

// ⚠️ IMPORTANT: Remplace ces valeurs par tes credentials Supabase
// Tu peux les trouver sur : https://app.supabase.com/project/[TON-PROJECT]/settings/api

const SUPABASE_URL = 'https://vbjmhtwrfboqziwibsut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiam1odHdyZmJvcXppd2lic3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg4MDUsImV4cCI6MjA4MTM5NDgwNX0.yo5fmTzu_M5llIYLsxgL00nVkH11wTuFAkQoqLd6Bks';

// Attendre que Supabase soit chargé
if (typeof window.supabase === 'undefined') {
  console.error('❌ Supabase library not loaded. Make sure the CDN script is included.');
  alert('Erreur: Bibliothèque Supabase non chargée. Rafraîchis la page.');
}

// Initialiser le client Supabase
let supabase;

try {
  // Vérifier que la bibliothèque Supabase est chargée
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase library not loaded properly');
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase initialized successfully');
  console.log('📍 Project URL:', SUPABASE_URL);
} catch (error) {
  console.error('❌ Erreur initialisation Supabase:', error);
  console.error('URL:', SUPABASE_URL);
  console.error('Key (first 20 chars):', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  alert('Erreur de configuration Supabase. Vérifie la console (F12) pour plus de détails.');
}

// Export global
window.supabase = supabase;
