// SHAKEMOI - Supabase Configuration

// ⚠️ IMPORTANT: Remplace ces valeurs par tes credentials Supabase
// Tu peux les trouver sur : https://app.supabase.com/project/[TON-PROJECT]/settings/api

const SUPABASE_URL = 'https://[TON-PROJECT-ID].supabase.co';
const SUPABASE_ANON_KEY = '[TA-SUPABASE-ANON-KEY]';

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
