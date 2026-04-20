// SHAKEMOI - Database Functions (TypeScript)
import { supabase } from './supabase';
import { getOdesliLinks } from './odesli';

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

export interface Story {
  id: string;
  user_id: string;
  image_url?: string | null;
  track_name?: string | null;
  artist?: string | null;
  cover_url?: string | null;
  track_id?: string | null;
  spotify_url?: string | null;
  spotify_embed_url?: string | null;
  text?: string | null;
  theme_color?: string | null;
  duration_days: number;
  expires_at: string;
  created_at: string;
  user?: any;
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
    // Include own posts + followed users' posts
    const feedUserIds = [...followingIds, user.id];

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color),
        original_post:posts!original_post_id(
          *,
          user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
        )
      `)
      .in('user_id', feedUserIds)
      .neq('is_private', true)
      .is('circle_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Retry without circle_id filter if column doesn't exist
      if (error.message?.includes('circle_id') || error.code === '42703') {
        const { data: fallback } = await supabase
          .from('posts')
          .select(`*, user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color), original_post:posts!original_post_id(*, user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color))`)
          .in('user_id', feedUserIds)
          .neq('is_private', true)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (fallback) return fallback;
      }
      console.error('Error fetching feed:', error);
      throw error;
    }

    // Use stored counts from DB (no extra queries)
    return (posts || []).map((post: any) => ({
      ...post,
      comments_count: post.comments_count || 0,
      reshakes_count: post.reshakes_count || 0,
    }));
  } catch (error) {
    console.error('Error getting feed:', error);
    return [];
  }
}

// Fetch a single post by ID (used as fallback for reshake self-join)
export async function getPostById(postId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
      `)
      .eq('id', postId)
      .single();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function getUserPosts(userId: string, limit = 50): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color),
        original_post:posts!original_post_id(
          *,
          user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
        )
      `)
      .eq('user_id', userId)
      .neq('is_private', true)
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
  trackId: string | null = null,
  isPrivate: boolean = false,
  circleId: string | null = null,
  imageUrl: string | null = null
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch cross-platform links from Odesli
    const odesliLinks = spotifyUrl ? await getOdesliLinks(spotifyUrl) : null;

    // Build embed URL from track ID
    const spotifyEmbedUrl = trackId
      ? `https://open.spotify.com/embed/track/${trackId}`
      : null;

    // For text-only messages (circle chat), send null instead of empty strings
    // to avoid trigger issues with empty track fields
    const hasTrack = !!(trackName && trackName.trim());

    const postData: any = {
        user_id: user.id,
        track_name: hasTrack ? trackName : null,
        artist: hasTrack ? artist : null,
        cover_url: hasTrack ? coverUrl : null,
        text: text || null,
        preview_url: previewUrl || null,
        spotify_url: spotifyUrl || null,
        spotify_embed_url: spotifyEmbedUrl,
        track_id: trackId || null,
        // Odesli universal links
        apple_music_url: odesliLinks?.apple_music_url ?? null,
        deezer_url: odesliLinks?.deezer_url ?? null,
        youtube_url: odesliLinks?.youtube_url ?? null,
        youtube_music_url: odesliLinks?.youtube_music_url ?? null,
        tidal_url: odesliLinks?.tidal_url ?? null,
        odesli_page_url: odesliLinks?.odesli_page_url ?? null,
        likes_count: 0,
        comments_count: 0,
        is_reshake: false,
        is_private: isPrivate,
        circle_id: circleId || null,
        image_url: imageUrl || null,
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single();

    if (error) throw error;
    
    // Notify circle members if posted in a circle
    if (circleId && data) {
      try {
        const { data: members } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circleId)
          .neq('user_id', user.id);
        if (members) {
          await supabase.from('notifications').insert(
            members.map((m: any) => ({ user_id: m.user_id, from_user_id: user.id, type: 'circle_post', post_id: data.id }))
          );
        }
      } catch {}
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating post:', error);
    return { success: false, error: error.message };
  }
}

