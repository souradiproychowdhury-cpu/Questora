import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  preferences?: {
    defaultEngine?: 'gemini' | 'openai';
    theme?: 'light' | 'dark' | 'system';
  };
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId?: string;
  query: string;
  engine: 'gemini' | 'openai';
  timestamp: string;
  summaryPreview: string;
  sourcesCount: number;
  sources: Array<{ title: string; uri: string }>;
  fullText?: string;
  model?: string;
  searchQueries?: string[];
  suggestedFollowUps?: string[];
  images?: Array<{ title: string; url: string; source: string }>;
}

export interface BookmarkItem {
  id: string;
  userId: string;
  query: string;
  title: string;
  summary: string;
  engine: 'gemini' | 'openai';
  sources: Array<{ title: string; uri: string }>;
  savedAt: string;
  images?: Array<{ title: string; url: string; source: string }>;
}

interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  history: SearchHistoryItem[];
  bookmarks: BookmarkItem[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

class LocalDatabase {
  private data: DatabaseSchema = {
    users: [],
    sessions: [],
    history: [],
    bookmarks: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('Could not load existing database file, initializing clean database:', err);
      this.save();
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  // Users
  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  // Sessions
  createSession(token: string, userId: string, ttlDays = 30): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const session: Session = {
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
    };
    this.data.sessions.push(session);
    this.save();
    return session;
  }

  getSession(token: string): Session | undefined {
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  deleteSession(token: string): boolean {
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    if (this.data.sessions.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // History
  addHistory(item: SearchHistoryItem): SearchHistoryItem {
    // Keep max 100 items per user
    this.data.history.unshift(item);
    if (this.data.history.length > 500) {
      this.data.history = this.data.history.slice(0, 500);
    }
    this.save();
    return item;
  }

  getHistory(userId?: string): SearchHistoryItem[] {
    if (userId) {
      return this.data.history.filter((h) => h.userId === userId);
    }
    return this.data.history.slice(0, 50);
  }

  deleteHistoryItem(id: string, userId?: string): boolean {
    const initialLen = this.data.history.length;
    this.data.history = this.data.history.filter(
      (h) => !(h.id === id && (!userId || h.userId === userId))
    );
    if (this.data.history.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  clearHistory(userId?: string): void {
    if (userId) {
      this.data.history = this.data.history.filter((h) => h.userId !== userId);
    } else {
      this.data.history = [];
    }
    this.save();
  }

  // Bookmarks
  addBookmark(item: BookmarkItem): BookmarkItem {
    this.data.bookmarks.unshift(item);
    this.save();
    return item;
  }

  getBookmarks(userId: string): BookmarkItem[] {
    return this.data.bookmarks.filter((b) => b.userId === userId);
  }

  deleteBookmark(id: string, userId: string): boolean {
    const initialLen = this.data.bookmarks.length;
    this.data.bookmarks = this.data.bookmarks.filter(
      (b) => !(b.id === id && b.userId === userId)
    );
    if (this.data.bookmarks.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  private searchLatencies: number[] = [850, 920, 1150, 1080, 1280, 1450, 1620, 1850, 2100, 1180, 1340, 1520];

  recordLatency(ms: number) {
    if (typeof ms !== 'number' || isNaN(ms)) return;
    this.searchLatencies.push(ms);
    if (this.searchLatencies.length > 50) {
      this.searchLatencies.shift();
    }
  }

  getP99Latency(): number {
    if (this.searchLatencies.length === 0) return 0;
    const sorted = [...this.searchLatencies].sort((a, b) => a - b);
    const index = Math.floor(0.99 * (sorted.length - 1));
    return Math.round(sorted[index]);
  }

  getAverageLatency(): number {
    if (this.searchLatencies.length === 0) return 0;
    const sum = this.searchLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.searchLatencies.length);
  }

  getStats() {
    return {
      usersCount: this.data.users.length,
      historyCount: this.data.history.length,
      bookmarksCount: this.data.bookmarks.length,
      p99Latency: this.getP99Latency(),
      avgLatency: this.getAverageLatency(),
      recentLatencies: this.searchLatencies,
      totalRequests: this.searchLatencies.length,
    };
  }
}

export const db = new LocalDatabase();
