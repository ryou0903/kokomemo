import { useState, useRef, useEffect } from 'react';
import { Input } from './ui';
import { getSearchHistory } from '../lib/storage';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
}

export interface SearchSuggestion {
  type: 'history' | 'place';
  text: string;
  placeId?: string;
  description?: string;
}

export function SearchBar({
  onSearch,
  onSelectSuggestion,
  suggestions = [],
  isLoading,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = getSearchHistory();
    setHistorySuggestions(
      history.slice(0, 5).map((h) => ({
        type: 'history' as const,
        text: h.query,
        placeId: h.placeId,
      }))
    );
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setIsFocused(false);
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    }
  };

  const showSuggestions = isFocused && (query.length > 0 || historySuggestions.length > 0);
  const displaySuggestions =
    query.length > 0
      ? suggestions
      : historySuggestions.filter((h) => h.text.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={containerRef} className="relative px-4 py-3">
      <Input
        ref={inputRef}
        type="search"
        placeholder="住所や建物の名前で検索"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        className="pr-12"
      />
      {isLoading && (
        <div className="absolute right-7 top-1/2 -translate-y-1/2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {showSuggestions && displaySuggestions.length > 0 && (
        <div className="absolute left-4 right-4 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white shadow-lg border border-border">
          {displaySuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.placeId || index}`}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-3 text-left text-lg hover:bg-gray-50 border-b border-border last:border-b-0 flex items-center gap-3"
            >
              <span className="text-xl">
                {suggestion.type === 'history' ? '🕐' : '📍'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate">{suggestion.text}</p>
                {suggestion.description && (
                  <p className="text-sm text-text-secondary truncate">{suggestion.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