export async function reshakePost(originalPostId: string, comment?: string) {
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

    // Create re-shake with optional comment — copy ALL fields including embed + Odesli links
    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id,
        track_name: originalPost.track_name,
        artist: originalPost.artist,
        cover_url: originalPost.cover_url,
        text: comment || originalPost.text,
        preview_url: originalPost.preview_url,
        spotify_url: originalPost.spotify_url,
        spotify_embed_url: originalPost.spotify_embed_url,
        track_id: originalPost.track_id,
        // Odesli links
        apple_music_url: originalPost.apple_music_url,
        deezer_url: originalPost.deezer_url,
        youtube_url: originalPost.youtube_url,
        youtube_music_url: originalPost.youtube_music_url,
        tidal_url: originalPost.tidal_url,
        odesli_page_url: originalPost.odesli_page_url,
        likes_count: 0,
        comments_count: 0,
        reshakes_count: 0,
        is_reshake: true,
        original_post_id: trueOriginalPostId
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Increment reshakes_count on original post
    await supabase.rpc('increment_reshakes_count', { post_id: trueOriginalPostId });
    
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

// Batch check likes for multiple posts in one query
export async function hasLikedPosts(postIds: string[]): Promise<Record<string, boolean>> {
  try {
    if (postIds.length === 0) return {};
    const user = await getCurrentUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    if (error) {
      console.error('Error batch checking likes:', error);
      return {};
    }

    const likedSet = new Set((data || []).map((d: any) => d.post_id));
    const result: Record<string, boolean> = {};
    for (const id of postIds) result[id] = likedSet.has(id);
    return result;
  } catch (error) {
    console.error('Error in hasLikedPosts:', error);
    return {};
  }
}

export async function getUserLikedPosts(userId: string, limit = 50): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('likes')
      .select(`
        post:posts(
          *,
          user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
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
        user:users_profile(id, username, color, profile_album_cover_url)
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
        follower:users_profile!follows_follower_id_fkey(id, username, display_name, color, profile_album_cover_url)
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
        following:users_profile!follows_following_id_fkey(id, username, display_name, color, profile_album_cover_url)
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

export async function removeFollower(followerId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error removing follower:', error);
    return { success: false, error: error.message };
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
        user:users_profile!posts_user_id_fkey(id, username, display_name, color)
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

// ==================== ADDITIONAL FUNCTIONS ====================

export async function getTopPosts(limit = 10) {
  try {
    // Get recent posts (not reshakes) with user info
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(*)
      `)
      .eq('is_reshake', false)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get real like counts from the likes table
    const postIds = data.map((p: any) => p.id);
    const { data: likes } = await supabase
      .from('likes')
      .select('post_id')
      .in('post_id', postIds);

    const likeCountMap = new Map<string, number>();
    (likes || []).forEach((l: any) => {
      likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1);
    });

    // Attach real counts
    data.forEach((post: any) => {
      post.likes_count = likeCountMap.get(post.id) || 0;
    });
    
    // Deduplicate by track_name + artist, keep highest likes
    const uniqueTracks = new Map();
    data.forEach((post: any) => {
      const key = `${post.track_name}-${post.artist}`.toLowerCase();
      const existing = uniqueTracks.get(key);
      if (!existing || (post.likes_count || 0) > (existing.likes_count || 0)) {
        uniqueTracks.set(key, post);
      }
    });
    
    // Sort by real likes and return
    return Array.from(uniqueTracks.values())
      .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top posts:', error);
    return [];
  }
}

export async function deletePost(postId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Verify post belongs to user
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (fetchError) throw fetchError;
    if (post.user_id !== user.id) throw new Error('Not authorized');

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  try {
    const { error } = await supabase
      .from('users_profile')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function getUserFollowersCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting followers count:', error);
    return 0;
  }
}

export async function getUserFollowingCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting following count:', error);
    return 0;
  }
}

