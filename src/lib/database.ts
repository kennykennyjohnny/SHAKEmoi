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
  isPrivate: boolean = false
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
        spotify_embed_url: spotifyEmbedUrl,
        track_id: trackId,
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
        is_private: isPrivate
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
    // Get all posts ordered by likes
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users_profile!posts_user_id_fkey(*)
      `)
      .order('likes_count', { ascending: false })
      .limit(50); // Get more to deduplicate

    if (error) throw error;
    
    // Deduplicate by track_name + artist, keep highest likes
    const uniqueTracks = new Map();
    (data || []).forEach((post: any) => {
      const key = `${post.track_name}-${post.artist}`.toLowerCase();
      const existing = uniqueTracks.get(key);
      if (!existing || (post.likes_count || 0) > (existing.likes_count || 0)) {
        uniqueTracks.set(key, post);
      }
    });
    
    // Convert back to array and limit
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
      post_cover_url: notif.post?.cover_url,
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
    case 'feel': return 't\'a ajouté en ami';
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

export async function sendMessage(receiverId: string, text?: string, track?: any) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const messageData: any = {
      sender_id: user.id,
      receiver_id: receiverId,
      text: text || null,
    };

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

    const { data, error } = await supabase
      .from('circles')
      .insert([{ name, created_by: user.id }])
      .select()
      .single();

    if (error) throw error;

    // Add creator as member
    await supabase
      .from('circle_members')
      .insert([{ circle_id: data.id, user_id: user.id }]);

    return { success: true, data };
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
          id, name, created_by, created_at
        )
      `)
      .eq('user_id', user.id);

    if (error) throw error;
    return (data || []).map((item: any) => item.circle).filter(Boolean);
  } catch (error) {
    console.error('Error getting user circles:', error);
    return [];
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

// ==================== CIRCLE FEED ====================

export async function getCircleFeed(circleId: string, limit = 30): Promise<Post[]> {
  try {
    // Get member IDs
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId);

    if (!members || members.length === 0) return [];
    const memberIds = members.map(m => m.user_id);

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
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return posts || [];
  } catch (error) {
    console.error('Error getting circle feed:', error);
    return [];
  }
}

export async function searchCircles(query: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('circles')
      .select('*')
      .ilike('name', `%${query}%`)
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
    const { error } = await supabase.from('circle_members').insert([{ circle_id: circleId, user_id: user.id }]);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
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
