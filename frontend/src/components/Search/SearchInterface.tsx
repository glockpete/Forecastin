/**
 * Search Interface Component
 * Global search functionality with hierarchy context preservation
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  ArrowLeft,
  ChevronRight,
  Clock,
  Filter,
  TrendingUp
} from 'lucide-react';

import { useUIStore } from '../../store/uiStore';
import { useSearchEntities } from '../../hooks/useHierarchy';
import { cn } from '../../utils/cn';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { getConfidence } from '../../../../types/contracts.generated';

interface SearchInterfaceProps {
  className?: string;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({ 
  className 
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const { 
    navigateToEntity, 
    getCurrentColumnPath,
    setSearchQuery,
    searchQuery 
  } = useUIStore();

  const { 
    data: searchResults, 
    isLoading, 
    error 
  } = useSearchEntities(query);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // Ignore invalid data
      }
    }
  }, []);

  // Save recent searches to localStorage when updated
  const saveRecentSearch = (searchQuery: string) => {
    if (searchQuery.length < 2) return;
    
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)]
      .slice(0, 10); // Keep only 10 most recent
    
    setRecentSearches(updated);
    localStorage.setItem('recent-searches', JSON.stringify(updated));
  };

  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim().length < 2) return;
    
    setQuery(searchQuery);
    setSearchQuery(searchQuery);
    saveRecentSearch(searchQuery);
    
    if (searchResults && searchResults.entities && searchResults.entities.length > 0) {
      // Navigate to the first result if available
      const firstResult = searchResults.entities[0];
      navigateToEntity(firstResult, 0); // Use column index 0 for search results
      setIsOpen(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(!isOpen);
      }
      
      // Escape to close search
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Get breadcrumb context for search results
  const getBreadcrumbContext = (entity: any) => {
    const path = entity.path;
    if (!path) return [];
    
    // Convert path to breadcrumb segments
    const segments = path.split('/').filter(Boolean);
    return segments;
  };

  // Filter recent searches based on current query
  const filteredRecentSearches = useMemo(() => {
    if (!query.trim()) return recentSearches;
    return recentSearches.filter(search => 
      search.toLowerCase().includes(query.toLowerCase())
    );
  }, [recentSearches, query]);

  if (!isOpen) {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 w-full px-3 py-2 text-left bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Search entities...</span>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">⌘K</span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Search Modal */}
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
        
        {/* Search Panel */}
        <div className="absolute top-0 right-0 w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-xl transform transition-transform">
          {/* Header */}
          <div className="flex items-center space-x-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search entities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(query);
                }
              }}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="h-full overflow-y-auto">
            {/* Search Results */}
            {query.length >= 2 && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search Results
                  </h3>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <div className="p-8 text-center">
                      <LoadingSpinner message="Searching..." />
                    </div>
                  ) : error ? (
                    <div className="p-8 text-center text-red-600 dark:text-red-400">
                      <p>Search failed. Please try again.</p>
                    </div>
                  ) : searchResults && searchResults.entities && searchResults.entities.length > 0 ? (
                    searchResults.entities.map((entity, index) => (
                      <button
                        key={`${entity.id}-${index}`}
                        onClick={() => {
                          navigateToEntity(entity, 0); // Use column index 0 for search results
                          setIsOpen(false);
                        }}
                        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {entity.name}
                              </h4>
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full capitalize">
                                {entity.type}
                              </span>
                            </div>
                            
                            {/* Breadcrumb Context */}
                            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                              {getBreadcrumbContext(entity).map((segment: string, segIndex: number, array: string[]) => (
                                <React.Fragment key={segIndex}>
                                  <span className="truncate">{segment}</span>
                                  {segIndex < array.length - 1 && (
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            
                            {getConfidence(entity) > 0 && (
                              <div className="flex items-center space-x-1 mt-1">
                                <TrendingUp className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  {(getConfidence(entity) * 100).toFixed(0)}% match
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <p>No results found for "{query}"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recent Searches
                  </h3>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(search)}
                      className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {search}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!query && recentSearches.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-lg font-medium mb-2">Search your entities</p>
                <p className="text-sm">Start typing to search through your hierarchy</p>
              </div>
            )}

            {/* Search Tips */}
            {query.length >= 2 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-blue-800 dark:text-blue-300 font-medium mb-1">Search Tips</p>
                    <ul className="text-blue-700 dark:text-blue-400 space-y-1">
                      <li>• Results are ranked by relevance and confidence score</li>
                      <li>• Click any result to navigate directly to that entity</li>
                      <li>• Breadcrumbs show the hierarchical context</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchInterface;