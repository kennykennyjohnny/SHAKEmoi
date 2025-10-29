// Module Profil - Affichage et gestion du profil utilisateur

class ProfileManager {
  constructor() {
    this.viewMode = 'shakes'; // 'shakes' ou 'comments'
    this.userPosts = [];
    this.userLikes = [];
    this.userComments = [];
  }

  // Charger les posts de l'utilisateur
  async loadUserPosts(userId = null) {
    try {
      const targetUserId = userId || authManager.getUser()?.id;
      if (!targetUserId) return [];

      const { data, error } = await supabaseClient
        .from('posts')
        .select(`
          *,
          users_profile:user_id (
            username,
            color
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.userPosts = data || [];
      return this.userPosts;
    } catch (error) {
      console.error('Erreur chargement posts user:', error);
      return [];
    }
  }

  // Charger les likes de l'utilisateur
  async loadUserLikes(userId = null) {
    try {
      const targetUserId = userId || authManager.getUser()?.id;
      if (!targetUserId) return [];

      const { data, error } = await supabaseClient
        .from('likes')
        .select(`
          post_id,
          posts (
            *,
            users_profile:user_id (
              username,
              color
            )
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extraire les posts des likes
      this.userLikes = data?.map(like => like.posts).filter(Boolean) || [];
      return this.userLikes;
    } catch (error) {
      console.error('Erreur chargement likes user:', error);
      return [];
    }
  }

  // Charger les commentaires de l'utilisateur
  async loadUserComments(userId = null) {
    try {
      const targetUserId = userId || authManager.getUser()?.id;
      if (!targetUserId) return [];

      const { data, error } = await supabaseClient
        .from('comments')
        .select(`
          *,
          posts (
            *,
            users_profile:user_id (
              username,
              color
            )
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.userComments = data || [];
      return this.userComments;
    } catch (error) {
      console.error('Erreur chargement comments user:', error);
      return [];
    }
  }

  // Obtenir les stats de l'utilisateur
  async getUserStats(userId = null) {
    try {
      const targetUserId = userId || authManager.getUser()?.id;
      if (!targetUserId) return { feels: 0, feelings: 0 };

      // Nombre de personnes que l'user suit (feels)
      const { count: feelsCount, error: feelsError } = await supabaseClient
        .from('feels')
        .select('*', { count: 'exact', head: true })
        .eq('feeler_id', targetUserId);

      if (feelsError) throw feelsError;

      // Nombre de personnes qui suivent l'user (feelings)
      const { count: feelingsCount, error: feelingsError } = await supabaseClient
        .from('feels')
        .select('*', { count: 'exact', head: true })
        .eq('feeling_id', targetUserId);

      if (feelingsError) throw feelingsError;

      return {
        feels: feelsCount || 0,
        feelings: feelingsCount || 0
      };
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      return { feels: 0, feelings: 0 };
    }
  }

  // Changer le mode de vue
  setViewMode(mode) {
    this.viewMode = mode;
  }

  getViewMode() {
    return this.viewMode;
  }

  getUserPosts() {
    return this.userPosts;
  }

  getUserLikes() {
    return this.userLikes;
  }

  getUserComments() {
    return this.userComments;
  }

  // Obtenir les posts à afficher selon le mode
  getCurrentViewPosts() {
    if (this.viewMode === 'shakes') {
      return this.userLikes;
    } else {
      // Pour les commentaires, on retourne les posts commentés
      return this.userComments.map(comment => comment.posts).filter(Boolean);
    }
  }
}

// Initialisation du profile manager
window.profileManager = new ProfileManager();
