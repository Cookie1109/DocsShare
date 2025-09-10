import React, { useState, useEffect } from 'react';
import { Search, Plus, Users, FileText, MoreVertical, Hash } from 'lucide-react';

const ChatSidebar = ({ user, selectedGroup, onSelectGroup }) => {
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      const newGroup = {
        id: Date.now().toString(),
        name: newGroupName.trim(),
        avatar: null,
        memberCount: 1,
        lastDocument: null,
        unreadCount: 0,
        type: 'group'
      };
      setGroups([...groups, newGroup]);
      setNewGroupName('');
      setShowCreateGroup(false);
    }
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
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div
            key={group.id}
            onClick={() => onSelectGroup(group)}
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
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                    <Hash className="h-6 w-6 text-white" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tạo nhóm mới
            </h3>
            
            <input
              type="text"
              placeholder="Tên nhóm..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
              autoFocus
            />
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupName('');
                }}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
