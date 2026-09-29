import React, { useState } from 'react';
import { X, History, Bookmark, Trash2, Clock, Globe, ArrowRight, ExternalLink, Sparkles, UserCheck } from 'lucide-react';
import { HistoryItem, BookmarkItem, User } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'history' | 'bookmarks';
  onTabChange: (tab: 'history' | 'bookmarks') => void;
  history: HistoryItem[];
  bookmarks: BookmarkItem[];
  onSelectQuery: (query: string) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  onDeleteBookmark: (id: string) => void;
  user: User | null;
  onOpenAuth: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  history,
  bookmarks,
  onSelectQuery,
  onDeleteHistoryItem,
  onClearHistory,
  onDeleteBookmark,
  user,
  onOpenAuth,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-slate-200 bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                id="history-tab-btn"
                onClick={() => onTabChange('history')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>History ({history.length})</span>
              </button>

              <button
                id="bookmarks-tab-btn"
                onClick={() => onTabChange('bookmarks')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Bookmarks ({bookmarks.length})</span>
              </button>
            </div>

            <button
              id="close-history-drawer-btn"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Auth Sync Status Banner */}
          {!user ? (
            <div className="bg-amber-50 border-b border-amber-200/70 p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div>
                <p className="font-semibold">Local Session</p>
                <p className="text-[11px] text-amber-700">Sign in to securely sync your research history across devices.</p>
              </div>
              <button
                id="drawer-auth-btn"
                onClick={onOpenAuth}
                className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border-b border-emerald-200/70 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 font-medium">
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Synced to {user.name} ({user.email})</span>
              </div>
            </div>
          )}

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'history' ? (
              history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                  <History className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No search history yet</p>
                  <p className="text-xs text-slate-400 mt-1">Queries you execute will automatically appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Recent Activity
                    </span>
                    <button
                      id="clear-all-history-btn"
                      onClick={onClearHistory}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Clear all</span>
                    </button>
                  </div>

                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-slate-200 bg-white p-3.5 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => {
                            onSelectQuery(item.query);
                            onClose();
                          }}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2"
                        >
                          {item.query}
                        </button>
                        <button
                          onClick={() => onDeleteHistoryItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                          title="Delete from history"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.summaryPreview}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                            {item.engine}
                          </span>
                          {item.sourcesCount > 0 && (
                            <span className="flex items-center gap-1 text-indigo-600 font-medium">
                              <Globe className="h-3 w-3" />
                              <span>{item.sourcesCount} sources</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : bookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                <Bookmark className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No saved bookmarks</p>
                <p className="text-xs text-slate-400 mt-1">Bookmark notable search findings to review later.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block pb-1">
                  Saved Research
                </span>

                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="group rounded-xl border border-slate-200 bg-white p-3.5 hover:border-indigo-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {bm.title || bm.query}
                      </h4>
                      <button
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remove bookmark"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {bm.summary}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {new Date(bm.savedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          onSelectQuery(bm.query);
                          onClose();
                        }}
                        className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <span>Re-query</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
