import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, UserPlus, Loader, Check, AlertCircle } from 'lucide-react';
import { auth } from '../../config/firebase';

const AddMemberModal = ({ isOpen, onClose, groupId, groupName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const searchInputRef = React.useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('✅ AddMemberModal opened - Resetting form');
      // Reset all states
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers([]);
      setError('');
      setSuccess('');
      setIsSearching(false);
      
      // Focus search input after a short delay (wait for render)
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('🔍 Searching for:', searchQuery);
    setIsSearching(true);
    setError(''); // Clear previous errors
    
    const timeoutId = setTimeout(async () => {
      try {
        console.log('🌐 Making API request...');
        const token = await auth.currentUser.getIdToken();
        
        const response = await fetch(
          `http://localhost:5000/api/firebase-users/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        console.log('📡 Response status:', response.status);

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        console.log('✅ Search results:', data.data);
        setSearchResults(data.data || []);
      } catch (err) {
        console.error('❌ Search error:', err);
        setError('Không thể tìm kiếm người dùng');
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleToggleUser = (user) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.uid === user.uid);
      if (exists) {
        return prev.filter(u => u.uid !== user.uid);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) return;

    setIsSending(true);
    setError('');
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch('http://localhost:5000/api/firebase-users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          groupId: groupId,
          userIds: selectedUsers.map(u => u.uid)
        })
      });

      if (!response.ok) throw new Error('Failed to send invitations');

      const data = await response.json();
      
      setSuccess(`Đã gửi lời mời đến ${selectedUsers.length} người dùng!`);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setSelectedUsers([]);
        setSearchQuery('');
        setSearchResults([]);
        setSuccess('');
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Send invitation error:', err);
      setError('Không thể gửi lời mời. Vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-green-600" />
              Thêm thành viên
            </h2>
            <p className="text-sm text-gray-600 mt-1">vào nhóm <span className="font-semibold text-gray-900">"{groupName}"</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc tag (VD: NhanTrong#1234)"
              className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base bg-white"
            />
            {isSearching && (
              <Loader className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500 animate-spin" />
            )}
          </div>
          
          {/* Hint */}
          <p className="mt-2 text-xs text-gray-500">
            💡 Mẹo: Tìm chính xác hơn với tag đầy đủ (VD: #1234)
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                Kết quả tìm kiếm 
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                  {searchResults.length}
                </span>
              </h3>
              <div className="space-y-3">
                {searchResults.map(user => {
                  const isSelected = selectedUsers.find(u => u.uid === user.uid);
                  
                  return (
                    <div
                      key={user.uid}
                      onClick={() => handleToggleUser(user)}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold shadow-sm">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* User Info */}
                        <div>
                          <p className="font-medium text-gray-900">{user.displayName}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>

                      {/* Select Button */}
                      <div>
                        {isSelected ? (
                          <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                        ) : (
                          <button className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
                            Thêm
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Không tìm thấy người dùng</p>
              <p className="text-sm text-gray-400 mt-1">Thử tìm kiếm với tag khác</p>
            </div>
          )}

          {/* Empty State */}
          {searchQuery.length < 2 && searchResults.length === 0 && (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Nhập tên hoặc tag để tìm kiếm</p>
              <p className="text-sm text-gray-400 mt-1">Ví dụ: NhanTrong#1234</p>
            </div>
          )}

          {/* Selected Users Summary */}
          {selectedUsers.length > 0 && (
            <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Đã chọn {selectedUsers.length} người
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <span
                    key={user.uid}
                    className="inline-flex items-center px-3 py-1 bg-white rounded text-sm text-gray-700 border border-gray-300"
                  >
                    {user.displayName}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleUser(user);
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center">
            <Check className="h-4 w-4 mr-2" />
            {success}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-6 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 border border-gray-300"
          >
            Hủy
          </button>
          <button
            onClick={handleSendInvitations}
            disabled={selectedUsers.length === 0 || isSending}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSending ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Gửi lời mời ({selectedUsers.length})
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AddMemberModal;
