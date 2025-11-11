import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Filter, Download, Eye, Trash2, 
  FileText, File, FileImage, FileSpreadsheet, FileCode, 
  Archive, Paperclip, MoreVertical, Calendar, User,
  SortAsc, SortDesc, X, Loader, Tag as TagIcon
} from 'lucide-react';
import { useGroupFiles } from '../../../hooks/useGroupFiles';
import tagsService from '../../../services/tagsService';
import filesService from '../../../services/filesService';
import { auth } from '../../../config/firebase';

const Files = ({ groupId, isAdmin }) => {
  const { files, loading: filesLoading, deleteFile, refreshFiles } = useGroupFiles(groupId);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'name', 'size'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState(null);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (groupId && refreshFiles) {
      refreshFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Load tags for the group
  useEffect(() => {
    const loadTags = async () => {
      if (!groupId) return;
      
      setLoadingTags(true);
      try {
        const groupTags = await tagsService.getGroupTags(groupId);
        setTags(groupTags || []);
      } catch (error) {
        console.error('Error loading tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };
    
    loadTags();
  }, [groupId]);

  // Get file icon based on type
  const getFileIcon = (type) => {
    const lowerType = type.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(lowerType)) {
      return <FileImage className="h-5 w-5 text-orange-500" />;
    } else if (['pdf', 'doc', 'docx', 'txt'].includes(lowerType)) {
      return <FileText className="h-5 w-5 text-orange-600" />;
    } else if (['xls', 'xlsx', 'csv'].includes(lowerType)) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    } else if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(lowerType)) {
      return <FileCode className="h-5 w-5 text-blue-600" />;
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(lowerType)) {
      return <Archive className="h-5 w-5 text-purple-600" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  // Filter and sort files with priority search
  const filteredFiles = (files || [])
    .map(file => {
      if (!searchQuery) {
        return { ...file, searchScore: 0 };
      }
      
      const searchLower = searchQuery.toLowerCase();
      let score = 0;
      
      // Priority 1: Name match (highest)
      if (file.name.toLowerCase().includes(searchLower)) {
        score = 100;
        // Bonus if starts with search query
        if (file.name.toLowerCase().startsWith(searchLower)) {
          score = 150;
        }
      }
      // Priority 2: Tag match
      else if (file.tags?.some(tagId => {
        const tag = tags.find(t => t.id === tagId);
        return tag && tag.name.toLowerCase().includes(searchLower);
      })) {
        score = 50;
      }
      // Priority 3: File type match
      else if (file.type.toLowerCase().includes(searchLower)) {
        score = 30;
      }
      // Priority 4: Uploader match
      else if (file.uploadedBy.toLowerCase().includes(searchLower)) {
        score = 20;
      }
      
      return { ...file, searchScore: score };
    })
    .filter(file => {
      // Search filter - keep if no search query or has match
      const matchesSearch = !searchQuery || file.searchScore > 0;
      
      // Tag filter
      const matchesTag = !selectedTagId || 
                        (file.tags && file.tags.includes(selectedTagId));
      
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      // If searching, sort by search score first
      if (searchQuery && a.searchScore !== b.searchScore) {
        return b.searchScore - a.searchScore;
      }
      
      // Then by selected sort option
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'size') {
        const sizeA = parseFloat(a.size);
        const sizeB = parseFloat(b.size);
        comparison = sizeA - sizeB;
      } else if (sortBy === 'date') {
        comparison = new Date(a.uploadedAt) - new Date(b.uploadedAt);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDownload = async (file) => {
    console.log('🔽 Downloading file from sidebar:', file.name);
    
    try {
      // Track download in backend (async - không chờ để không làm chậm download)
      filesService.trackDownload(file.id).then(result => {
        if (result.success) {
          console.log(`✅ Download tracked: ${file.name} - Count: ${result.data.downloadCount}`);
          // Refresh file list để cập nhật số downloads
          if (refreshFiles) {
            refreshFiles();
          }
        } else {
          console.warn('⚠️ Failed to track download:', result.error);
        }
      }).catch(err => {
        console.warn('⚠️ Track download error:', err);
      });

      // Download file bằng cách fetch và tạo blob
      const response = await fetch(file.url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Download completed for:', file.name);
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Không thể tải xuống file. Vui lòng thử lại.');
    }
  };

  const handleDeleteClick = (file) => {
    setSelectedFile(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteFile(selectedFile.id);
      
      if (result.success) {
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
        notification.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Đã xóa file thành công</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
        
        setShowDeleteModal(false);
        setSelectedFile(null);
      } else {
        throw new Error(result.message || 'Xóa file thất bại');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>${error.message || 'Không thể xóa file'}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const toggleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Helper function to determine if a color is light or dark
  const isLightColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  if (filesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Search and Filters */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-orange-500" />
            File đã chia sẻ ({filteredFiles.length})
          </h3>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <TagIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <button
              onClick={() => setSelectedTagId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                !selectedTagId
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tất cả ({files?.length || 0})
            </button>
            {tags.map((tag) => {
              const fileCount = (files || []).filter(f => f.tags && f.tags.includes(tag.id)).length;
              const isActive = selectedTagId === tag.id;
              
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                    isActive
                      ? 'shadow-md border-gray-300'
                      : 'border-transparent hover:shadow-sm'
                  }`}
                  style={{
                    backgroundColor: isActive ? tag.color : `${tag.color}20`,
                    color: isActive ? '#1f2937' : tag.color,
                    fontWeight: isActive ? '600' : '500'
                  }}
                >
                  {tag.name} ({fileCount})
                </button>
              );
            })}
          </div>
        )}

        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-shrink-0">Sắp xếp:</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => toggleSort('date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                sortBy === 'date'
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Ngày
              {sortBy === 'date' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
            </button>
            <button
              onClick={() => toggleSort('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                sortBy === 'name'
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
            >
              Tên
              {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
            </button>
            <button
              onClick={() => toggleSort('size')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                sortBy === 'size'
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
            >
              Dung lượng
              {sortBy === 'size' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
            </button>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="h-20 w-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
              <Paperclip className="h-10 w-10 text-orange-300" />
            </div>
            <p className="text-gray-500 text-sm text-center">
              {searchQuery ? 'Không tìm thấy file nào' : 'Chưa có file nào được chia sẻ'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredFiles.map((file) => {
              const currentUserId = auth.currentUser?.uid;
              const canDelete = isAdmin || file.isOwn;

              return (
                <div
                  key={file.id}
                  className="group bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md hover:border-orange-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* File Icon */}
                    <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                      {getFileIcon(file.type)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm truncate group-hover:text-orange-600 transition-colors">
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {file.uploadedBy}
                        </span>
                        <span>•</span>
                        <span>{file.size}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(file.uploadedAt)}
                        </span>
                      </div>
                      {file.downloads > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-orange-600">
                          <Download className="h-3 w-3" />
                          <span>{file.downloads} lượt tải</span>
                        </div>
                      )}
                      {/* Tags */}
                      {file.tags && file.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {file.tags.map((tagId) => {
                            const tag = tags.find(t => t.id === tagId);
                            if (!tag) return null;
                            return (
                              <span
                                key={tagId}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  color: tag.color,
                                  border: `1px solid ${tag.color}40`
                                }}
                              >
                                <TagIcon className="h-2.5 w-2.5 mr-1" />
                                {tag.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Tải xuống"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteClick(file)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Xóa file</h3>
                <p className="text-sm text-gray-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.type)}
                <span className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{selectedFile.size}</p>
            </div>
            
            <p className="text-gray-700 mb-6">
              Bạn có chắc chắn muốn xóa file này không?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedFile(null);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  'Xóa file'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Files;