// SHAKEMOI - Database Functions

// ==================== USER ====================

// Get current user
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get user profile
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Get user stats
async function getUserStats(userId) {
  try {
    const profile = await getUserProfile(userId);

    if (!profile) {
      return { feels: 0, feelings: 0 };
    }

    return {
      feels: profile.feels_count || 0,
      feelings: profile.feelings_count || 0
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { feels: 0, feelings: 0 };
  }
}

// ==================== POSTS ====================

// Get feed (posts from followed users)
async function getFeed(limit = 20) {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Get IDs of users I'm following
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = follows ? follows.map(f => f.following_id) : [];

    // Ne PAS inclure ses propres posts dans le feed
    // Les posts de l'utilisateur sont visibles uniquement sur son profil

    // Get posts from followed users only
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color),
        original_post:posts!original_post_id(
          user_id,
          user:users_profile!posts_user_id_fkey(id, username, color)
        )
      `)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching feed:', error);
      throw error;
    }

    // Pour chaque post, compter les commentaires
    if (posts && posts.length > 0) {
      const postsWithComments = await Promise.all(posts.map(async (post) => {
        // Compter les commentaires
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        return {
          ...post,
          comments_count: count || 0,
          comments: [] // On chargera les commentaires à la demande
        };
      }));

      return postsWithComments;
    }

    return posts || [];
  } catch (error) {
    console.error('Error getting feed:', error);
    return [];
  }
}

// Get user's posts
async function getUserPosts(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user posts:', error);
    return [];
  }
}

// Create post (shake a track)
async function createPost(trackName, artist, coverUrl, text = '', previewUrl = null) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id,
        track_name: trackName,
        artist: artist,
        cover_url: coverUrl,
        text: text,
        preview_url: previewUrl,
        likes_count: 0,
        comments_count: 0,
        is_reshake: false
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating post:', error);
    return { success: false, error: error.message };
  }
}

// Re-shake a post
async function reshakePost(originalPostId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Get original post
    const { data: originalPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', originalPostId)
      .single();

    if (!originalPost) throw new Error('Post not found');

    // Create re-shake
    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id,
        track_name: originalPost.track_name,
        artist: originalPost.artist,
        cover_url: originalPost.cover_url,
        text: originalPost.text,
        preview_url: originalPost.preview_url,
        likes_count: 0,
        comments_count: 0,
        is_reshake: true,
        original_post_id: originalPostId
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error reshaking post:', error);
    return { success: false, error: error.message };
  }
}

// ==================== LIKES ====================

// Like a post
async function likePost(postId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    console.log('👍 Liking post:', postId);

    // 1. Insert like
    const { data: likeData, error: likeError } = await supabase
      .from('likes')
      .insert([{
        post_id: postId,
        user_id: user.id
      }])
      .select();

    if (likeError) {
      console.error('❌ Error inserting like:', likeError);
      throw likeError;
    }

    console.log('✅ Like inserted:', likeData);

    // 2. Increment likes_count via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('increment_likes', {
      post_id: postId
    });

    if (rpcError) {
      console.error('⚠️ Warning: RPC increment failed:', rpcError);
      // Don't fail completely, the like was inserted
    } else {
      console.log('✅ Likes count incremented');
    }

    return { success: true };
  } catch (error) {
    console.error('💥 Error liking post:', error);
    return { success: false, error: error.message };
  }
}

// Unlike a post
async function unlikePost(postId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    console.log('👎 Unliking post:', postId);

    // 1. Delete like
    const { data: deleteData, error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .select();

    if (deleteError) {
      console.error('❌ Error deleting like:', deleteError);
      throw deleteError;
    }

    console.log('✅ Like deleted:', deleteData);

    // 2. Decrement likes_count via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('decrement_likes', {
      post_id: postId
    });

    if (rpcError) {
      console.error('⚠️ Warning: RPC decrement failed:', rpcError);
      // Don't fail completely, the like was deleted
    } else {
      console.log('✅ Likes count decremented');
    }

    return { success: true };
  } catch (error) {
    console.error('💥 Error unliking post:', error);
    return { success: false, error: error.message };
  }
}

// Check if user liked a post
async function hasLikedPost(postId) {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no row

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is OK
      console.error('Error checking like status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasLikedPost:', error);
    return false;
  }
}

// Get posts liked by user
async function getUserLikedPosts(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('likes')
      .select(`
        post:posts(
          *,
          user:users_profile!posts_user_id_fkey(id, username, color)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erreur lors de la récupération des posts likés:', error);
      throw error;
    }

    console.log('Données brutes des likes:', data);

    const posts = data ? data.map(item => item.post).filter(post => post !== null) : [];
    console.log('Posts likés filtrés:', posts);

    return posts;
  } catch (error) {
    console.error('Error getting liked posts:', error);
    return [];
  }
}

// ==================== COMMENTS ====================

// Add comment to post
async function addComment(postId, text) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('comments')
      .insert([{
        post_id: postId,
        user_id: user.id,
        text: text
      }])
      .select()
      .single();

    if (error) throw error;

    // Increment comments_count
    await supabase.rpc('increment_comments', { post_id: postId });

    return { success: true, data };
  } catch (error) {
    console.error('Error adding comment:', error);
    return { success: false, error: error.message };
  }
}

// Get comments for post
async function getPostComments(postId) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
}

// Get user's comments
async function getUserComments(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        post:posts(
          *,
          user:users_profile!posts_user_id_fkey(id, username, color)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user comments:', error);
    return [];
  }
}

// ==================== FOLLOWS ====================

// Follow a user
async function followUser(targetUserId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    if (user.id === targetUserId) {
      throw new Error('Cannot follow yourself');
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single();

    if (existing) {
      throw new Error('Already following this user');
    }

    // Check limit of 100 follows
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id);

    if (count >= 100) {
      throw new Error('Limite de 100 feels atteinte');
    }

    // Create follow
    const { error } = await supabase
      .from('follows')
      .insert([{
        follower_id: user.id,
        following_id: targetUserId
      }]);

    if (error) throw error;

    // Update counters via triggers (automatic in SQL)

    return { success: true };
  } catch (error) {
    console.error('Error following user:', error);
    return { success: false, error: error.message };
  }
}

// Unfollow a user
async function unfollowUser(targetUserId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);

    if (error) throw error;

    // Update counters via triggers (automatic in SQL)

    return { success: true };
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return { success: false, error: error.message };
  }
}

// Check if following a user
async function isFollowing(targetUserId) {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}

// Get user's followers (who feels them)
async function getUserFollowers(userId, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower:users_profile!follows_follower_id_fkey(id, username, color, feels_count, feelings_count)
      `)
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ? data.map(item => item.follower).filter(user => user !== null) : [];
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
}

// Get user's following (who they feel)
async function getUserFollowing(userId, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following:users_profile!follows_following_id_fkey(id, username, color, feels_count, feelings_count)
      `)
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ? data.map(item => item.following).filter(user => user !== null) : [];
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
}

// ==================== SEARCH ====================

// Search users
async function searchUsers(query) {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('*')
      .ilike('username', `%${query}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

// Search posts by track name or artist
async function searchPosts(query) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color)
      `)
      .or(`track_name.ilike.%${query}%,artist.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
}
