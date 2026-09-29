import React, { useState } from 'react';
import {
  ExternalLink,
  Globe,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  Sparkles,
  Search,
  Clock,
  ArrowRight,
  Share2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SearchResult } from '../types';

interface SearchResultsProps {
  result: SearchResult;
  onBookmark: () => void;
  isBookmarked: boolean;
  onFollowUpClick: (query: string) => void;
  userAuthenticated: boolean;
  onPromptAuth: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  result,
  onBookmark,
  isBookmarked,
  onFollowUpClick,
  userAuthenticated,
  onPromptAuth,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to format markdown-like text nicely
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Main Headings (### or ##)
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="mt-5 mb-2 text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block" />
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="mt-6 mb-3 text-lg font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            {line.replace('## ', '')}
          </h2>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="mt-6 mb-3 text-xl font-extrabold text-slate-900">
            {line.replace('# ', '')}
          </h1>
        );
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.replace(/^[-*]\s+/, '');
        return (
          <li key={idx} className="ml-5 list-disc pl-1 py-1 text-slate-700 leading-relaxed text-sm">
            {renderInlineStyles(itemText)}
          </li>
        );
      }

      // Numbered lists
      if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s+/, '');
        return (
          <li key={idx} className="ml-5 list-decimal pl-1 py-1 text-slate-700 leading-relaxed text-sm">
            {renderInlineStyles(itemText)}
          </li>
        );
      }

      // Empty lines
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      // Regular paragraph
      return (
        <p key={idx} className="my-1.5 text-sm text-slate-700 leading-relaxed">
          {renderInlineStyles(line)}
        </p>
      );
    });
  };

  const renderInlineStyles = (text: string) => {
    // Basic bold replacement **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {result.engine === 'gemini'
                  ? (result.model === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'Gemini 3.1 Flash Lite')
                  : 'OpenAI GPT-4o mini'}
              </span>
              {result.engine === 'gemini' && (
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                  result.groundingType === 'live-web'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {result.groundingType === 'live-web' ? 'Live Web Grounded' : 'Google Search Grounded'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{result.executionTimeMs} ms</span>
              </span>
              {result.sources.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-blue-500" />
                  <span>{result.sources.length} Verified Sources</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            id="copy-result-btn"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            title="Copy answer to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            id="bookmark-result-btn"
            onClick={userAuthenticated ? onBookmark : onPromptAuth}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isBookmarked
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            title={userAuthenticated ? (isBookmarked ? 'Bookmarked' : 'Save bookmark') : 'Sign in to bookmark'}
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="h-3.5 w-3.5 text-indigo-600" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" />
                <span>Save Bookmark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grounding Web Sources Cards */}
      {result.sources.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Globe className="h-4 w-4 text-indigo-600" />
              <span>Real-Time Citations & Grounding Sources ({result.sources.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Directly fetched via Google Search Grounding</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {result.sources.map((source, idx) => {
              let domain = '';
              try {
                domain = new URL(source.uri).hostname.replace('www.', '');
              } catch {
                domain = source.title;
              }

              return (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-indigo-700 truncate">{domain}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-800 line-clamp-2 leading-snug">
                    {source.title || domain}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Answer Content Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Synthesized Answer</h2>
            <p className="text-xs text-slate-500">Grounded analysis for: "{result.query}"</p>
          </div>
        </div>

        <div className="prose-slate max-w-none">
          {renderFormattedContent(result.text)}
        </div>

        {/* Live Search Queries Performed */}
        {result.searchQueries.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 block mb-2">
              Internal Grounding Queries:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.searchQueries.map((sq, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600 font-mono"
                >
                  <Search className="h-3 w-3 text-slate-400" />
                  <span>{sq}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Suggestions */}
      {result.suggestedFollowUps.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-3 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-indigo-600" />
            <span>Recommended Follow-Up Inquiries</span>
          </h4>
          <div className="space-y-2">
            {result.suggestedFollowUps.map((fu, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUpClick(fu)}
                className="flex w-full items-center justify-between rounded-xl border border-indigo-200/80 bg-white p-3 text-left text-xs font-medium text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 transition-colors shadow-2xs"
              >
                <span>{fu}</span>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-500 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
