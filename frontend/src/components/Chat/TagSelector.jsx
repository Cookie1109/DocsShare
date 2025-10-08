import React, { useState } from 'react';
import { X, Plus, Tag, Hash } from 'lucide-react';
import tagsService from '../../services/tagsService';

const TagSelector = ({ selectedTags, onTagsChange, availableTags, onAddTag, groupId, className = '' }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

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

  // Suggested quick tags for new users
  const suggestedTags = [
    { name: 'Bài tập', color: 'bg-red-500' },
    { name: 'Đồ án', color: 'bg-blue-500' },
    { name: 'Slide bài giảng', color: 'bg-green-500' },
    { name: 'Tài liệu tham khảo', color: 'bg-yellow-500' },
    { name: 'Code mẫu', color: 'bg-purple-500' },
    { name: 'Ôn tập', color: 'bg-pink-500' }
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
        availableTags.find(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())) {
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
      
      onAddTag(newTag);
      onTagsChange([...selectedTags, newTag.id]);
      setNewTagName('');
    } catch (error) {
      console.error('Error creating tag:', error);
      // You could add error handling here, like showing a toast
    } finally {
      setIsCreatingTag(false);
    }
  };

  const getSelectedTagsDisplay = () => {
    return availableTags.filter(tag => selectedTags.includes(tag.id));
  };

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      {/* Label */}
      <label className="block text-sm font-normal text-gray-700 mb-2">
        <Tag className="inline h-3.5 w-3.5 mr-1" />
        Gắn thẻ phân loại (tùy chọn)
      </label>

      {/* Quick suggestions for empty state */}
      {selectedTags.length === 0 && availableTags.length === 0 && !isDropdownOpen && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2 font-normal">Gợi ý thẻ phổ biến:</p>
          <div className="flex flex-wrap gap-1">
            {suggestedTags.map((tag, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const newTag = {
                    id: Date.now().toString() + index,
                    name: tag.name,
                    color: tag.color
                  };
                  onAddTag(newTag);
                  onTagsChange([newTag.id]);
                }}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs text-white ${tag.color} hover:opacity-80 transition-opacity`}
              >
                <Plus className="h-3 w-3 mr-1" />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
          onClick={(e) => e.stopPropagation()}
        >
          {/* Available tags */}
          <div className="p-3 flex-1 overflow-hidden pb-2">
            <div className="text-xs text-gray-600 mb-2 font-normal flex items-center">
              <Hash className="h-2.5 w-2.5 mr-1" />
              Thẻ đã có ({availableTags.length}):
            </div>
            {availableTags.length === 0 ? (
              <div className="text-sm text-gray-400 py-3 text-center">
                <Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Chưa có thẻ nào
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-2 pb-2" style={{pointerEvents: 'auto'}}>
                {availableTags.map(tag => (
                  <div key={tag.id}
                       onClick={(e) => {
                         e.stopPropagation();
                         handleTagToggle(tag);
                       }}
                       className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                         selectedTags.includes(tag.id) 
                           ? 'bg-green-50 border border-green-200 shadow-sm' 
                           : 'hover:bg-gray-50 border border-transparent'
                       }`}>
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
                {newTagName.trim() && availableTags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase()) && (
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
                      availableTags.find(tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase())
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
    </div>
  );
};

export default TagSelector;