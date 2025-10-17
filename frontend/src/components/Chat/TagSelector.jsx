import React, { useState, useEffect } from 'react';
import { X, Plus, Tag, Hash, Trash2, AlertTriangle } from 'lucide-react';
import tagsService from '../../services/tagsService';

const TagSelector = ({ selectedTags, onTagsChange, availableTags, onAddTag, groupId, className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  
  // Delete confirmation state
  const [tagToDelete, setTagToDelete] = useState(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  
  // Local state to ensure immediate updates
  const [localTags, setLocalTags] = useState(availableTags);
  
  // Sync local tags with props
  useEffect(() => {
    setLocalTags(availableTags);
  }, [availableTags]);

  // Predefined tag colors
  const tagColors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500'
  ];

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag.id)) {
      const newTags = selectedTags.filter(id => id !== tag.id);
      console.log(`🏷️ Removed tag ${tag.id} (${tag.name}), selectedTags:`, newTags);
      onTagsChange(newTags);
    } else {
      const newTags = [...selectedTags, tag.id];
      console.log(`🏷️ Added tag ${tag.id} (${tag.name}), selectedTags:`, newTags);
      onTagsChange(newTags);
    }
  };

  const handleCreateNewTag = async () => {
    const trimmedName = newTagName.trim();
    
    // Validation - button should be disabled so this shouldn't run with invalid input
    if (!trimmedName || 
        trimmedName.length > 20 || 
        localTags.find(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())) {
      return;
    }
    
    if (!groupId) {
      console.error('No group selected for creating tag');
      return;
    }

    setIsCreatingTag(true);
    
    try {
      // Create new tag via API
      const newTag = await tagsService.createTag(groupId, {
        name: trimmedName,
        color: tagColors[Math.floor(Math.random() * tagColors.length)]
      });
      
      console.log('🎉 New tag created:', newTag);
      console.log('📋 Current localTags before update:', localTags);
      
      // Update local tags immediately for instant UI update
      setLocalTags(prev => {
        const updated = [...prev, newTag];
        console.log('📋 Updated localTags:', updated);
        return updated;
      });
      
      // Notify parent
      onAddTag(newTag);
      onTagsChange([...selectedTags, newTag.id]);
      setNewTagName('');
      
      console.log('✅ Tag added to selection and local list, tagId:', newTag.id);
    } catch (error) {
      console.error('Error creating tag:', error);
      // You could add error handling here, like showing a toast
    } finally {
      setIsCreatingTag(false);
    }
  };

  const getSelectedTagsDisplay = () => {
    const selected = localTags.filter(tag => selectedTags.includes(tag.id));
    console.log('🔍 getSelectedTagsDisplay - selectedTags:', selectedTags, 'localTags count:', localTags.length, 'found:', selected);
    return selected;
  };

  const handleDeleteTag = async (tagToDelete) => {
    if (!tagToDelete || !groupId) return;
    
    setIsDeletingTag(true);
    
    try {
      console.log(`🗑️ Deleting tag: ${tagToDelete.name} (ID: ${tagToDelete.id})`);
      
      // Call API to delete tag
      const result = await tagsService.deleteTag(groupId, tagToDelete.id);
      
      console.log(`✅ Tag deleted successfully. ${result.filesAffected} file(s) affected.`);
      
      // Remove from local tags immediately (optimistic update)
      setLocalTags(prev => prev.filter(t => t.id !== tagToDelete.id));
      
      // Remove from selected tags if it was selected
      if (selectedTags.includes(tagToDelete.id)) {
        onTagsChange(selectedTags.filter(id => id !== tagToDelete.id));
      }
      
      // Notify parent to update their state
      if (onAddTag) {
        // Use negative ID to signal deletion
        onAddTag({ id: tagToDelete.id, _deleted: true });
      }
      
      // Close confirmation dialog
      setTagToDelete(null);
      
    } catch (error) {
      console.error('❌ Error deleting tag:', error);
      alert(`Không thể xóa tag: ${error.message}`);
    } finally {
      setIsDeletingTag(false);
    }
  };

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      {/* Label */}
      <label className="block text-sm font-normal text-gray-700 mb-2">
        <Tag className="inline h-3.5 w-3.5 mr-1" />
        Gắn thẻ phân loại (tùy chọn)
      </label>

      {/* Selected tags display */}
      <div className="min-h-[40px] border border-gray-300 rounded-lg p-2 bg-white cursor-pointer hover:border-gray-400 transition-colors"
           onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
        {selectedTags.length === 0 ? (
          <div className="flex items-center text-gray-400 text-sm">
            <Tag className="h-3.5 w-3.5 mr-2" />
            <span>Click để chọn thẻ...</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {getSelectedTagsDisplay().map(tag => (
              <span key={tag.id} 
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs text-white ${tag.color}`}>
                <Hash className="h-2.5 w-2.5 mr-1" />
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTagToggle(tag);
                  }}
                  className="ml-1 hover:bg-white hover:bg-opacity-20 rounded-full p-0.5"
                  title="Bỏ thẻ này"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div 
          className="relative z-40 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 flex flex-col"
          onClick={(e) => {
            e.stopPropagation();
            console.log('📂 Dropdown opened - localTags:', localTags.map(t => ({id: t.id, name: t.name})));
          }}
        >
          {/* Available tags */}
          <div className="p-3 flex-1 overflow-hidden pb-2">
            <div className="text-xs text-gray-600 mb-2 font-normal flex items-center">
              <Hash className="h-2.5 w-2.5 mr-1" />
              Thẻ đã có ({localTags.length}):
            </div>
            {localTags.length === 0 ? (
              <div className="text-sm text-gray-400 py-3 text-center">
                <Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Chưa có thẻ nào
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-2 pb-2" style={{pointerEvents: 'auto'}}>
                {localTags.map(tag => (
                  <div key={tag.id}
                       className={`flex items-center p-2 rounded transition-colors group ${
                         selectedTags.includes(tag.id) 
                           ? 'bg-green-50 border border-green-200 shadow-sm' 
                           : 'hover:bg-gray-50 border border-transparent'
                       }`}>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagToggle(tag);
                      }}
                      className="flex items-center flex-1 cursor-pointer"
                    >
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs text-white ${tag.color} mr-3`}>
                        <Hash className="h-2.5 w-2.5 mr-1" />
                        {tag.name}
                      </span>
                      {selectedTags.includes(tag.id) ? (
                        <span className="ml-auto text-green-600 text-sm font-normal">✓</span>
                      ) : (
                        <span className="ml-auto text-gray-400 text-xs">Click</span>
                      )}
                    </div>
                    
                    {/* Delete button - hiện khi hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagToDelete(tag);
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Xóa thẻ này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new tag */}
          <div className="border-t border-gray-200 p-3 pt-4 bg-gray-50 flex-shrink-0">
            {!isCreatingTag ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreatingTag(true);
                }}
                className="flex items-center justify-center text-sm text-green-600 hover:text-green-700 w-full p-2 rounded-lg hover:bg-green-100 transition-colors border border-dashed border-green-300"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tạo thẻ mới
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateNewTag();
                      } else if (e.key === 'Escape') {
                        setIsCreatingTag(false);
                        setNewTagName('');
                      }
                    }}
                    placeholder="Nhập tên thẻ..."
                    maxLength={20}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      newTagName.length > 15 
                        ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500' 
                        : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                    }`}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {newTagName.length}/20
                  </div>
                </div>
                
                {/* Duplicate check warning */}
                {newTagName.trim() && localTags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase()) && (
                  <div className="text-xs text-red-500 flex items-center">
                    <span className="mr-1">⚠️</span>
                    Thẻ này đã tồn tại
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNewTag();
                    }}
                    disabled={
                      !newTagName.trim() || 
                      newTagName.trim().length > 20 ||
                      localTags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase())
                    }
                    className="flex-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Tạo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingTag(false);
                      setNewTagName('');
                    }}
                    className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => {
            setIsDropdownOpen(false);
            setIsCreatingTag(false);
            setNewTagName('');
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {tagToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Xóa thẻ phân loại</h3>
                </div>
                <button 
                  onClick={() => setTagToDelete(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                  disabled={isDeletingTag}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-3">
                  Bạn có chắc chắn muốn xóa thẻ này không?
                </p>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm text-white ${tagToDelete.color}`}>
                    <Hash className="h-3 w-3 mr-1" />
                    {tagToDelete.name}
                  </span>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-sm">
                  <strong>⚠️ Lưu ý:</strong> Thẻ này sẽ được xóa khỏi tất cả các file đang sử dụng.
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">
                  <strong>🗑️ Cảnh báo:</strong> Hành động này không thể hoàn tác!
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={() => setTagToDelete(null)}
                  disabled={isDeletingTag}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteTag(tagToDelete)}
                  disabled={isDeletingTag}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-400 transition-colors font-medium flex items-center justify-center"
                >
                  {isDeletingTag ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xóa thẻ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagSelector;