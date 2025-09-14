import { useState, useMemo } from 'react';
import { Search, Filter, Download, Trash2, FileText, File, Image, Video, Music, Archive } from 'lucide-react';

const Files = ({ group, documents, availableTags, currentUser, isAdmin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name, size

  // Get file icon based on type
  const getFileIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image className="h-6 w-6 text-blue-500" />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return <Video className="h-6 w-6 text-purple-500" />;
      case 'mp3':
      case 'wav':
      case 'flac':
        return <Music className="h-6 w-6 text-green-500" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="h-6 w-6 text-orange-500" />;
      default:
        return <File className="h-6 w-6 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !selectedTag || doc.tags?.includes(selectedTag);
      return matchesSearch && matchesTag;
    });

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.uploadedAt) - new Date(b.uploadedAt);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        case 'newest':
        default:
          return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      }
    });

    return filtered;
  }, [documents, searchQuery, selectedTag, sortBy]);

  const handleDownload = (doc) => {
    // TODO: Implement download functionality
    console.log('Download file:', doc);
  };

  const handleDelete = (doc) => {
    if (window.confirm(`Bạn có chắc muốn xóa file "${doc.name}"?`)) {
      // TODO: Implement delete functionality
      console.log('Delete file:', doc);
    }
  };

  const getTagInfo = (tagId) => {
    return availableTags.find(tag => tag.id === tagId);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search and Filter */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="flex-1">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            >
              <option value="">Tất cả tag</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name">Tên A-Z</option>
              <option value="size">Kích thước</option>
            </select>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            File ({filteredDocuments.length})
          </h4>
          {selectedTag && (
            <button
              onClick={() => setSelectedTag('')}
              className="text-xs text-green-600 hover:text-green-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {filteredDocuments.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
              >
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(doc.type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(doc.sizeBytes || 0)}</span>
                    <span>•</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString('vi-VN')}</span>
                    <span>•</span>
                    <span>{doc.uploadedBy === currentUser?.id ? 'Bạn' : 'Trưởng nhóm'}</span>
                  </div>
                  
                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {doc.tags.map((tagId) => {
                        const tag = getTagInfo(tagId);
                        return tag ? (
                          <span
                            key={tagId}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Tải xuống"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  
                  {(isAdmin || doc.uploadedBy === currentUser?.id) && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Xóa file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            {searchQuery || selectedTag ? (
              <>
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Không tìm thấy file nào</p>
                {(searchQuery || selectedTag) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTag('');
                    }}
                    className="text-sm text-green-600 hover:text-green-700 mt-1"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </>
            ) : (
              <>
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Chưa có file nào được chia sẻ</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Files;