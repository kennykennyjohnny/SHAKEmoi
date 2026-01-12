// SHAKEMOI - Database Functions (TypeScript)
import { supabase } from './supabase';

// ==================== TYPES ====================

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  color: string;
  profile_color?: string;
  profile_album_cover_url?: string;
  feels_count: number;
  feelings_count: number;
}

export interface Post {
  id: string;
  user_id: string;
  track_name: string;
  artist: string;
  cover_url: string;
  text?: string;
  preview_url?: string;
  spotify_url?: string;
  track_id?: string;
  likes_count: number;
  comments_count: number;
  reshakes_count?: number;
  is_reshake: boolean;
  original_post_id?: string;
  created_at: string;
  user?: UserProfile;
  original_post?: Post;
}

// ==================== USER ====================

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    console.log('🔍 Getting profile for user:', userId);

    const { data, error } = await supabase
      .from('users_profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching profile:', error);
      return null;
    }

    if (data) {
      console.log('✅ Profile found:', data.username);
      return data;
    }

    console.log('❌ No profile found for user:', userId);
    return null;

  } catch (error) {
    console.error('💥 Error in getUserProfile:', error);
    return null;
  }
}

export async function getUserStats(userId: string) {
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

export async function getFeed(limit = 20): Promise<Post[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Get IDs of users I'm following
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = follows ? follows.map(f => f.following_id) : [];

    // Get posts from followed users only
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color, profile_album_cover_url, profile_color),
        original_post:posts!original_post_id(
          *,
          user:users_profile!posts_user_id_fkey(id, username, color, profile_album_cover_url, profile_color)
        )
      `)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching feed:', error);
      throw error;
    }

    // Pour chaque post, compter les commentaires et les reshakes
    if (posts && posts.length > 0) {
      const postsWithCounts = await Promise.all(posts.map(async (post: any) => {
        // Compter les commentaires
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        // Compter les reshakes
        const originalPostId = post.is_reshake ? post.original_post_id : post.id;
        const { count: reshakesCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('original_post_id', originalPostId)
          .eq('is_reshake', true);

        return {
          ...post,
          comments_count: commentsCount || 0,
          reshakes_count: reshakesCount || 0,
        };
      }));

      return postsWithCounts;
    }

    return posts || [];
  } catch (error) {
    console.error('Error getting feed:', error);
    return [];
  }
}

export async function getUserPosts(userId: string, limit = 50): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, color, profile_album_cover_url, profile_color),
        original_post:posts!original_post_id(
          *,
          user:users_profile!posts_user_id_fkey(id, username, color, profile_album_cover_url, profile_color)
        )
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

export async function createPost(
  trackName: string,
  artist: string,
  coverUrl: string,
  text = '',
  previewUrl: string | null = null,
  spotifyUrl: string | null = null,
  trackId: string | null = null
) {
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
        spotify_url: spotifyUrl,
        track_id: trackId,
        likes_count: 0,
        comments_count: 0,
        is_reshake: false
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating post:', error);
    return { success: false, error: error.message };
  }
}

export async function reshakePost(originalPostId: string) {
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

    // Si le post est déjà un reshake, utiliser son original_post_id
    const trueOriginalPostId = originalPost.is_reshake && originalPost.original_post_id
      ? originalPost.original_post_id
      : originalPostId;

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
        spotify_url: originalPost.spotify_url,
        track_id: originalPost.track_id,
        likes_count: 0,
        comments_count: 0,
        is_reshake: true,
        original_post_id: trueOriginalPostId
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error reshaking post:', error);
    return { success: false, error: error.message };
  }
}

// ==================== LIKES ====================

export async function likePost(postId: string) {
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
    } else {
      console.log('✅ Likes count incremented');
    }

    return { success: true };
  } catch (error: any) {
    console.error('💥 Error liking post:', error);
    return { success: false, error: error.message };
  }
}

export async function unlikePost(postId: string) {
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
    } else {
      console.log('✅ Likes count decremented');
    }

    return { success: true };
  } catch (error: any) {
    console.error('💥 Error unliking post:', error);
    return { success: false, error: error.message };
  }
}

export async function hasLikedPost(postId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking like status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasLikedPost:', error);
    return false;
  }
}

export async function getUserLikedPosts(userId: string, limit = 50): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('likes')
      .select(`
        post:posts(
          *,
          user:users_profile!posts_user_id_fkey(id, username, color, profile_album_cover_url, profile_color)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erreur lors de la récupération des posts likés:', error);
      throw error;
    }

    const posts = data ? data.map((item: any) => item.post).filter((post: any) => post !== null) : [];
    return posts;
  } catch (error) {
    console.error('Error getting liked posts:', error);
    return [];
  }
}

// ==================== COMMENTS ====================

export async function addComment(postId: string, text: string) {
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
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return { success: false, error: error.message };
  }
}

export async function getPostComments(postId: string) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users_profile(id, username, color)
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

// ==================== FOLLOWS ====================

export async function followUser(targetUserId: string) {
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

    if (count && count >= 100) {
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

    return { success: true };
  } catch (error: any) {
    console.error('Error following user:', error);
    return { success: false, error: error.message };
  }
}

export async function unfollowUser(targetUserId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error unfollowing user:', error);
    return { success: false, error: error.message };
  }
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
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

export async function getUserFollowers(userId: string, limit = 100) {
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
    return data ? data.map((item: any) => item.follower).filter((user: any) => user !== null) : [];
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
}

export async function getUserFollowing(userId: string, limit = 100) {
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
    return data ? data.map((item: any) => item.following).filter((user: any) => user !== null) : [];
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
}

// ==================== SEARCH ====================

export async function searchUsers(query: string) {
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

export async function getTopUsers(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('*')
      .order('feels_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting top users:', error);
    return [];
  }
}

export async function searchPosts(query: string) {
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
