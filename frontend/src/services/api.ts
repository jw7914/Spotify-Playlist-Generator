
const BASE_URL = "/api";

export interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  type?: "text" | "playlist-preview";
  playlistData?: any;
  isAwaitingConfirmation?: boolean;
  pendingPlaylist?: any;
}

export interface BackendHistoryItem {
  role: "user" | "model";
  parts: string[];
}

export interface GeminiChatResponse {
  text: string;
  playlist_id?: string;
  history: BackendHistoryItem[];
  is_awaiting_confirmation?: boolean;
  pending_playlist?: any;
}

// --- Generic Helper ---
export class AuthError extends Error {
  constructor(message?: string) {
    super(message || "Authentication required");
    this.name = "AuthError";
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  // Handle manual redirect (opaque or explicit 3xx) which implies Auth redirect in this app
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new AuthError("Redirected to auth");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthError();
    }

    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) errorMessage = errorData.detail;
      else if (errorData.message) errorMessage = errorData.message;
    } catch (e) {
      // Ignore json parse error for error response
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  gemini: {
    createSession: (userId: string, title?: string) => 
      fetchJson<{ id: string; title: string; updated_at: string }>(`${BASE_URL}/gemini/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, title }),
      }),

    getSessions: (userId: string) => 
      fetchJson<{ id: string; title: string; updated_at: string }[]>(`${BASE_URL}/gemini/sessions?user_id=${userId}`),

    getSessionMessages: (sessionId: string) =>
      fetchJson<{ messages: { id: string; role: string; content: string; created_at: string }[], is_awaiting_confirmation?: boolean, pending_playlist?: any }>(`${BASE_URL}/gemini/sessions/${sessionId}/messages`),

    deleteSession: (sessionId: string) =>
      fetchJson(`${BASE_URL}/gemini/sessions/${sessionId}`, {
        method: "DELETE",
      }),

    chat: (message: string, history: BackendHistoryItem[], sessionId?: string, pendingPlaylistOverride?: any) => 
      fetchJson<GeminiChatResponse>(`${BASE_URL}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, session_id: sessionId, pending_playlist_override: pendingPlaylistOverride }),
      }),
  },
  spotify: {
    getPlaylists: () => fetchJson<{ playlists: any[] }>(`${BASE_URL}/spotify/playlists`, { redirect: "manual" }),
    createPlaylist: (name: string, description?: string, publicPlaylist?: boolean) => {
        return fetchJson<any>(`${BASE_URL}/spotify/playlists`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description, public: publicPlaylist }),
            redirect: "manual"
        });
    },

    deletePlaylist: (playlistId: string) => {
        return fetchJson<any>(`${BASE_URL}/spotify/playlists/${playlistId}`, {
            method: "DELETE",
            redirect: "manual"
        });
    },
    getPlaylist: (id: string) => fetchJson<any>(`${BASE_URL}/spotify/playlists/${id}`),
    
    // time_range: "short_term" | "medium_term" | "long_term"
    // limit: default 20
    getTopArtists: (timeRange: string = "medium_term", limit: number | string = 20) => {
        const params = new URLSearchParams({ time_range: timeRange, limit: String(limit) });
        return fetchJson<{ artists: any[] }>(`${BASE_URL}/spotify/top-artists?${params.toString()}`, { redirect: "manual" });
    },

    getTopTracks: (timeRange: string = "medium_term", limit: number | string = 20) => {
        const params = new URLSearchParams({ time_range: timeRange, limit: String(limit) });
        return fetchJson<{ tracks: any[] }>(`${BASE_URL}/spotify/top-tracks?${params.toString()}`, { redirect: "manual" });
    },

    getRecommendations: (limit: number | string = 12) => {
        const params = new URLSearchParams({ limit: String(limit) });
        return fetchJson<{ tracks: any[], seed_summary?: { track_count: number; artist_count: number } }>(`${BASE_URL}/spotify/recommendations?${params.toString()}`, { redirect: "manual" });
    },

    getAudioFeatures: (ids: string[]) => {
        const params = new URLSearchParams({ ids: ids.join(",") });
        return fetchJson<{ audio_features: any[] }>(`${BASE_URL}/spotify/audio-features?${params.toString()}`);
    },

    getRelatedArtists: (artistId: string) =>
        fetchJson<{ artists: any[] }>(`${BASE_URL}/spotify/artists/${artistId}/related-artists`),

    getArtistTopTracks: (artistId: string, market: string = "US") => {
        const params = new URLSearchParams({ market });
        return fetchJson<{ tracks: any[] }>(`${BASE_URL}/spotify/artists/${artistId}/top-tracks?${params.toString()}`);
    },

    getAlbum: (albumId: string) => fetchJson<any>(`${BASE_URL}/spotify/albums/${albumId}`),

    getAlbumTracks: (albumId: string, limit: number = 50, offset: number = 0) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/albums/${albumId}/tracks?${params.toString()}`);
    },

    getSavedTracks: (limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/me/tracks?${params.toString()}`, { redirect: "manual" });
    },

    saveTracks: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/tracks`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    removeSavedTracks: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/tracks`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    getSavedAlbums: (limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/me/albums?${params.toString()}`, { redirect: "manual" });
    },

    saveAlbums: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/albums`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    removeSavedAlbums: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/albums`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    getFollowedArtists: (limit: number = 20, after?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (after) params.set("after", after);
        return fetchJson<{ artists: any[]; cursors: any }>(`${BASE_URL}/spotify/me/following?${params.toString()}`, { redirect: "manual" });
    },

    followArtists: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/following`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    unfollowArtists: (ids: string[]) =>
        fetchJson(`${BASE_URL}/spotify/me/following`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            redirect: "manual"
        }),

    getAvailableGenreSeeds: () =>
        fetchJson<{ genres: string[] }>(`${BASE_URL}/spotify/recommendations/available-genre-seeds`),

    updatePlaylist: (playlistId: string, updates: { name?: string; description?: string; public?: boolean }) =>
        fetchJson(`${BASE_URL}/spotify/playlists/${playlistId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
            redirect: "manual"
        }),

    setPlaylistImage: (playlistId: string, imageBase64: string) =>
        fetchJson(`${BASE_URL}/spotify/playlists/${playlistId}/image`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_base64: imageBase64 }),
            redirect: "manual"
        }),

    getBrowseCategories: (country: string = "US", limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ country, limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/browse/categories?${params.toString()}`);
    },

    getFeaturedPlaylists: (country: string = "US", limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ country, limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number; message?: string }>(`${BASE_URL}/spotify/browse/featured-playlists?${params.toString()}`);
    },

    getCategoryPlaylists: (categoryId: string, country: string = "US", limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ country, limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/browse/categories/${categoryId}/playlists?${params.toString()}`);
    },

    getNewReleases: (country: string = "US", limit: number = 20, offset: number = 0) => {
        const params = new URLSearchParams({ country, limit: String(limit), offset: String(offset) });
        return fetchJson<{ items: any[]; total: number }>(`${BASE_URL}/spotify/browse/new-releases?${params.toString()}`);
    },
    
    getRecentlyPlayed: (limit: number = 10) => {
        return fetchJson<{ items: any[] }>(`${BASE_URL}/spotify/recently-played?limit=${limit}`);
    },

    getCurrentlyPlaying: () => {
        return fetchJson<{ is_playing: boolean; item?: any }>(`${BASE_URL}/spotify/currently-playing`);
    },

    getQueue: () => {
        return fetchJson<{ queue: any[], currently_playing: any }>(`${BASE_URL}/spotify/player/queue`);
    },

    getDevices: () => fetchJson<{ devices: any[] }>(`${BASE_URL}/spotify/player/devices`, { redirect: "manual" }),

    transferPlayback: (deviceId: string, play: boolean = false) =>
        fetchJson(`${BASE_URL}/spotify/player/transfer`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_id: deviceId, play }),
            redirect: "manual"
        }),

    addToQueue: (uri: string, deviceId?: string) =>
        fetchJson(`${BASE_URL}/spotify/player/queue/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uri, device_id: deviceId }),
            redirect: "manual"
        }),

    play: () => fetchJson(`${BASE_URL}/spotify/player/play`, { method: "PUT" }),
    pause: () => fetchJson(`${BASE_URL}/spotify/player/pause`, { method: "PUT" }),
    next: () => fetchJson(`${BASE_URL}/spotify/player/next`, { method: "POST" }),
    previous: () => fetchJson(`${BASE_URL}/spotify/player/previous`, { method: "POST" }),
    
    getMe: () => fetchJson<any>(`${BASE_URL}/spotify/me`),
    
    // type: "track" | "artist" | "album" | "playlist"
    search: (query: string, type: string = "track", limit: number = 20) => {
        const params = new URLSearchParams({ q: query, type, limit: String(limit) });
        return fetchJson<any>(`${BASE_URL}/spotify/search?${params.toString()}`);
    },

    addTracksToPlaylist: (playlistId: string, uris: string[]) => {
        return fetchJson<any>(`${BASE_URL}/spotify/playlists/${playlistId}/tracks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uris }),
            redirect: "manual"
        });
    },

    removeTracksFromPlaylist: (playlistId: string, uris: string[]) => {
        return fetchJson<any>(`${BASE_URL}/spotify/playlists/${playlistId}/tracks`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uris }),
            redirect: "manual"
        });
    },
  }
};
