import React, { useState } from 'react';
import { Sparkles, User as UserIcon, LogIn, LogOut, History, Bookmark, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { User, ApiStatus } from '../types';

interface HeaderProps {
  user: User | null;
  apiStatus: ApiStatus | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onToggleHistory: () => void;
  onToggleBookmarks: () => void;
  historyCount: number;
  bookmarksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  apiStatus,
  onOpenAuth,
  onLogout,
  onToggleHistory,
  onToggleBookmarks,
  historyCount,
  bookmarksCount,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Gemini AI Search
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                Grounding v2
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Real-time web verified intelligence powered by Google Search
            </p>
          </div>
        </div>

        {/* Center: Live API Engine Badges */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Gemini AI</span>
            <span className="rounded bg-emerald-100 px-1 py-0.2 text-[10px] font-semibold text-emerald-800">
              Live Grounding
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
            {apiStatus?.services.openai.configured ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>OpenAI Connected</span>
              </>
            ) : apiStatus?.services.openai.quotaExhausted ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-amber-700">OpenAI (No Credits)</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="text-slate-500">OpenAI (Optional)</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions and User Auth */}
        <div className="flex items-center gap-2">
          {/* History Button */}
          <button
            id="history-toggle-btn"
            onClick={onToggleHistory}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            title="View search history"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[11px] font-semibold text-slate-700">
                {historyCount}
              </span>
            )}
          </button>

          {/* Bookmarks Button */}
          <button
            id="bookmarks-toggle-btn"
            onClick={onToggleBookmarks}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            title="View saved bookmarks"
          >
            <Bookmark className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Saved</span>
            {bookmarksCount > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[11px] font-semibold text-indigo-700">
                {bookmarksCount}
              </span>
            )}
          </button>

          {/* Auth Button or User Menu */}
          {user ? (
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white uppercase">
                  {user.name.slice(0, 2)}
                </div>
                <span className="max-w-[100px] truncate hidden sm:inline">{user.name}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white uppercase">
                        {user.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Authenticated Session Active</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 mb-3">
                    <div className="flex justify-between py-1">
                      <span>Total Searches:</span>
                      <span className="font-semibold text-slate-800">{historyCount}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Saved Bookmarks:</span>
                      <span className="font-semibold text-slate-800">{bookmarksCount}</span>
                    </div>
                  </div>

                  <button
                    id="user-logout-btn"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              id="open-auth-modal-btn"
              onClick={onOpenAuth}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
