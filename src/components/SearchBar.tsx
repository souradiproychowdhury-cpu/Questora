import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, ArrowRight, X, Compass, Globe, Code, BookOpen, MessageSquare } from 'lucide-react';
import { ApiStatus } from '../types';

interface SearchBarProps {
  onSearch: (query: string, options: {
    engine: 'gemini' | 'openai';
    mode: 'comprehensive' | 'concise' | 'news';
    filterType: string;
  }) => void;
  loading: boolean;
  apiStatus: ApiStatus | null;
  initialQuery?: string;
}

const SAMPLE_QUERIES = [
  'Latest updates on Artemis mission to Moon',
  'What is the mechanism of CRISPR gene editing in 2026?',
  'Compare Rust vs Go for high-concurrency microservices',
  'Breakthroughs in solid state battery commercialization',
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  loading,
  apiStatus,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [engine, setEngine] = useState<'gemini' | 'openai'>('gemini');
  const [mode, setMode] = useState<'comprehensive' | 'concise' | 'news'>('comprehensive');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onSearch(query.trim(), { engine, mode, filterType });
  };

  const handleSampleClick = (sample: string) => {
    setQuery(sample);
    onSearch(sample, { engine, mode, filterType });
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Search Input Container */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center rounded-2xl border-2 border-slate-300 bg-white p-2 shadow-sm transition-all focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10">
          <div className="pl-3 pr-2 text-slate-400">
            <Search className="h-5 w-5 text-indigo-600" />
          </div>

          <input
            id="main-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything with live Google Search grounding..."
            className="w-full bg-transparent py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
            disabled={loading}
          />

          {query && !loading && (
            <button
              id="clear-search-btn"
              type="button"
              onClick={() => setQuery('')}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Filter toggle button */}
          <button
            id="toggle-filter-panel-btn"
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              showFilters || filterType !== 'all' || mode !== 'comprehensive' || engine !== 'gemini'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Configure engine and search mode"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Options</span>
          </button>

          {/* Submit Search Button */}
          <button
            id="execute-search-btn"
            type="submit"
            disabled={loading || !query.trim()}
            className="ml-1 flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-40 transition-all"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="text-xs font-medium hidden sm:inline">Grounding...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>Search</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </button>
        </div>

        {/* Options / Filters Dropdown Card */}
        {showFilters && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Engine Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">AI Engine</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="engine"
                      value="gemini"
                      checked={engine === 'gemini'}
                      onChange={() => setEngine('gemini')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800">Gemini 3.8 Flash</span>
                      <p className="text-[10px] text-emerald-600 font-medium">Google Search Grounded</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ${
                    !apiStatus?.services.openai.configured ? 'bg-slate-50/50' : ''
                  }`}>
                    <input
                      type="radio"
                      name="engine"
                      value="openai"
                      checked={engine === 'openai'}
                      onChange={() => setEngine('openai')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800">OpenAI GPT-4o mini</span>
                      <p className="text-[10px] text-slate-500">
                        {apiStatus?.services.openai.configured
                          ? 'API Connected'
                          : apiStatus?.services.openai.quotaExhausted
                          ? 'No credits (Gemini active)'
                          : 'Optional (auto-falls back to Gemini)'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Response Mode */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Synthesis Mode</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'comprehensive', label: 'Comprehensive', desc: 'Detailed breakdown & key takeaways' },
                    { id: 'concise', label: 'Concise', desc: 'Direct fast summary' },
                    { id: 'news', label: 'Live News', desc: 'Recent chronological updates' },
                  ].map((m) => (
                    <label key={m.id} className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value={m.id}
                        checked={mode === m.id}
                        onChange={() => setMode(m.id as any)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">{m.label}</span>
                        <p className="text-[10px] text-slate-500">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filter Category */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Focus Scope</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'all', label: 'All Web', icon: Globe },
                    { id: 'technical', label: 'Tech & Code', icon: Code },
                    { id: 'academic', label: 'Academic', icon: BookOpen },
                    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
                  ].map((f) => {
                    const Icon = f.icon;
                    const isActive = filterType === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterType(f.id)}
                        className={`flex items-center gap-1.5 rounded-lg p-2 text-left border transition-colors ${
                          isActive
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Suggested Queries Chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
          <Sparkles className="h-3 w-3 text-indigo-500" />
          <span>Try:</span>
        </span>
        {SAMPLE_QUERIES.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSampleClick(sample)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
};