export async function getUserReshakes(userId: string) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color),
        original_post:posts!original_post_id(
          *,
          user:users_profile!posts_user_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
        )
      `)
      .eq('user_id', userId)
      .eq('is_reshake', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user reshakes:', error);
    return [];
  }
}

// Get user notifications
export async function getUserNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        from_user:users_profile!notifications_from_user_id_fkey(id, username, profile_album_cover_url),
        post:posts!notifications_post_id_fkey(id, track_name, cover_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    // Transform to expected format
    return (data || []).map((notif: any) => ({
      id: notif.id,
      type: notif.type,
      actor_id: notif.from_user?.id || null,
      actor_username: notif.from_user?.username || 'unknown',
      actor_avatar: notif.from_user?.profile_album_cover_url,
      post_id: notif.post?.id || null,
      post_cover_url: notif.post?.cover_url,
      post_track_name: notif.post?.track_name || null,
      content: getNotificationMessage(notif.type),
      created_at: notif.created_at,
      is_read: notif.is_read
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

function getNotificationMessage(type: string): string {
  switch (type) {
    case 'like': return 'a aimé ton shake';
    case 'comment': return 'a commenté ton shake';
    case 'reshake': return 'a reshaké ton post';
    case 'follow': return 's\'est abonné(e) à toi';
    case 'feel': return 't\'a ajouté en ami';
    case 'circle_join': return 'a rejoint ton cercle';
    case 'circle_post': return 'a posté dans ton cercle';
    case 'circle_create': return 'Cercle créé !';
    case 'song_share': return 't\'a envoyé un son';
    case 'message': return 't\'a envoyé un message';
    case 'story_like': return 'a aimé ton shake éphémère ❤️';
    case 'story_comment': return 'a commenté ton shake éphémère 💭';
    default: return 'a interagi avec toi';
  }
}

// ==================== SHAKE DU JOUR ====================

// Shake de la semaine — 1 morceau obligatoire par semaine (reset mardi 9h)
function getCurrentShakeWeekStart(): string {
  const now = new Date();
  // Find the most recent Tuesday 9:00 UTC
  const day = now.getUTCDay(); // 0=Sun, 2=Tue
  const hour = now.getUTCHours();
  let daysBack = (day - 2 + 7) % 7;
  // If it's Tuesday but before 9h, go back to previous Tuesday
  if (daysBack === 0 && hour < 9) daysBack = 7;
  const tuesday = new Date(now);
  tuesday.setUTCDate(now.getUTCDate() - daysBack);
  tuesday.setUTCHours(9, 0, 0, 0);
  return tuesday.toISOString().split('T')[0];
}

export async function hasShakeToday(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const weekStart = getCurrentShakeWeekStart();
    const { data, error } = await supabase
      .from('shake_du_jour')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_date', weekStart)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking shake de la semaine:', error);
    return false;
  }
}

export async function createShakeDuJour(postId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('shake_du_jour')
      .insert([{
        user_id: user.id,
        post_id: postId,
        created_date: today
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating shake de la semaine:', error);
    return { success: false, error: error.message };
  }
}

export async function getFriendsShakesDuJour(): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const friendIds = follows ? [...follows.map(f => f.following_id), user.id] : [user.id];
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('shake_du_jour')
      .select(`
        *,
        user:users_profile!shake_du_jour_user_id_fkey(id, username, display_name, profile_album_cover_url),
        post:posts!shake_du_jour_post_id_fkey(*)
      `)
      .in('user_id', friendIds)
      .eq('created_date', today)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting friends shakes du jour:', error);
    return [];
  }
}

// ==================== MESSAGES (Messagerie musicale) ====================

export async function getConversations(): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Get all unique conversation partners
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users_profile!messages_sender_id_fkey(id, username, display_name, profile_album_cover_url),
        receiver:users_profile!messages_receiver_id_fkey(id, username, display_name, profile_album_cover_url)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation partner, keep last message
    const conversations = new Map();
    (data || []).forEach((msg: any) => {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!conversations.has(partnerId)) {
        const partner = msg.sender_id === user.id ? msg.receiver : msg.sender;
        conversations.set(partnerId, {
          partnerId,
          partner,
          lastMessage: msg,
          unreadCount: (!msg.is_read && msg.receiver_id === user.id) ? 1 : 0
        });
      } else if (!msg.is_read && msg.receiver_id === user.id) {
        conversations.get(partnerId).unreadCount++;
      }
    });

    return Array.from(conversations.values());
  } catch (error) {
    console.error('Error getting conversations:', error);
    return [];
  }
}

export async function getMessages(partnerId: string, limit = 50): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users_profile!messages_sender_id_fkey(id, username, display_name, profile_album_cover_url)
      `)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Mark unread messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    return data || [];
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
}

