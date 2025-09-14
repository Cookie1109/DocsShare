import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Users, FileText, MoreVertical, Hash } from 'lucide-react';

const ChatSidebar = ({ user, selectedGroup, onSelectGroup }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const groupsListRef = useRef(null);
  const groupRefs = useRef({});
  const [groups, setGroups] = useState([
    {
      id: '1',
      name: 'Lập trình React',
      avatar: null,
      memberCount: 24,
      lastDocument: {
        name: 'React Hooks Guide.pdf',
        time: '14:30',
        uploader: 'Nguyễn Văn A'
      },
      unreadCount: 3,
      type: 'group'
    },
    {
      id: '2', 
      name: 'Toán cao cấp A1',
      avatar: null,
      memberCount: 45,
      lastDocument: {
        name: 'Bài tập chương 3.docx',
        time: '09:15',
        uploader: 'Trần Thị B'
      },
      unreadCount: 0,
      type: 'group'
    },
    {
      id: '3',
      name: 'Tài liệu CNTT',
      avatar: null,
      memberCount: 67,
      lastDocument: {
        name: 'Database Design.pptx',
        time: 'Hôm qua',
        uploader: 'Lê Văn C'
      },
      unreadCount: 1,
      type: 'group'
    }
  ]);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle group selection with search reset and scroll
  const handleGroupSelect = (group) => {
    // Reset search query
    setSearchQuery('');
    
    // Call the original onSelectGroup
    onSelectGroup(group);
    
    // Scroll to the group in the full list after a small delay
    setTimeout(() => {
      const groupElement = groupRefs.current[group.id];
      if (groupElement && groupsListRef.current) {
        groupElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewGroupImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = () => {
    const groupName = newGroupName.trim() || `Nhóm của ${user?.name || 'Bạn'}`;
    
    const newGroup = {
      id: Date.now().toString(),
      name: groupName,
      avatar: imagePreview, // Use preview URL for display
      memberCount: 1,
      lastDocument: null,
      unreadCount: 0,
      type: 'group',
      createdBy: user?.name || 'Bạn',
      createdAt: new Date().toISOString()
    };
    
    setGroups([...groups, newGroup]);
    
    // Reset form
    setNewGroupName('');
    setNewGroupImage(null);
    setImagePreview(null);
    setShowCreateGroup(false);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Search và Create Group - Fixed */}
      <div className="p-4 border-b border-green-100 flex-shrink-0">
        {/* Search Bar */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm nhóm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* Create Group Button */}
        <button
          onClick={() => setShowCreateGroup(true)}
          className="w-full flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">Tạo nhóm mới</span>
        </button>
      </div>

      {/* Groups List */}
      <div ref={groupsListRef} className="flex-1 overflow-y-auto">
        {(searchQuery ? filteredGroups : groups).map((group) => (
          <div
            key={group.id}
            ref={el => groupRefs.current[group.id] = el}
            onClick={() => handleGroupSelect(group)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-green-50 ${
              selectedGroup?.id === group.id 
                ? 'bg-green-100 border-l-4 border-l-green-500' 
                : 'hover:bg-green-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Group Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center overflow-hidden">
                    {group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-semibold">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">
                      {group.name}
                    </h3>
                    {group.lastDocument && (
                      <span className="text-xs text-gray-500 ml-2">
                        {group.lastDocument.time}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {group.memberCount} thành viên
                      </span>
                    </div>
                    
                    {group.unreadCount > 0 && (
                      <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 font-medium">
                        {group.unreadCount}
                      </span>
                    )}
                  </div>
                  
                  {group.lastDocument && (
                    <div className="mt-1">
                      <p className="text-xs text-gray-600 truncate">
                        <FileText className="h-3 w-3 inline mr-1" />
                        {group.lastDocument.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="p-8 text-center">
            <Hash className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'Không tìm thấy nhóm nào' : 'Chưa có nhóm nào'}
            </p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-white bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 mx-4 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tạo nhóm mới
            </h3>
            
            {/* Group Image Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ảnh nhóm (tùy chọn)
              </label>
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="groupImageInput"
                  />
                  <label
                    htmlFor="groupImageInput"
                    className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Chọn ảnh
                  </label>
                  {imagePreview && (
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setNewGroupImage(null);
                      }}
                      className="ml-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Group Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên nhóm
              </label>
              <input
                type="text"
                placeholder={`Nhóm của ${user?.name || 'Bạn'} (mặc định)`}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Để trống sẽ sử dụng tên mặc định
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupName('');
                  setImagePreview(null);
                  setNewGroupImage(null);
                }}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateGroup}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
