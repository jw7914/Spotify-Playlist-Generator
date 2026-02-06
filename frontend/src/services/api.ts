
const BASE_URL = "/api";

export interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  type?: "text" | "playlist-preview";
  playlistData?: any;
}

export interface BackendHistoryItem {
  role: "user" | "model";
  parts: string[];
}

export interface GeminiChatResponse {
  text: string;
  playlist_id?: string;
  history: BackendHistoryItem[];
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
    createSession: () => fetchJson(`${BASE_URL}/gemini/agent-session`),
    chat: (message: string, history: BackendHistoryItem[]) => 
      fetchJson<GeminiChatResponse>(`${BASE_URL}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
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
    
    getRecentlyPlayed: (limit: number = 10) => {
        return fetchJson<{ items: any[] }>(`${BASE_URL}/spotify/recently-played?limit=${limit}`);
    },

    getCurrentlyPlaying: () => {
        return fetchJson<{ is_playing: boolean; item?: any }>(`${BASE_URL}/spotify/currently-playing`);
    },

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
  }
};