export async function getUnreadMessagesCount(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function sendMessage(receiverId: string, text?: string, track?: any, imageUrl?: string, storyId?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const messageData: any = {
      sender_id: user.id,
      receiver_id: receiverId,
      text: text || null,
      image_url: imageUrl || null,
    };

    // If linking to a story (like/comment)
    if (storyId) {
      messageData.story_id = storyId;
    }

    // If sending a track
    if (track) {
      messageData.track_name = track.name || track.track_name;
      messageData.artist = track.artist;
      messageData.cover_url = track.cover || track.cover_url || track.coverUrl;
      messageData.track_id = track.id || track.track_id;
      messageData.spotify_url = track.spotify_url || track.spotifyUrl;
      messageData.spotify_embed_url = track.id ? `https://open.spotify.com/embed/track/${track.id}` : null;

      // Fetch Odesli links if we have a spotify URL
      if (messageData.spotify_url) {
        const odesliLinks = await getOdesliLinks(messageData.spotify_url);
        Object.assign(messageData, odesliLinks);
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw error;

    // Create notification
    await supabase
      .from('notifications')
      .insert([{
        user_id: receiverId,
        from_user_id: user.id,
        type: track ? 'song_share' : 'message',
      }]);

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

// ==================== MUSIC REACTIONS ====================

export async function addMusicReaction(postId: string, track: any, text?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const reactionData: any = {
      user_id: user.id,
      post_id: postId,
      track_name: track.name || track.track_name,
      artist: track.artist,
      cover_url: track.cover || track.cover_url || track.coverUrl,
      track_id: track.id || track.track_id,
      spotify_url: track.spotify_url || track.spotifyUrl,
      spotify_embed_url: track.id ? `https://open.spotify.com/embed/track/${track.id}` : null,
      text: text || null,
    };

    // Fetch Odesli links
    if (reactionData.spotify_url) {
      const odesliLinks = await getOdesliLinks(reactionData.spotify_url);
      Object.assign(reactionData, odesliLinks);
    }

    const { data, error } = await supabase
      .from('music_reactions')
      .insert([reactionData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error adding music reaction:', error);
    return { success: false, error: error.message };
  }
}

export async function getMusicReactions(postId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('music_reactions')
      .select(`
        *,
        user:users_profile(id, username, display_name, profile_album_cover_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting music reactions:', error);
    return [];
  }
}

// ==================== TOP PERSONNALISÉ (Friends Trending) ====================

export async function getFriendsTrending(days = 7, limit = 20): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Get friend IDs
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const friendIds = follows ? [...follows.map(f => f.following_id), user.id] : [user.id];

    // Get posts from friends in the last N days
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(id, username, display_name, profile_album_cover_url)
      `)
      .in('user_id', friendIds)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by track (track_name + artist), count shares
    const trackMap = new Map();
    (posts || []).forEach((post: any) => {
      const key = `${post.track_name}-${post.artist}`.toLowerCase();
      if (!trackMap.has(key)) {
        trackMap.set(key, {
          track_name: post.track_name,
          artist: post.artist,
          cover_url: post.cover_url,
          track_id: post.track_id,
          spotify_url: post.spotify_url,
          share_count: 0,
          sharers: [],
          latest_post: post,
        });
      }
      const entry = trackMap.get(key);
      entry.share_count++;
      if (!entry.sharers.find((s: any) => s.id === post.user?.id)) {
        entry.sharers.push(post.user);
      }
    });

    return Array.from(trackMap.values())
      .sort((a, b) => b.share_count - a.share_count)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting friends trending:', error);
    return [];
  }
}

// ==================== TASTE MATCH ====================

export async function calculateTasteMatch(otherUserId: string): Promise<{ percent: number; commonArtists: string[] }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { percent: 0, commonArtists: [] };

    // Get recent posts from both users
    const [myPosts, theirPosts] = await Promise.all([
      getUserPosts(user.id, 100),
      getUserPosts(otherUserId, 100)
    ]);

    // Extract artists
    const myArtists = new Set(myPosts.map((p: any) => p.artist?.toLowerCase()).filter(Boolean));
    const theirArtists = new Set(theirPosts.map((p: any) => p.artist?.toLowerCase()).filter(Boolean));

    // Intersection
    const common = [...myArtists].filter(a => theirArtists.has(a));
    const union = new Set([...myArtists, ...theirArtists]);

    const percent = union.size > 0 ? Math.round((common.length / union.size) * 100) : 0;

    // Cache the result
    const [idA, idB] = [user.id, otherUserId].sort();
    await supabase
      .from('taste_match_cache')
      .upsert({
        user_a_id: idA,
        user_b_id: idB,
        match_percent: percent,
        common_artists: common,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'user_a_id,user_b_id' });

    return { percent, commonArtists: common };
  } catch (error) {
    console.error('Error calculating taste match:', error);
    return { percent: 0, commonArtists: [] };
  }
}

export async function getCachedTasteMatch(otherUserId: string): Promise<{ percent: number; commonArtists: string[] } | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const [idA, idB] = [user.id, otherUserId].sort();
    const { data } = await supabase
      .from('taste_match_cache')
      .select('*')
      .eq('user_a_id', idA)
      .eq('user_b_id', idB)
      .maybeSingle();

    if (!data) return null;

    // Check if cache is older than 7 days
    const cacheAge = Date.now() - new Date(data.calculated_at).getTime();
    if (cacheAge > 7 * 24 * 60 * 60 * 1000) return null;

    return { percent: data.match_percent, commonArtists: data.common_artists || [] };
  } catch (error) {
    return null;
  }
}

