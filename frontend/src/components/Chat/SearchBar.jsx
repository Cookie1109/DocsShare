import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

const SearchBar = ({ isOpen, onClose, documents, onFilteredDocuments }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() === '') {
        setFilteredResults([]);
        onFilteredDocuments([]);
        return;
      }

      const results = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.tags && doc.tags.some(tagId => {
          // Tìm theo tag name (cần implement tag name lookup)
          return false; // Placeholder
        }))
      );

      setFilteredResults(results);
      onFilteredDocuments(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, documents, onFilteredDocuments]);

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredResults([]);
    onFilteredDocuments([]);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm file trong nhóm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="border-t pt-3">
            <p className="text-sm text-gray-500 mb-2">
              {filteredResults.length} kết quả
            </p>
            
            {filteredResults.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredResults.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
                  >
                    <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-xs">
                        {doc.type?.toUpperCase() || 'FILE'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.uploadedAt).toLocaleDateString('vi-VN')} • {doc.size}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Không tìm thấy file nào</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;