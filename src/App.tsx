import React, { useState, useEffect } from 'react';
import { Sparkles, Globe, Shield, Zap, Search, AlertCircle, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { User, ApiStatus, SearchResult, HistoryItem, BookmarkItem } from './types';
import { api, tokenStorage } from './services/api';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';
import { HistoryDrawer } from './components/HistoryDrawer';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'history' | 'bookmarks'>('history');

  const [currentResult, setCurrentResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  // Initial load
  useEffect(() => {
    loadStatus();
    loadUserData();
    loadHistory();
  }, []);

  const loadStatus = async () => {
    try {
      const status = await api.getStatus();
      setApiStatus(status);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  };

  const loadUserData = async () => {
    if (!tokenStorage.get()) return;
    try {
      const res = await api.getMe();
      setUser(res.user);
      loadBookmarks();
    } catch (err) {
      console.warn('Session expired or invalid:', err);
      setUser(null);
    }
  };

  const loadHistory = async () => {
    try {
      const items = await api.getHistory();
      setHistory(items);
    } catch (err) {
      console.error('Failed to fetch search history:', err);
    }
  };

  const loadBookmarks = async () => {
    try {
      const items = await api.getBookmarks();
      setBookmarks(items);
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    }
  };

  const handleSearch = async (
    query: string,
    options: {
      engine: 'gemini' | 'openai';
      mode: 'comprehensive' | 'concise' | 'news';
      filterType: string;
    }
  ) => {
    setLoading(true);
    setSearchError(null);

    try {
      const result = await api.search({
        query,
        engine: options.engine,
        mode: options.mode,
        filterType: options.filterType,
      });
      setCurrentResult(result);
      // Refresh history list
      loadHistory();
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(err.message || 'An error occurred during search. Please check your query or API configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!currentResult) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      await api.addBookmark({
        query: currentResult.query,
        title: currentResult.query,
        summary: currentResult.text.slice(0, 240).replace(/[#*`]/g, '') + '...',
        engine: currentResult.engine,
        sources: currentResult.sources,
      });
      await loadBookmarks();
    } catch (err: any) {
      alert(err.message || 'Failed to save bookmark');
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await api.deleteHistoryItem(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearHistory();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await api.deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setBookmarks([]);
    loadHistory();
  };

  const isCurrentResultBookmarked = Boolean(
    currentResult && bookmarks.some((b) => b.query.toLowerCase() === currentResult.query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header with Navigation and Auth */}
      <Header
        user={user}
        apiStatus={apiStatus}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onToggleHistory={() => {
          setDrawerTab('history');
          setIsDrawerOpen(true);
        }}
        onToggleBookmarks={() => {
          setDrawerTab('bookmarks');
          setIsDrawerOpen(true);
        }}
        historyCount={history.length}
        bookmarksCount={bookmarks.length}
      />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 flex flex-col items-center">
        {/* Hero Section if no search has taken place yet */}
        {!currentResult && !loading && (
          <div className="w-full max-w-3xl text-center pt-8 pb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/60 px-3.5 py-1 text-xs font-semibold text-indigo-700 mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Google Search Grounding Engine</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
              Real-time Verified Intelligence
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Synthesizing the live web using Google Search grounding and Gemini 3.8 Flash. No outdated assumptions, pure up-to-the-minute facts with transparent source citations.
            </p>

            {/* Feature Badges */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-2.5">
                  <Globe className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Live Grounding</h3>
                <p className="mt-1 text-xs text-slate-500">Every search queries real-time web results via Google Search Grounding.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-2.5">
                  <Shield className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">User Authentication</h3>
                <p className="mt-1 text-xs text-slate-500">Persistent user accounts, secure sessions, and cloud-synced bookmarks.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-2.5">
                  <Zap className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Dual Engine Ready</h3>
                <p className="mt-1 text-xs text-slate-500">Native support for Gemini with optional OpenAI integration.</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Input Bar */}
        <div className="w-full mb-8">
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            apiStatus={apiStatus}
            initialQuery={currentResult?.query || ''}
          />
        </div>

        {/* Error Notice Banner */}
        {searchError && (
          <div className="w-full max-w-3xl mb-8 rounded-2xl border border-red-200 bg-red-50/90 p-5 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-red-900 text-sm mb-1">Search Execution Notice</h4>
                <p className="text-red-700 leading-relaxed">{searchError}</p>
                {searchError.includes('quota') || searchError.includes('Secrets') ? (
                  <div className="mt-3 rounded-lg border border-red-300 bg-white p-3 text-red-800 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <KeyRound className="h-4 w-4 text-red-600" />
                      Configure or select a billing-enabled key in the Secrets panel
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="w-full max-w-4xl space-y-4 animate-pulse">
            <div className="h-16 w-full rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 rounded-xl bg-slate-200" />
              <div className="h-24 rounded-xl bg-slate-200" />
              <div className="h-24 rounded-xl bg-slate-200" />
            </div>
            <div className="h-64 w-full rounded-2xl bg-slate-200" />
          </div>
        )}

        {/* Search Results Display */}
        {currentResult && !loading && (
          <SearchResults
            result={currentResult}
            onBookmark={handleBookmark}
            isBookmarked={isCurrentResultBookmarked}
            onFollowUpClick={(fuQuery) =>
              handleSearch(fuQuery, {
                engine: currentResult.engine,
                mode: 'comprehensive',
                filterType: 'all',
              })
            }
            userAuthenticated={Boolean(user)}
            onPromptAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Gemini AI Search & Authentication • Real-time Google Search Grounding</span>
          <span className="text-slate-400">Zero Mock Data • Server-Side API Architecture</span>
        </div>
      </footer>

      {/* History & Bookmarks Slide Drawer */}
      <HistoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        history={history}
        bookmarks={bookmarks}
        onSelectQuery={(q) =>
          handleSearch(q, {
            engine: 'gemini',
            mode: 'comprehensive',
            filterType: 'all',
          })
        }
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        onDeleteBookmark={handleDeleteBookmark}
        user={user}
        onOpenAuth={() => {
          setIsDrawerOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Auth Modal (Login / Registration) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(authedUser) => {
          setUser(authedUser);
          loadBookmarks();
          loadHistory();
        }}
      />
    </div>
  );
}
