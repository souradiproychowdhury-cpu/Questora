import { User, UserStats, SearchResult, HistoryItem, BookmarkItem, ApiStatus } from '../types';

const TOKEN_KEY = 'auth_token';

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

function getAuthHeaders(): Record<string, string> {
  const token = tokenStorage.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Status
  async getStatus(): Promise<ApiStatus> {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Failed to load system status');
    return res.json();
  },

  // Auth
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create account');
    }
    tokenStorage.set(data.token);
    return data;
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign in');
    }
    tokenStorage.set(data.token);
    return data;
  },

  async getMe(): Promise<{ user: User; stats: UserStats }> {
    const res = await fetch('/api/auth/me', {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) {
      tokenStorage.clear();
      throw new Error('Session invalid');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
    } finally {
      tokenStorage.clear();
    }
  },

  // Search
  async search(params: {
    query: string;
    engine?: 'gemini' | 'openai';
    mode?: 'comprehensive' | 'concise' | 'news';
    filterType?: string;
  }): Promise<SearchResult> {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Search failed');
    }
    return data;
  },

  // History
  async getHistory(): Promise<HistoryItem[]> {
    const res = await fetch('/api/history', {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to load history');
    const data = await res.json();
    return data.history || [];
  },

  async deleteHistoryItem(id: string): Promise<void> {
    const res = await fetch(`/api/history/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete history item');
  },

  async clearHistory(): Promise<void> {
    const res = await fetch('/api/history', {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to clear history');
  },

  // Bookmarks
  async getBookmarks(): Promise<BookmarkItem[]> {
    const res = await fetch('/api/bookmarks', {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to load bookmarks');
    const data = await res.json();
    return data.bookmarks || [];
  },

  async addBookmark(payload: {
    query: string;
    title: string;
    summary: string;
    engine: 'gemini' | 'openai';
    sources: Array<{ title: string; uri: string }>;
  }): Promise<BookmarkItem> {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save bookmark');
    return data.bookmark;
  },

  async deleteBookmark(id: string): Promise<void> {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete bookmark');
  },
};