// ==================== CIRCLES ====================

export async function createCircle(name: string): Promise<any> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('circles')
      .insert([{ name, created_by: user.id, invite_code: inviteCode }])
      .select('*')
      .single();

    if (error) {
      console.error('Circle insert error:', error);
      throw error;
    }

    // Add creator as member
    const { error: memberError } = await supabase
      .from('circle_members')
      .insert([{ circle_id: data.id, user_id: user.id }]);

    if (memberError) {
      console.error('Circle member insert error:', memberError);
      // Don't throw — the circle was created, member insert can fail due to RLS
    }

    // Send notification (circle created)
    try {
      await supabase.from('notifications').insert([{
        user_id: user.id, from_user_id: user.id, type: 'circle_create'
      }]);
    } catch {}

    return { success: true, data: { ...data, invite_code: data.invite_code || inviteCode } };
  } catch (error: any) {
    console.error('Error creating circle:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserCircles(): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('circle_members')
      .select(`
        circle:circles(
          id, name, created_by, invite_code, created_at, photo_url
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('getUserCircles error:', error);
      throw error;
    }
    return (data || []).map((item: any) => item.circle).filter(Boolean);
  } catch (error) {
    console.error('Error getting user circles:', error);
    return [];
  }
}

export async function getCircleById(circleId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('circles')
      .select('id, name, created_by, invite_code, created_at, photo_url')
      .eq('id', circleId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting circle by id:', error);
    return null;
  }
}

export async function getCircleMembers(circleId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('circle_members')
      .select(`
        user:users_profile(id, username, display_name, profile_album_cover_url)
      `)
      .eq('circle_id', circleId);

    if (error) throw error;
    return (data || []).map((item: any) => item.user).filter(Boolean);
  } catch (error) {
    console.error('Error getting circle members:', error);
    return [];
  }
}

export async function addCircleMember(circleId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('circle_members')
      .insert([{ circle_id: circleId, user_id: userId }]);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function removeCircleMember(circleId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCircleName(circleId: string, newName: string) {
  try {
    const { error } = await supabase
      .from('circles')
      .update({ name: newName })
      .eq('id', circleId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCirclePhoto(circleId: string, photoUrl: string) {
  try {
    const { error } = await supabase
      .from('circles')
      .update({ photo_url: photoUrl })
      .eq('id', circleId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== CIRCLE MESSAGES ====================

export async function getCircleMessages(circleId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('circle_messages')
      .select(`
        *,
        user:users_profile!circle_messages_sender_id_fkey(id, username, display_name, color, profile_album_cover_url, profile_color)
      `)
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('getCircleMessages error:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error getting circle messages:', error);
    return [];
  }
}

export async function sendCircleMessage(circleId: string, text?: string, track?: any, imageUrl?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const msgData: any = {
      circle_id: circleId,
      sender_id: user.id,
      text: text || null,
      image_url: imageUrl || null,
    };

    if (track) {
      msgData.track_name = track.name || track.track_name;
      msgData.artist = track.artist;
      msgData.cover_url = track.cover || track.cover_url || track.coverUrl;
      msgData.track_id = track.id || track.track_id;
      msgData.spotify_url = track.spotify_url || track.spotifyUrl;
      msgData.spotify_embed_url = track.id ? `https://open.spotify.com/embed/track/${track.id}` : null;
    }

    const { data, error } = await supabase
      .from('circle_messages')
      .insert([msgData])
      .select()
      .single();

    if (error) throw error;

    // Notify circle members
    if (data) {
      try {
        const { data: members } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circleId)
          .neq('user_id', user.id);
        if (members && members.length > 0) {
          await supabase.from('notifications').insert(
            members.map((m: any) => ({ user_id: m.user_id, from_user_id: user.id, type: 'circle_post' }))
          );
        }
      } catch {}
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending circle message:', error);
    return { success: false, error: error.message };
  }
}

