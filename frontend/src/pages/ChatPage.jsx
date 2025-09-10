import React, { useState, useEffect } from 'react';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatArea from '../components/Chat/ChatArea';
import { useAuth } from '../contexts/AuthContext';
import { Rocket, Users, Settings } from 'lucide-react';

const ChatPage = () => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const { user } = useAuth();

  // Auto-select first group when component mounts
  useEffect(() => {
    // Default groups (same as in ChatSidebar)
    const defaultGroups = [
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
    ];

    // Auto-select first group when page loads
    if (!selectedGroup && defaultGroups.length > 0) {
      setSelectedGroup(defaultGroups[0]);
    }
  }, [selectedGroup]);

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mr-3">
              <Rocket className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-green-600">WebShare</h1>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Chào mừng đến với WebShare
          </h2>
          <p className="text-gray-600 mb-6">
            Ứng dụng đang chạy thành công!
          </p>
          
          <button 
            onClick={() => window.location.href = '/login'}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-green-50 to-white overflow-hidden">
      {/* Sidebar với header WebShare */}
      <div className="w-80 bg-white shadow-lg border-r border-green-100 flex flex-col">
        {/* Header với Logo WebShare - Fixed */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Logo và tên */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-3">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">WebShare</h1>
                <p className="text-green-100 text-xs">Ứng dụng đang chạy thành công!</p>
              </div>
            </div>
            
            {/* User info compact */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Sidebar content - Scrollable */}
        <div className="flex-1 overflow-hidden">
          <ChatSidebar 
            user={user}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
          />
        </div>
      </div>
      
      {/* Main Chat Area - Fixed height */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatArea 
          selectedGroup={selectedGroup}
          user={user}
        />
      </div>
    </div>
  );
};

export default ChatPage;
