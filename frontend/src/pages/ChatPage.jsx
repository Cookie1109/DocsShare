import React, { useState, useEffect, useRef } from 'react';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatArea from '../components/Chat/ChatArea';
import { useAuth } from '../contexts/AuthContext';
import { Users, Settings, LogOut, User, Edit2, Camera, X } from 'lucide-react';
import Logo from '../assets/Logo.png';

const ChatPage = () => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const [userName, setUserName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const { user, logout, updateProfile } = useAuth();
  const fileInputRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

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

  // Initialize user data when modal opens
  useEffect(() => {
    if (showUserProfileModal) {
      setUserName(user?.username || user?.name || '');
      setUserAvatar(user?.avatar || null);
      setIsEditing(false);
    }
  }, [showUserProfileModal, user]);

  // Handle avatar change
  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle save user info
  const handleSaveUserInfo = async () => {
    try {
      const updatedData = {
        name: userName,
        avatar: userAvatar
      };
      
      // Update user in auth context
      const result = await updateProfile(updatedData);
      
      if (result.success) {
        console.log('User updated successfully:', updatedData);
        // Close modal
        setShowUserProfileModal(false);
        setIsEditing(false);
      } else {
        console.error('Failed to update user:', result.error);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-green-50">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-lg border border-green-100">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <img 
                src={Logo} 
                alt="DocsShare Logo" 
                className="w-16 h-16 rounded-xl shadow-md"
              />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-green-800 mb-3">
            DocsShare
          </h1>
          <p className="text-green-600 mb-10 text-lg">
            Nền tảng chia sẻ tài liệu học tập chuyên nghiệp
          </p>
          
          <button 
            onClick={() => window.location.href = '/login'}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-green-50 overflow-hidden">
      {/* Sidebar với header DocsShare */}
      <div className="w-80 bg-white shadow-sm border-r border-green-100 flex flex-col">
        {/* Header với Logo DocsShare - Fixed */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            {/* Logo và tên */}
            <div className="flex items-center">
              <div className="mr-3">
                <img 
                  src={Logo} 
                  alt="DocsShare Logo" 
                  className="w-10 h-10 rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">DocsShare</h1>
                <p className="text-gray-600 text-sm">Chia sẻ tài liệu</p>
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

        {/* User Footer */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="relative">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200 overflow-hidden">
                  {user?.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt="User Avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-emerald-700 font-medium text-sm">
                      {(user?.username || user?.name)?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-800 text-sm">{user?.username || user?.name || 'Người dùng'}</p>
                <p className="text-gray-500 text-xs">Đang hoạt động</p>
              </div>
              <Settings className="w-4 h-4 text-gray-400" />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserProfileModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-4 h-4" />
                    <span>Thông tin người dùng</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Chat Area - Fixed height */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <ChatArea 
          selectedGroup={selectedGroup}
          user={user}
        />
      </div>

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Thông tin người dùng</h2>
              <button
                onClick={() => setShowUserProfileModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200 overflow-hidden">
                    {userAvatar ? (
                      <img 
                        src={userAvatar} 
                        alt="User Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-emerald-700 font-semibold text-2xl">
                        {userName?.charAt(0).toUpperCase() || (user?.username || user?.name)?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-colors"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Click vào biểu tượng camera để thay đổi ảnh đại diện</p>
                  {userAvatar && userAvatar !== user?.avatar && (
                    <button
                      onClick={() => setUserAvatar(null)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>

              {/* User Info Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên hiển thị
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="Nhập tên của bạn"
                    />
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  {isEditing && (
                    <p className="text-xs text-emerald-600 mt-1">Đang chỉnh sửa tên hiển thị</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    placeholder="email@example.com"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Email không thể thay đổi</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-left">
                {(userName !== (user?.username || user?.name) || userAvatar !== user?.avatar) && (
                  <p className="text-xs text-amber-600">Có thay đổi chưa được lưu</p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowUserProfileModal(false);
                    setUserName(user?.username || user?.name || '');
                    setUserAvatar(user?.avatar || null);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveUserInfo}
                  disabled={!userName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
