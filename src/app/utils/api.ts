import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7dbfc935`;

// Get user ID from auth token
const getUserId = () => {
  const authToken = localStorage.getItem('shakemoi_auth_token');
  return authToken || 'guest';
};

const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const userId = getUserId();
  const url = `${API_BASE}${endpoint}`;
  
  console.log(`[API] ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-User-Id': userId,
        ...options.headers,
      },
    });

    console.log(`[API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Error response:`, errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'API request failed' };
      }
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] Success:`, data);
    return data;
  } catch (error) {
    console.error(`[API] Failed to fetch ${url}:`, error);
    throw error;
  }
};

// ===== USER API =====

export const getMe = async () => {
  return fetchAPI('/users/me');
};

export const updateMe = async (updates: any) => {
  return fetchAPI('/users/me', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

// ===== SHAKE API =====

export const getFeed = async () => {
  return fetchAPI('/shakes/feed');
};

export const createShake = async (data: { track: any; caption?: string }) => {
  return fetchAPI('/shakes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const likeShake = async (shakeId: string) => {
  return fetchAPI(`/shakes/${shakeId}/like`, {
    method: 'POST',
  });
};

export const reshakeShake = async (shakeId: string) => {
  return fetchAPI(`/shakes/${shakeId}/reshake`, {
    method: 'POST',
  });
};

export const deleteShake = async (shakeId: string) => {
  return fetchAPI(`/shakes/${shakeId}`, {
    method: 'DELETE',
  });
};

export const getUserShakes = async (userId: string) => {
  return fetchAPI(`/users/${userId}/shakes`);
};

// ===== TRENDING API =====

export const getTrending = async () => {
  return fetchAPI('/trending');
};

// ===== SEARCH API =====

export const search = async (query: string) => {
  return fetchAPI(`/search?q=${encodeURIComponent(query)}`);
};

// ===== NOTIFICATIONS API =====

export const getNotifications = async () => {
  return fetchAPI('/notifications');
};

// Export values for external use
export { projectId, publicAnonKey };