// Module Recherche - Users et Tracks

class SearchManager {
  constructor() {
    this.searchResults = [];
    this.searchType = 'people'; // 'people' ou 'sounds'
  }

  // Rechercher des utilisateurs
  async searchUsers(query) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const { data, error } = await supabaseClient
        .from('users_profile')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(50);

      if (error) throw error;

      this.searchResults = data || [];
      return this.searchResults;
    } catch (error) {
      console.error('Erreur recherche users:', error);
      return [];
    }
  }

  // Rechercher des tracks/posts
  async searchTracks(query) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const { data, error } = await supabaseClient
        .from('posts')
        .select(`
          *,
          users_profile:user_id (
            username,
            color
          )
        `)
        .or(`track_name.ilike.%${query}%,artist_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      this.searchResults = data || [];
      return this.searchResults;
    } catch (error) {
      console.error('Erreur recherche tracks:', error);
      return [];
    }
  }

  // Suivre un utilisateur (Feel)
  async followUser(userId) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      // Vérifier la limite de 100 abonnements
      const { count, error: countError } = await supabaseClient
        .from('feels')
        .select('*', { count: 'exact', head: true })
        .eq('feeler_id', currentUser.id);

      if (countError) throw countError;

      if (count >= 100) {
        throw new Error('Limite de 100 abonnements atteinte');
      }

      // Vérifier si déjà suivi
      const { data: existing, error: checkError } = await supabaseClient
        .from('feels')
        .select('id')
        .eq('feeler_id', currentUser.id)
        .eq('feeling_id', userId)
        .single();

      if (existing) {
        throw new Error('Vous suivez déjà cet utilisateur');
      }

      // Créer le follow
      const { error: insertError } = await supabaseClient
        .from('feels')
        .insert([
          {
            feeler_id: currentUser.id,
            feeling_id: userId
          }
        ]);

      if (insertError) throw insertError;

      return { success: true };
    } catch (error) {
      console.error('Erreur follow user:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du follow'
      };
    }
  }

  // Ne plus suivre un utilisateur (Unfeel)
  async unfollowUser(userId) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      const { error } = await supabaseClient
        .from('feels')
        .delete()
        .eq('feeler_id', currentUser.id)
        .eq('feeling_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Erreur unfollow user:', error);
      return {
        success: false,
        error: 'Erreur lors du unfollow'
      };
    }
  }

  // Vérifier si on suit un utilisateur
  async isFollowing(userId) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) return false;

      const { data, error } = await supabaseClient
        .from('feels')
        .select('id')
        .eq('feeler_id', currentUser.id)
        .eq('feeling_id', userId)
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }

  // Obtenir le nombre d'abonnements de l'utilisateur courant
  async getFollowingCount() {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) return 0;

      const { count, error } = await supabaseClient
        .from('feels')
        .select('*', { count: 'exact', head: true })
        .eq('feeler_id', currentUser.id);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Erreur comptage follows:', error);
      return 0;
    }
  }

  // Changer le type de recherche
  setSearchType(type) {
    this.searchType = type;
  }

  getSearchType() {
    return this.searchType;
  }

  getSearchResults() {
    return this.searchResults;
  }
}

// Initialisation du search manager
window.searchManager = new SearchManager();