// Keep getCircleFeed as alias for backward compatibility
export async function getCircleFeed(circleId: string, limit = 50) {
  return getCircleMessages(circleId, limit);
}

export async function joinCircleByCode(inviteCode: string): Promise<any> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Find circle by invite code
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id, name, created_by')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle();

    if (circleError) throw circleError;
    if (!circle) throw new Error('Cercle non trouvé');

    // Check if already member
    const { data: existing } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) throw new Error('Déjà membre de ce cercle');

    // Add as member
    const { error: memberError } = await supabase
      .from('circle_members')
      .insert([{ circle_id: circle.id, user_id: user.id }]);

    if (memberError) throw memberError;

    // Notify circle creator
    try {
      await supabase.from('notifications').insert([{
        user_id: circle.created_by, from_user_id: user.id, type: 'circle_join'
      }]);
    } catch {}

    return { success: true, data: circle };
  } catch (error: any) {
    console.error('Error joining circle by code:', error);
    return { success: false, error: error.message };
  }
}

export async function searchCircles(query: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('circles')
      .select('*')
      .or(`name.ilike.%${query}%,invite_code.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching circles:', error);
    return [];
  }
}

export async function joinCircle(circleId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    // Check not already member
    const { data: existing } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return { success: true };
    
    const { error } = await supabase.from('circle_members').insert([{ circle_id: circleId, user_id: user.id }]);
    if (error) throw error;
    
    // Notify circle creator
    try {
      const { data: circle } = await supabase.from('circles').select('created_by').eq('id', circleId).single();
      if (circle && circle.created_by !== user.id) {
        await supabase.from('notifications').insert([{ user_id: circle.created_by, from_user_id: user.id, type: 'circle_join' }]);
      }
    } catch {}
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== STORIES ====================

export async function createStory(payload: {
  imageUrl?: string | null;
  track?: any;
  text?: string;
  themeColor?: string;
  durationDays: 1 | 7 | 30;
  publishAsShake?: boolean;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const track = payload.track || null;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + payload.durationDays);

    const storyData: any = {
      user_id: user.id,
      image_url: payload.imageUrl || null,
      track_name: track?.name || track?.track_name || null,
      artist: track?.artist || null,
      cover_url: track?.cover || track?.cover_url || track?.coverUrl || null,
      track_id: track?.id || track?.track_id || null,
      spotify_url: track?.spotify_url || track?.spotifyUrl || null,
      spotify_embed_url: (track?.id || track?.track_id)
        ? `https://open.spotify.com/embed/track/${track.id || track.track_id}`
        : null,
      text: payload.text || null,
      theme_color: payload.themeColor || '#1D0F3D',
      duration_days: payload.durationDays,
      expires_at: expiresAt.toISOString(),
    };

    const { data, error } = await supabase
      .from('stories')
      .insert([storyData])
      .select()
      .single();

    if (error) throw error;

    if (payload.publishAsShake && data) {
      await createPost(
        storyData.track_name || '',
        storyData.artist || '',
        storyData.cover_url || '',
        storyData.text || '',
        null,
        storyData.spotify_url || null,
        storyData.track_id || null,
        false,
        null,
        storyData.image_url || null
      );
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating story:', error);
    return { success: false, error: error.message };
  }
}

