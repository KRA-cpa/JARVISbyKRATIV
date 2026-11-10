import React, { useState, useEffect } from 'react';
import Icons from './Icons';

/**
 * TagSearchFilter Component
 *
 * Advanced tag-based filtering for ticket dashboard
 * Supports multiple tags, AND/OR operations, tag exclusion, and saved searches
 * compact: one inline row for a toolbar (Tickets "More filters", 9 Nov 2026) - a "Tags..." input with the chosen tags
 * as chips, ANY / ALL only with 2+ tags, an Exclude button on every suggestion (no Advanced toggle), no summary box,
 * saved searches in a small "Saved" menu. To clear it from outside, remount it with a new `key`.
 */
const TagSearchFilter = ({
  availableTags = [],
  onFilterChange,
  initialFilters = null,
  companyId = null,
  className = "",
  compact = false
}) => {
  // State management
  const [selectedTags, setSelectedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [operator, setOperator] = useState('OR'); // 'AND' or 'OR'
  const [searchValue, setSearchValue] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSavedMenu, setShowSavedMenu] = useState(false);

  // Initialize filters from props
  useEffect(() => {
    if (initialFilters) {
      setSelectedTags(initialFilters.selectedTags || []);
      setExcludedTags(initialFilters.excludedTags || []);
      setOperator(initialFilters.operator || 'OR');
    }
  }, [initialFilters]);

  // Filter suggestions based on search value
  useEffect(() => {
    if (searchValue.trim()) {
      const filtered = availableTags
        .filter(tag =>
          tag.name.toLowerCase().includes(searchValue.toLowerCase()) &&
          !selectedTags.find(selected => selected.id === tag.id) &&
          !excludedTags.find(excluded => excluded.id === tag.id)
        )
        .sort((a, b) => {
          // Sort by usage count (higher first), then by name
          if (b.usage_count !== a.usage_count) {
            return b.usage_count - a.usage_count;
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, 20); // Limit to 20 suggestions

      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchValue, availableTags, selectedTags, excludedTags]);

  // Notify parent of filter changes
  useEffect(() => {
    const filters = {
      selectedTags,
      excludedTags,
      operator,
      hasFilters: selectedTags.length > 0 || excludedTags.length > 0
    };
    onFilterChange(filters);
  }, [selectedTags, excludedTags, operator, onFilterChange]);

  // Handle tag selection
  const handleTagSelect = (tag, isExcluded = false) => {
    if (isExcluded) {
      setExcludedTags(prev => [...prev, tag]);
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
    setSearchValue('');
    setShowSuggestions(false);
  };

  // Handle tag removal
  const handleTagRemove = (tagToRemove, isExcluded = false) => {
    if (isExcluded) {
      setExcludedTags(prev => prev.filter(tag => tag.id !== tagToRemove.id));
    } else {
      setSelectedTags(prev => prev.filter(tag => tag.id !== tagToRemove.id));
    }
  };

  // Clear all filters
  const handleClearAll = () => {
    setSelectedTags([]);
    setExcludedTags([]);
    setSearchValue('');
    setShowSuggestions(false);
  };

  // Toggle advanced mode
  const handleToggleAdvanced = () => {
    setShowAdvanced(prev => !prev);
    if (!showAdvanced && excludedTags.length > 0) {
      setExcludedTags([]); // Clear excluded tags when leaving advanced mode
    }
  };

  // Save current search
  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) return;

    const searchConfig = {
      id: `search_${Date.now()}`,
      name: saveSearchName.trim(),
      selectedTags: selectedTags.map(tag => ({ id: tag.id, name: tag.name, color: tag.color })),
      excludedTags: excludedTags.map(tag => ({ id: tag.id, name: tag.name, color: tag.color })),
      operator,
      createdAt: new Date().toISOString()
    };

    setSavedSearches(prev => [...prev, searchConfig]);
    setSaveSearchName('');
    setShowSaveDialog(false);

    // TODO: Save to localStorage or API
    try {
      const saved = JSON.parse(localStorage.getItem('tagSearchFilters') || '[]');
      saved.push(searchConfig);
      localStorage.setItem('tagSearchFilters', JSON.stringify(saved));
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  // Load saved search
  const handleLoadSearch = (search) => {
    setSelectedTags(search.selectedTags);
    setExcludedTags(search.excludedTags);
    setOperator(search.operator);
    if (search.excludedTags.length > 0) {
      setShowAdvanced(true);
    }
  };

  // Delete saved search
  const handleDeleteSearch = (searchId) => {
    setSavedSearches(prev => prev.filter(search => search.id !== searchId));

    // TODO: Remove from localStorage or API
    try {
      const saved = JSON.parse(localStorage.getItem('tagSearchFilters') || '[]');
      const updated = saved.filter(search => search.id !== searchId);
      localStorage.setItem('tagSearchFilters', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  // Load saved searches on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tagSearchFilters') || '[]');
      setSavedSearches(saved);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  }, []);

  // Get tag style
  const getTagStyle = (tag, isExcluded = false) => ({
    backgroundColor: isExcluded ? '#EF4444' : (tag.color || '#3B82F6'),
    color: '#FFFFFF'
  });

  // Get filter summary text
  const getFilterSummary = () => {
    const parts = [];

    if (selectedTags.length > 0) {
      const tagNames = selectedTags.map(tag => tag.name).join(`, `);
      parts.push(`${operator === 'AND' ? 'All of' : 'Any of'}: ${tagNames}`);
    }

    if (excludedTags.length > 0) {
      const excludedNames = excludedTags.map(tag => tag.name).join(`, `);
      parts.push(`Excluding: ${excludedNames}`);
    }

    return parts.join(' • ');
  };

  // Save Search dialog (both modes)
  const saveDialog = showSaveDialog && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Save Search</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Name
          </label>
          <input
            type="text"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
            placeholder="Enter search name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-600">
            <strong>Filter:</strong> {getFilterSummary()}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setShowSaveDialog(false);
              setSaveSearchName('');
            }}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSearch}
            disabled={!saveSearchName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  const hasFilters = selectedTags.length > 0 || excludedTags.length > 0;

  if (compact) {
    const chip = (tag, isExcluded) => (
      <span
        key={`${isExcluded ? 'x' : 'i'}-${tag.id}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
        style={getTagStyle(tag, isExcluded)}
        title={isExcluded ? `Excluding ${tag.name}` : tag.name}
      >
        {isExcluded && <Icons.Minus size={10} />}
        <span>{tag.name}</span>
        <button
          type="button"
          onClick={() => handleTagRemove(tag, isExcluded)}
          className="hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
          aria-label={`Remove ${tag.name}`}
        >
          <Icons.X size={10} />
        </button>
      </span>
    );

    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="flex items-center gap-1 text-sm text-gray-600">
          <Icons.Tag size={14} className="text-gray-500" />
          Tags
        </span>

        {selectedTags.length > 1 && (
          <span className="inline-flex rounded border border-gray-200 overflow-hidden">
            {[['OR', 'ANY'], ['AND', 'ALL']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOperator(value)}
                className={`text-xs px-2 py-0.5 ${operator === value ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                {label}
              </button>
            ))}
          </span>
        )}

        {selectedTags.map(tag => chip(tag, false))}
        {excludedTags.map(tag => chip(tag, true))}

        <div className="relative">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => searchValue && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Tags..."
            className="w-36 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 w-72 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredSuggestions.map(tag => (
                <div
                  key={tag.id}
                  className="px-3 py-1.5 cursor-pointer hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                  onClick={() => handleTagSelect(tag, false)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                    <span className="text-sm truncate">{tag.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagSelect(tag, true);
                    }}
                    className="text-xs text-red-600 hover:text-red-800 px-2 py-0.5 bg-red-50 rounded flex-shrink-0"
                  >
                    Exclude
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button type="button" onClick={() => setShowSaveDialog(true)} className="text-xs text-blue-600 hover:text-blue-800">
            Save
          </button>
        )}

        {savedSearches.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSavedMenu(prev => !prev)}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
            >
              Saved <Icons.ChevronDown size={12} />
            </button>
            {showSavedMenu && (
              <div className="absolute z-50 right-0 w-56 mt-1 bg-white border border-gray-300 rounded-md shadow-lg py-1">
                {savedSearches.map(search => (
                  <div key={search.id} className="flex items-center justify-between px-2 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadSearch(search);
                        setShowSavedMenu(false);
                      }}
                      className="flex-1 text-left text-sm text-gray-700 py-1 truncate"
                    >
                      {search.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSearch(search.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={`Delete saved search ${search.name}`}
                    >
                      <Icons.Delete size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {saveDialog}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Tag className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">Filter by Tags</h3>
          </div>

          <div className="flex items-center gap-2">
            {(selectedTags.length > 0 || excludedTags.length > 0) && (
              <>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Save Search
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear All
                </button>
              </>
            )}

            <button
              onClick={handleToggleAdvanced}
              className={`text-xs px-2 py-1 rounded ${
                showAdvanced
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4">
        <div className="relative">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => searchValue && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search tags to add to filter..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredSuggestions.map((tag) => (
                <div key={tag.id} className="border-b border-gray-100 last:border-b-0">
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => handleTagSelect(tag, false)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color || '#3B82F6' }}
                      />
                      <span className="font-medium">{tag.name}</span>
                      {tag.description && (
                        <span className="text-sm text-gray-500">- {tag.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {showAdvanced && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTagSelect(tag, true);
                          }}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded"
                        >
                          Exclude
                        </button>
                      )}
                      <span className="text-xs text-gray-400">{tag.usage_count} uses</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Include tags:</span>
            {selectedTags.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOperator('OR')}
                  className={`text-xs px-2 py-1 rounded ${
                    operator === 'OR'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ANY
                </button>
                <button
                  onClick={() => setOperator('AND')}
                  className={`text-xs px-2 py-1 rounded ${
                    operator === 'AND'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ALL
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium"
                style={getTagStyle(tag)}
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => handleTagRemove(tag, false)}
                  className="ml-1 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
                >
                  <Icons.X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Excluded Tags (Advanced Mode) */}
      {showAdvanced && excludedTags.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Exclude tags:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {excludedTags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium"
                style={getTagStyle(tag, true)}
              >
                <Icons.Minus size={12} />
                <span>{tag.name}</span>
                <button
                  onClick={() => handleTagRemove(tag, true)}
                  className="ml-1 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
                >
                  <Icons.X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Summary */}
      {(selectedTags.length > 0 || excludedTags.length > 0) && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <Icons.Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-blue-800">Active Filter</div>
                <div className="text-sm text-blue-700 mt-1">{getFilterSummary()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Saved Searches</span>
          </div>

          <div className="space-y-2">
            {savedSearches.slice(0, 5).map((search) => (
              <div key={search.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <button
                  onClick={() => handleLoadSearch(search)}
                  className="flex-1 text-left text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {search.name}
                </button>
                <button
                  onClick={() => handleDeleteSearch(search.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Icons.Delete size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveDialog}
    </div>
  );
};

export default TagSearchFilter;