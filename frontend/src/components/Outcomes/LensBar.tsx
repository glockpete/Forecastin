/**
 * LensBar Component
 * Multi-dimensional filter controls for "One Dashboard, Multiple Lenses" architecture
 * Manages URL parameters for filter state persistence
 */

import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X, ChevronDown } from 'lucide-react';
import { LensFilters, LensFilterOption, LensBarProps } from '../../types/outcomes';
import { cn } from '../../utils/cn';

const LensBar: React.FC<LensBarProps> = ({ filters, onFiltersChange, availableFilters }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  // Update URL parameters when filters change
  const updateUrlParams = useCallback((newFilters: LensFilters) => {
    const params = new URLSearchParams(searchParams);
    
    // Update each filter type
    if (newFilters.role?.length) {
      params.set('role', newFilters.role.join(','));
    } else {
      params.delete('role');
    }
    
    if (newFilters.sector?.length) {
      params.set('sector', newFilters.sector.join(','));
    } else {
      params.delete('sector');
    }
    
    if (newFilters.marketLevel?.length) {
      params.set('marketLevel', newFilters.marketLevel.join(','));
    } else {
      params.delete('marketLevel');
    }
    
    if (newFilters.function?.length) {
      params.set('function', newFilters.function.join(','));
    } else {
      params.delete('function');
    }
    
    if (newFilters.risk?.length) {
      params.set('risk', newFilters.risk.join(','));
    } else {
      params.delete('risk');
    }
    
    if (newFilters.horizon?.length) {
      params.set('horizon', newFilters.horizon.join(','));
    } else {
      params.delete('horizon');
    }
    
    setSearchParams(params);
    onFiltersChange(newFilters);
  }, [searchParams, setSearchParams, onFiltersChange]);

  // Toggle filter value
  const toggleFilter = useCallback((filterType: keyof LensFilters, value: string) => {
    const currentValues = filters[filterType] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    updateUrlParams({
      ...filters,
      [filterType]: newValues.length > 0 ? newValues : undefined,
    });
  }, [filters, updateUrlParams]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    updateUrlParams({});
  }, [updateUrlParams]);

  // Clear specific filter type
  const clearFilterType = useCallback((filterType: keyof LensFilters) => {
    updateUrlParams({
      ...filters,
      [filterType]: undefined,
    });
  }, [filters, updateUrlParams]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).reduce((count, values) => {
      return count + (values?.length || 0);
    }, 0);
  }, [filters]);

  // Filter section component
  const FilterSection: React.FC<{
    title: string;
    filterType: keyof LensFilters;
    options: LensFilterOption[];
  }> = ({ title, filterType, options }) => {
    const isExpanded = expandedSection === filterType;
    const selectedValues = filters[filterType] || [];
    const hasSelection = selectedValues.length > 0;

    return (
      <div className="relative">
        <button
          onClick={() => setExpandedSection(isExpanded ? null : filterType)}
          className={cn(
            'flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            hasSelection
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          <span>{title}</span>
          {hasSelection && (
            <span className="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full text-xs">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
        </button>

        {isExpanded && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
              {hasSelection && (
                <button
                  onClick={() => clearFilterType(filterType)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFilter(filterType, option.value)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                    {option.count !== undefined && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {option.count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Lens Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 rounded-full text-xs font-medium">
              {activeFilterCount} active
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      <div className="flex items-center space-x-3 mt-3 flex-wrap gap-2">
        <FilterSection
          title="Role"
          filterType="role"
          options={availableFilters.roles}
        />
        <FilterSection
          title="Sector"
          filterType="sector"
          options={availableFilters.sectors}
        />
        <FilterSection
          title="Market Level"
          filterType="marketLevel"
          options={availableFilters.marketLevels}
        />
        <FilterSection
          title="Function"
          filterType="function"
          options={availableFilters.functions}
        />
        <FilterSection
          title="Risk"
          filterType="risk"
          options={availableFilters.risks}
        />
        <FilterSection
          title="Horizon"
          filterType="horizon"
          options={availableFilters.horizons}
        />
      </div>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {Object.entries(filters).map(([filterType, values]) => {
            if (!values || values.length === 0) return null;
            
            return values.map((value: string) => (
              <span
                key={`${filterType}-${value}`}
                className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 rounded text-xs"
              >
                <span className="font-medium">{filterType}:</span>
                <span>{value}</span>
                <button
                  onClick={() => toggleFilter(filterType as keyof LensFilters, value)}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ));
          })}
        </div>
      )}
    </div>
  );
};

export default LensBar;