export async function getFeedStories(): Promise<Story[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = follows ? follows.map((f: any) => f.following_id) : [];
    const ids = [user.id, ...followingIds];

    const { data, error } = await supabase
      .from('stories')
      .select(`
        *,
        user:users_profile!stories_user_id_fkey(id, username, display_name, profile_album_cover_url, profile_color)
      `)
      .in('user_id', ids)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting feed stories:', error);
    return [];
  }
}

export async function getUserActiveStories(userId: string): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user stories:', error);
    return [];
  }
}

export async function hasViewedStory(storyId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data } = await supabase
      .from('story_views')
      .select('id')
      .eq('story_id', storyId)
      .eq('viewer_id', user.id)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

export async function markStoryAsViewed(storyId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase
      .from('story_views')
      .insert([{ story_id: storyId, viewer_id: user.id }]);
  } catch {}
}

// ==================== CIRCLE WEEKLY SHAKES (mini-game data) ====================

export async function getCircleWeeklyShakes(circleId: string): Promise<any[]> {
  // Get all shake_du_jour from circle members this week
  try {
    const weekStart = getCurrentShakeWeekStart();

    // Get circle member IDs
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId);

    if (!members || members.length === 0) return [];
    const memberIds = members.map(m => m.user_id);

    const { data, error } = await supabase
      .from('shake_du_jour')
      .select(`
        *,
        user:users_profile!shake_du_jour_user_id_fkey(id, username, display_name, profile_album_cover_url),
        post:posts!shake_du_jour_post_id_fkey(*)
      `)
      .in('user_id', memberIds)
      .gte('created_date', weekStart)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting circle weekly shakes:', error);
    return [];
  }
}

// ==================== CIRCLE MESSAGE LIKES ====================

export async function likeCircleMessage(messageId: string, emoji = '❤️') {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data: likeData, error: likeError } = await supabase
      .from('circle_message_likes')
      .insert([{
        message_id: messageId,
        user_id: user.id,
        emoji: emoji
      }])
      .select();

    if (likeError) throw likeError;

    // Increment likes_count via RPC
    const { error: rpcError } = await supabase.rpc('increment_circle_message_likes', {
      message_id: messageId
    });

    if (rpcError) {
      console.warn('Warning: RPC increment failed:', rpcError);
    }

    return { success: true, data: likeData };
  } catch (error: any) {
    console.error('Error liking circle message:', error);
    return { success: false, error: error.message };
  }
}

export async function unlikeCircleMessage(messageId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error: deleteError } = await supabase
      .from('circle_message_likes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    // Decrement likes_count via RPC
    const { error: rpcError } = await supabase.rpc('decrement_circle_message_likes', {
      message_id: messageId
    });

    if (rpcError) {
      console.warn('Warning: RPC decrement failed:', rpcError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error unliking circle message:', error);
    return { success: false, error: error.message };
  }
}

export async function hasLikedCircleMessage(messageId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('circle_message_likes')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking circle message like status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasLikedCircleMessage:', error);
    return false;
  }
}

export async function getCircleMessageLikes(messageId: string) {
  try {
    const { data, error } = await supabase
      .rpc('get_circle_message_likers', { message_id: messageId });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting circle message likes:', error);
    return [];
  }
}

export async function hasLikedCircleMessages(messageIds: string[]): Promise<Record<string, boolean>> {
  try {
    if (messageIds.length === 0) return {};
    const user = await getCurrentUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('circle_message_likes')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    if (error) {
      console.error('Error batch checking circle message likes:', error);
      return {};
    }

    const likedSet = new Set((data || []).map((d: any) => d.message_id));
    const result: Record<string, boolean> = {};
    for (const id of messageIds) result[id] = likedSet.has(id);
    return result;
  } catch (error) {
    console.error('Error in hasLikedCircleMessages:', error);
    return {};
  }
}

// ==================== APP STATS ====================
export async function getAppStats(): Promise<{ users: number; shakes: number; likes: number }> {
  try {
    const [usersRes, shakesRes, likesRes] = await Promise.all([
      supabase.from('users_profile').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('likes').select('id', { count: 'exact', head: true }),
    ]);
    return {
      users: usersRes.count ?? 0,
      shakes: shakesRes.count ?? 0,
      likes: likesRes.count ?? 0,
    };
  } catch {
    return { users: 0, shakes: 0, likes: 0 };
  }
}

