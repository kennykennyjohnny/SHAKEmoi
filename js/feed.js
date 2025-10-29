// Module Feed - Affichage et gestion des posts

class FeedManager {
  constructor() {
    this.posts = [];
    this.subscription = null;
  }

  // Charger les posts du feed
  async loadFeed() {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) return [];

      // Récupérer les IDs des personnes suivies
      const { data: following, error: followError } = await supabaseClient
        .from('feels')
        .select('feeling_id')
        .eq('feeler_id', currentUser.id);

      if (followError) throw followError;

      const followingIds = following.map(f => f.feeling_id);

      // Ajouter l'utilisateur courant pour voir ses propres posts
      followingIds.push(currentUser.id);

      // Récupérer les posts
      const { data: posts, error: postsError } = await supabaseClient
        .from('posts')
        .select(`
          *,
          users_profile:user_id (
            username,
            color
          )
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      this.posts = posts || [];
      return this.posts;
    } catch (error) {
      console.error('Erreur chargement feed:', error);
      return [];
    }
  }

  // Créer un nouveau post
  async createPost(trackName, artistName, albumCover, text) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      // Valider la longueur du texte
      if (text.length > 444) {
        throw new Error('Le texte ne peut pas dépasser 444 caractères');
      }

      const { data, error } = await supabaseClient
        .from('posts')
        .insert([
          {
            user_id: currentUser.id,
            track_name: trackName,
            artist_name: artistName,
            album_cover: albumCover,
            text: text,
            likes_count: 0,
            comments_count: 0
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { success: true, post: data };
    } catch (error) {
      console.error('Erreur création post:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la création du post'
      };
    }
  }

  // Liker/unliker un post
  async toggleLike(postId) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      // Vérifier si déjà liké
      const { data: existingLike, error: checkError } = await supabaseClient
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabaseClient
          .from('likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;

        // Décrémenter le compteur
        const { error: updateError } = await supabaseClient.rpc(
          'decrement_likes',
          { post_id: postId }
        );

        return { success: true, liked: false };
      } else {
        // Like
        const { error: insertError } = await supabaseClient
          .from('likes')
          .insert([
            {
              post_id: postId,
              user_id: currentUser.id
            }
          ]);

        if (insertError) throw insertError;

        // Incrémenter le compteur
        const { error: updateError } = await supabaseClient.rpc(
          'increment_likes',
          { post_id: postId }
        );

        return { success: true, liked: true };
      }
    } catch (error) {
      console.error('Erreur toggle like:', error);
      return {
        success: false,
        error: 'Erreur lors du like'
      };
    }
  }

  // Vérifier si l'utilisateur a liké un post
  async hasLiked(postId) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) return false;

      const { data, error } = await supabaseClient
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }

  // Ajouter un commentaire
  async addComment(postId, text) {
    try {
      const currentUser = authManager.getUser();
      if (!currentUser) throw new Error('Non authentifié');

      const { error: insertError } = await supabaseClient
        .from('comments')
        .insert([
          {
            post_id: postId,
            user_id: currentUser.id,
            text: text
          }
        ]);

      if (insertError) throw insertError;

      // Incrémenter le compteur
      const { error: updateError } = await supabaseClient.rpc(
        'increment_comments',
        { post_id: postId }
      );

      return { success: true };
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      return {
        success: false,
        error: 'Erreur lors de l\'ajout du commentaire'
      };
    }
  }

  // S'abonner aux nouveaux posts en temps réel
  subscribeToFeed() {
    const currentUser = authManager.getUser();
    if (!currentUser) return;

    this.subscription = supabaseClient
      .channel('posts_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          // Recharger le feed quand un nouveau post est créé
          this.loadFeed().then(() => {
            window.renderFeed();
          });
        }
      )
      .subscribe();
  }

  // Se désabonner
  unsubscribeFromFeed() {
    if (this.subscription) {
      supabaseClient.removeChannel(this.subscription);
      this.subscription = null;
    }
  }

  // Obtenir les posts
  getPosts() {
    return this.posts;
  }
}

// Initialisation du feed manager
window.feedManager = new FeedManager();
