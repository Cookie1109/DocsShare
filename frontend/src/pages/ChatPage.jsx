import React, { useState, useEffect, useRef } from 'react';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatArea from '../components/Chat/ChatArea';
import InvitationNotifications from '../components/Chat/InvitationNotifications';
import { useAuth } from '../contexts/AuthContext';
import { Users, Settings, LogOut, User, Edit2, Camera, X } from 'lucide-react';
import Logo from '../assets/Logo.png';

const ChatPage = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const [userName, setUserName] = useState('');
  const [userTag, setUserTag] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false); // Mobile view state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef(null);
  
  // Use AuthContext - consolidate all useAuth calls
  const { selectedGroup, selectGroup, user, logout, updateProfile } = useAuth();

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



  // Initialize user data when modal opens
  useEffect(() => {
    if (showUserProfileModal) {
      const fullName = user?.username || user?.name || '';
      // Split name and tag if exists
      if (fullName.includes('#')) {
        const [name, tag] = fullName.split('#');
        setUserName(name);
        setUserTag(tag);
      } else {
        setUserName(fullName);
        setUserTag('');
      }
      setUserAvatar(user?.avatar || null);
      setIsEditing(false);
      setSaveError('');
      setSaveSuccess(false);
    }
  }, [showUserProfileModal, user]);

  // Handle avatar change
  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSaveError('Ảnh không được vượt quá 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setSaveError('Vui lòng chọn file ảnh');
        return;
      }
      
      setSaveError('');
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle remove avatar
  const handleRemoveAvatar = () => {
    setUserAvatar(null);
  };

  // Handle save user info
  const handleSaveUserInfo = async () => {
    // Validation
    if (!userName.trim()) {
      setSaveError('Tên hiển thị không được để trống');
      return;
    }

    if (userName.trim().length < 2) {
      setSaveError('Tên hiển thị phải có ít nhất 2 ký tự');
      return;
    }

    if (userName.trim().length > 50) {
      setSaveError('Tên hiển thị không được vượt quá 50 ký tự');
      return;
    }

    if (userTag && userTag.length < 4) {
      setSaveError('Tag phải có ít nhất 4 chữ số');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      // Combine name and tag
      const fullName = userTag ? `${userName.trim()}#${userTag}` : userName.trim();
      
      const updatedData = {
        name: fullName,
        avatar: userAvatar
      };
      
      // Update user in auth context
      const result = await updateProfile(updatedData);
      
      if (result.success) {
        console.log('User updated successfully:', updatedData);
        setSaveSuccess(true);
        
        // Close modal after short delay
        setTimeout(() => {
          setShowUserProfileModal(false);
          setIsEditing(false);
          setSaveSuccess(false);
        }, 1500);
      } else {
        setSaveError(result.error || 'Không thể cập nhật thông tin');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setSaveError('Đã xảy ra lỗi. Vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancelEdit = () => {
    setShowUserProfileModal(false);
    const fullName = user?.username || user?.name || '';
    if (fullName.includes('#')) {
      const [name, tag] = fullName.split('#');
      setUserName(name);
      setUserTag(tag);
    } else {
      setUserName(fullName);
      setUserTag('');
    }
    setUserAvatar(user?.avatar || null);
    setIsEditing(false);
    setSaveError('');
    setSaveSuccess(false);
  };

  // Show skeleton loading while user data is loading
  if (user?.loading) {
    return (
      <div className="h-screen flex bg-green-50 overflow-hidden">
        <div className="w-80 bg-white shadow-sm border-r border-green-100 flex flex-col">
          {/* Header skeleton */}
          <div className="bg-white border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
          {/* Sidebar content skeleton */}
          <div className="flex-1 p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex-1 p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
      {/* Sidebar - Full screen on mobile when no chat selected, hidden when chat open */}
      <div className={`
        ${showMobileChat ? 'hidden sm:flex' : 'flex'}
        w-full sm:w-80 bg-white shadow-sm border-r border-green-100 flex-col transition-all duration-300
      `}>
        {/* Header với Logo DocsShare - Fixed */}
        <div className="bg-white border-b border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            {/* Logo và tên */}
            <div className="flex items-center flex-1 min-w-0">
              <div className="flex-shrink-0">
                <img 
                  src={Logo} 
                  alt="DocsShare Logo" 
                  className="w-10 h-10 rounded-lg"
                />
              </div>
              {/* Text - Always visible now */}
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-800">DocsShare</h1>
                <p className="text-gray-600 text-sm">Chia sẻ tài liệu</p>
              </div>
            </div>
            
            {/* Notification Bell */}
            <div>
              <InvitationNotifications />
            </div>

          </div>
        </div>
        
        {/* Sidebar content - Scrollable */}
        <div className="flex-1 overflow-hidden">
          <ChatSidebar 
            user={user}
            onGroupSelect={() => setShowMobileChat(true)}
          />
        </div>

        {/* User Footer */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="relative flex-shrink-0">
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
              {/* User info - Always visible now */}
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-800 text-sm truncate">{user?.username || user?.name || 'Người dùng'}</p>
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
      
      {/* Main Chat Area - Full screen on mobile when chat selected, normal on desktop */}
      <div className={`
        ${showMobileChat ? 'flex' : 'hidden sm:flex'}
        flex-1 flex-col overflow-hidden bg-white
      `}>
        <ChatArea 
          user={user}
          onBackClick={() => setShowMobileChat(false)}
          isMobileView={showMobileChat}
        />
      </div>

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Thông tin người dùng</h2>
              <button
                onClick={() => setShowUserProfileModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative group">
                  <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center overflow-hidden ring-4 ring-green-50">
                    {userAvatar ? (
                      <img 
                        src={userAvatar} 
                        alt="User Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-3xl">
                        {userName?.charAt(0).toUpperCase() || (user?.username || user?.name)?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white hover:bg-green-600 transition-all shadow-lg hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isSaving}
                  />
                  {/* Online indicator */}
                  <div className="absolute top-0 right-0 w-5 h-5 bg-green-400 rounded-full border-4 border-white"></div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-gray-500">Click vào biểu tượng camera để thay đổi ảnh đại diện</p>
                  {userAvatar && userAvatar !== user?.avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={isSaving}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                    >
                      Xóa ảnh đã chọn
                    </button>
                  )}
                </div>
              </div>

              {/* User Info Form */}
              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên hiển thị
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        setUserName(e.target.value);
                        setSaveError('');
                      }}
                      disabled={isSaving}
                      maxLength={50}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Nhập tên của bạn"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {userName.length}/50 ký tự
                  </p>
                </div>

                {/* Tag Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tag
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                      #
                    </div>
                    <input
                      type="text"
                      value={userTag}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setUserTag(value);
                        setSaveError('');
                      }}
                      disabled={isSaving}
                      maxLength={5}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="12345"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Tag giúp người khác tìm bạn dễ dàng hơn (4-5 chữ số)
                  </p>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || ''}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="email@example.com"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1.5">Email không thể thay đổi</p>
                </div>

                {/* Error Message */}
                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-2">
                    <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{saveError}</span>
                  </div>
                )}

                {/* Success Message */}
                {saveSuccess && (
                  <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Cập nhật thông tin thành công!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-5 py-2 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveUserInfo}
                disabled={!userName.trim() || isSaving}
                className="px-5 py-2 text-white font-medium bg-green-500 rounded-xl hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu thay đổi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
