import { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Loader2, Tag as TagIcon } from 'lucide-react';
import filesService from '../../services/filesService';
import { uploadFileToCloudinary, updateFile } from '../../services/fileVersionService';
import tagsService from '../../services/tagsService';
import TagSelector from './TagSelector';

// Convert Tailwind color class to hex
const getColorHex = (colorClass) => {
  const colorMap = {
    'bg-emerald-500': '#10b981',
    'bg-blue-500': '#3b82f6',
    'bg-purple-500': '#a855f7',
    'bg-pink-500': '#ec4899',
    'bg-red-500': '#ef4444',
    'bg-yellow-500': '#eab308',
    'bg-green-500': '#22c55e',
    'bg-indigo-500': '#6366f1',
    'bg-orange-500': '#f97316',
    'bg-teal-500': '#14b8a6',
    'bg-cyan-500': '#06b6d4',
    'bg-rose-500': '#f43f5e',
  };
  return colorMap[colorClass] || colorClass;
};

/**
 * UpdateFileModal - Dialog để cập nhật file và tags
 * Chỉ người upload mới thấy được dialog này
 */
export default function UpdateFileModal({ file, groupId, onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Tags state
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // Load tags when modal opens
  useEffect(() => {
    loadTags();
  }, [groupId]);

  const loadTags = async () => {
    try {
      setLoadingTags(true);
      const tags = await tagsService.getGroupTags(groupId);
      setAvailableTags(tags);
      
      console.log('Available tags:', tags);
      console.log('File tags:', file.tags);
      
      // Set selected tags from file's current tags with full tag info (including color)
      if (file.tags && file.tags.length > 0) {
        // Check if file.tags is array of IDs or array of objects
        const selectedTagsWithColors = file.tags.map(fileTag => {
          // If fileTag is just an ID (number), find the full tag object
          if (typeof fileTag === 'number') {
            return tags.find(t => t.id === fileTag);
          }
          // If fileTag is already an object, match by ID to get full info
          const fullTag = tags.find(t => t.id === fileTag.id);
          return fullTag || fileTag;
        }).filter(Boolean); // Remove any undefined values
        
        console.log('Selected tags with colors:', selectedTagsWithColors);
        setSelectedTags(selectedTagsWithColors);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => {
      const isSelected = prev.some(t => t.id === tag.id);
      if (isSelected) {
        return prev.filter(t => t.id !== tag.id);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Get file extension
  const getFileExtension = (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  };

  const currentExtension = getFileExtension(file.name);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    validateAndSetFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    validateAndSetFile(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const validateAndSetFile = (newFile) => {
    // Validate file type - phải cùng extension
    const newExtension = getFileExtension(newFile.name);
    if (newExtension.toLowerCase() !== currentExtension.toLowerCase()) {
      setError(`Vui lòng chọn file cùng định dạng (${currentExtension})`);
      return;
    }

    // Validate file size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (newFile.size > MAX_SIZE) {
      setError('File không được vượt quá 25MB');
      return;
    }

    setSelectedFile(newFile);
    setError(null);
  };

  const handleUpdate = async () => {
    console.log('🔄 handleUpdate called - selectedFile:', selectedFile, 'selectedTags:', selectedTags);
    
    if (!selectedFile) {
      // Nếu không có file mới, chỉ update tags
      console.log('📝 No new file, updating tags only');
      await handleUpdateTagsOnly();
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      console.log('📤 Starting file upload...');

      // Step 1: Get Cloudinary signature
      const signatureData = await filesService.getUploadSignature(
        selectedFile.name,
        selectedFile.size,
        selectedFile.type
      );

      // Step 2: Upload to Cloudinary
      const cloudinaryResponse = await uploadFileToCloudinary(
        selectedFile,
        signatureData,
        (progress) => {
          setUploadProgress(progress.percent);
        }
      );

      // Step 3: Update file via API
      const result = await updateFile(
        file.id,
        cloudinaryResponse.secure_url,
        selectedFile.size,
        selectedFile.type,
        selectedFile.name
      );

      // Step 4: Update tags if changed
      console.log('🏷️ Updating tags after file upload...');
      await updateFileTags();

      console.log('✅ File updated:', result);

      // Success callback
      if (onSuccess) {
        onSuccess(result.data);
      }

      onClose();

    } catch (err) {
      console.error('❌ Error updating file:', err);
      setError(err.message || 'Lỗi khi cập nhật file');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTagsOnly = async () => {
    console.log('🏷️ handleUpdateTagsOnly called - selectedTags:', selectedTags);
    
    try {
      setUploading(true);
      setError(null);

      console.log('📡 Sending tag update to API...');
      await updateFileTags();
      
      console.log('✅ Tags updated successfully');

      if (onSuccess) {
        onSuccess({ ...file, tags: selectedTags });
      }

      onClose();
    } catch (err) {
      console.error('❌ Error updating tags:', err);
      setError(err.message || 'Lỗi khi cập nhật tags');
      setUploading(false); // Reset uploading state on error
    } finally {
      setUploading(false);
    }
  };

  const updateFileTags = async () => {
    const tagIds = selectedTags.map(t => t.id);
    console.log('📡 updateFileTags - fileId:', file.id, 'tagIds:', tagIds);
    
    try {
      const result = await filesService.updateFileTags(file.id, tagIds);
      console.log('✅ updateFileTags API response:', result);
      return result;
    } catch (error) {
      console.error('❌ updateFileTags API error:', error);
      throw error;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const truncateFileName = (fileName, maxLength = 50) => {
    if (fileName.length <= maxLength) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return fileName.substring(0, maxLength - 3) + '...';
    }
    
    const extension = fileName.substring(lastDotIndex);
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    const availableLength = maxLength - extension.length - 4; // 4 for '... '
    
    if (availableLength < 10) {
      return fileName.substring(0, 10) + '... ' + extension;
    }
    
    return nameWithoutExt.substring(0, availableLength) + '... ' + extension;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Cập nhật file</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          

          {/* File Dropzone */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Chọn file mới
            </label>
            
            <div className="relative">
              <input
                type="file"
                id="file-input"
                accept={currentExtension}
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              
              <label
                htmlFor="file-input"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  flex flex-col items-center justify-center
                  border-2 border-dashed rounded-lg p-6
                  cursor-pointer transition-colors
                  ${dragOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : selectedFile 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Kéo thả file vào đây
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      hoặc click để chọn
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Chỉ chấp nhận: {currentExtension}
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            {/* Section Header */}
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TagIcon className="w-4 h-4" />
              Tags (tùy chọn)
            </label>

            {/* Current Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: getColorHex(tag.color) }}
                  >
                    # {tag.name}
                    <button
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      disabled={uploading}
                      className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag Selector - All Available Tags */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">
                Gán thẻ phân loại (tùy chọn)
              </label>
              
              {loadingTags ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : (
                <TagSelector
                  availableTags={availableTags}
                  selectedTags={selectedTags.map(t => {
                    console.log('UpdateFileModal - selectedTag:', t);
                    return t.id;
                  })}
                  onTagsChange={(tagIds) => {
                    console.log('UpdateFileModal - onTagsChange tagIds:', tagIds);
                    console.log('UpdateFileModal - availableTags:', availableTags);
                    const tags = availableTags.filter(t => tagIds.includes(t.id));
                    console.log('UpdateFileModal - filtered tags:', tags);
                    setSelectedTags(tags);
                  }}
                  onAddTag={(newTag) => {
                    if (newTag._deleted) {
                      // Tag was deleted, remove it from available tags
                      setAvailableTags(prev => prev.filter(t => t.id !== newTag.id));
                      // Also remove from selected tags if selected
                      setSelectedTags(prev => prev.filter(t => t.id !== newTag.id));
                    } else {
                      // New tag was created, add it to available tags
                      setAvailableTags(prev => [...prev, newTag]);
                    }
                  }}
                  groupId={groupId}
                  alwaysExpanded={true}
                  disabled={uploading}
                />
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Đang tải lên...</span>
                <span className="font-medium text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hủy
          </button>
          <button
            onClick={handleUpdate}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading 
              ? 'Đang cập nhật...' 
              : selectedFile 
                ? 'Cập nhật phiên bản' 
                : 'Lưu thay đổi'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