// Send song to friend (notification)
export async function sendSongNotification(recipientId: string, track: any) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Create notification
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: recipientId,
        from_user_id: user.id,
        type: 'song_share',
        post_id: null,
      }]);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error sending song notification:', error);
    return { success: false, error: error.message };
  }
}

// ==================== MESSAGE LIKES ====================

export async function likeMessage(messageId: string, emoji = '❤️') {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('message_likes')
      .insert([{ message_id: messageId, user_id: user.id, emoji }])
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error liking message:', error);
    return { success: false, error: error.message };
  }
}

export async function unlikeMessage(messageId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('message_likes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error unliking message:', error);
    return { success: false, error: error.message };
  }
}

export async function hasLikedMessage(messageId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('message_likes')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch {
    return false;
  }
}

export async function getMessageLikes(messageId: string) {
  try {
    const { data, error } = await supabase
      .from('message_likes')
      .select(`
        *,
        user:users_profile(id, username, display_name, profile_album_cover_url)
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// ==================== STORY LIKES & COMMENTS ====================

export async function likeStory(storyId: string, emoji = '❤️') {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data: likeData, error: likeError } = await supabase
      .from('story_likes')
      .insert([{
        story_id: storyId,
        user_id: user.id,
        emoji: emoji
      }])
      .select();

    if (likeError) throw likeError;

    // Increment likes_count via RPC
    const { error: rpcError } = await supabase.rpc('increment_story_likes', {
      story_id: storyId
    });

    if (rpcError) {
      console.warn('Warning: RPC increment failed:', rpcError);
    }

    // Notify story author - send message with story_id for UI preview
    try {
      const { data: story } = await supabase
        .from('stories')
        .select('user_id')
        .eq('id', storyId)
        .single();
      if (story && story.user_id !== user.id) {
        // Send message linked to story (UI will show as "liked your story" with preview)
        await sendMessage(story.user_id, null, undefined, undefined, storyId);
        
        // Also add notification
        await supabase.from('notifications').insert([{
          user_id: story.user_id,
          from_user_id: user.id,
          type: 'story_like',
        }]);
      }
    } catch {}

    return { success: true, data: likeData };
  } catch (error: any) {
    console.error('Error liking story:', error);
    return { success: false, error: error.message };
  }
}

export async function unlikeStory(storyId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error: deleteError } = await supabase
      .from('story_likes')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    // Decrement likes_count via RPC
    const { error: rpcError } = await supabase.rpc('decrement_story_likes', {
      story_id: storyId
    });

    if (rpcError) {
      console.warn('Warning: RPC decrement failed:', rpcError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error unliking story:', error);
    return { success: false, error: error.message };
  }
}

export async function hasLikedStory(storyId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('story_likes')
      .select('id')
      .eq('story_id', storyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking story like status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in hasLikedStory:', error);
    return false;
  }
}

export async function getStoryLikes(storyId: string) {
  try {
    const { data, error } = await supabase
      .from('story_likes')
      .select(`
        *,
        user:users_profile(id, username, display_name, profile_album_cover_url)
      `)
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting story likes:', error);
    return [];
  }
}

export async function commentOnStory(storyId: string, commentText: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Get story author
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .single();

    if (storyError) throw storyError;
    if (!story || story.user_id === user.id) {
      throw new Error('Cannot comment on own story or story not found');
    }

    const storyAuthorId = story.user_id;

    // Get story info for message context
    const { data: storyData } = await supabase
      .from('stories')
      .select('track_name, artist, text')
      .eq('id', storyId)
      .single();

    // Build comment message with context
    const storyContext = storyData?.track_name 
      ? `${storyData.track_name} by ${storyData.artist}`
      : storyData?.text || 'votre shake ephemere';
    
    const fullMessage = `💭 Commentaire sur ${storyContext}:\n${commentText}`;

    // Send as private message to story author with story_id for preview
    const result = await sendMessage(storyAuthorId, fullMessage, undefined, undefined, storyId);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Also create a dedicated story_comment notification
    await supabase.from('notifications').insert([{
      user_id: storyAuthorId,
      from_user_id: user.id,
      type: 'story_comment',
    }]);

    return { success: true };
  } catch (error: any) {
    console.error('Error commenting on story:', error);
    return { success: false, error: error.message };
  }
}
