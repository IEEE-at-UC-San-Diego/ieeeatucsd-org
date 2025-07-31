import React, { useRef, useEffect } from 'react';
import { Search, X, FileText, Type } from 'lucide-react';
import type { ConstitutionSection } from '../types/firestore';
import { useConstitutionSearch, type SearchResult } from '../hooks/useConstitutionSearch';

interface ConstitutionSearchProps {
  sections: ConstitutionSection[];
  onSelectSection: (sectionId: string, pageNumber?: number) => void;
  className?: string;
}

const ConstitutionSearch: React.FC<ConstitutionSearchProps> = ({
  sections,
  onSelectSection,
  className = '',
}) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearchOpen,
    setIsSearchOpen,
    clearSearch,
    hasResults,
  } = useConstitutionSearch(sections);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsSearchOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
      // Escape to close search
      if (event.key === 'Escape' && isSearchOpen) {
        clearSearch();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, clearSearch, setIsSearchOpen]);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchOpen(value.length >= 2);
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelectSection(result.section.id, result.pageNumber);
    clearSearch();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search constitution... (Ctrl+K)"
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isSearchOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {hasResults ? (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.section.id}-${index}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {result.matchType === 'title' ? (
                        <Type className="w-4 h-4 text-blue-500" />
                      ) : (
                        <FileText className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {result.displayTitle}
                        </div>
                        {result.pageNumber && (
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Page {result.pageNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-2">
                        {result.matchType === 'title' ? (
                          <span>Title: {highlightMatch(result.matchText, searchQuery)}</span>
                        ) : (
                          <span>Content: {highlightMatch(result.matchText, searchQuery)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConstitutionSearch;
