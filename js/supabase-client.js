// Client Supabase - Initialisation et configuration

// Vérification que les credentials existent
if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
  console.error('Erreur : Les credentials Supabase ne sont pas définis dans config.js');
  throw new Error('Configuration Supabase manquante');
}

// Initialisation du client Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export pour utilisation dans d'autres modules
window.supabaseClient = supabaseClient;

// Helper pour gérer les erreurs Supabase
function handleSupabaseError(error, context = '') {
  console.error(`Erreur Supabase ${context}:`, error);

  if (error.message) {
    return error.message;
  }

  return 'Une erreur est survenue. Veuillez réessayer.';
}

// Helper pour obtenir l'utilisateur courant
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error) throw error;

    return user;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
}

// Helper pour obtenir le profil complet de l'utilisateur
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseClient
      .from('users_profile')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    return null;
  }
}

// Export des helpers
window.handleSupabaseError = handleSupabaseError;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
