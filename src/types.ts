export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  preferences?: {
    defaultEngine?: 'gemini' | 'openai';
    theme?: 'light' | 'dark' | 'system';
  };
}

export interface UserStats {
  searchesCount: number;
  bookmarksCount: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
  snippet?: string;
}

export interface SearchResult {
  engine: 'gemini' | 'openai';
  model: string;
  query: string;
  text: string;
  sources: GroundingSource[];
  searchQueries: string[];
  suggestedFollowUps: string[];
  executionTimeMs: number;
  groundingType?: 'google-search' | 'live-web';
  historyId?: string;
  savedToAccount?: boolean;
}

export interface HistoryItem {
  id: string;
  userId?: string;
  query: string;
  engine: 'gemini' | 'openai';
  timestamp: string;
  summaryPreview: string;
  sourcesCount: number;
  sources: GroundingSource[];
  images?: Array<{ title: string; url: string; source: string }>;
}

export interface BookmarkItem {
  id: string;
  userId: string;
  query: string;
  title: string;
  summary: string;
  engine: 'gemini' | 'openai';
  sources: GroundingSource[];
  savedAt: string;
  images?: Array<{ title: string; url: string; source: string }>;
}

export interface ApiStatus {
  status: string;
  services: {
    gemini: {
      configured: boolean;
      defaultModel: string;
      features: string[];
    };
    openai: {
      configured: boolean;
      defaultModel: string;
      quotaExhausted?: boolean;
    };
  };
  system: {
    uptimeSeconds: number;
    usersRegistered: number;
    historyItemsStored: number;
  };
}
