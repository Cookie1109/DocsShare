import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, UserPlus, Loader, Check, AlertCircle } from 'lucide-react';
import { auth } from '../../config/firebase';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

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

  // Debounced search - Search directly from Firebase
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('🔍 Searching Firebase for:', searchQuery);
    setIsSearching(true);
    setError('');
    
    const timeoutId = setTimeout(async () => {
      try {
        const db = getFirestore();
        const usersRef = collection(db, 'users');
        
        // Parse search query
        const searchTrimmed = searchQuery.trim();
        let searchName = '';
        let searchTag = '';
        
        // Check if query contains '#' (tag separator)
        if (searchTrimmed.includes('#')) {
          const parts = searchTrimmed.split('#');
          searchName = parts[0].toLowerCase().trim();
          searchTag = parts[1] ? parts[1].toLowerCase().trim() : '';
          console.log('🏷️ Searching by name + tag:', { searchName, searchTag });
        } else if (searchTrimmed.startsWith('#')) {
          // Search by tag only (#2200)
          searchTag = searchTrimmed.substring(1).toLowerCase().trim();
          console.log('🏷️ Searching by tag only:', searchTag);
        } else {
          // Search by name only (Cookie)
          searchName = searchTrimmed.toLowerCase();
          console.log('👤 Searching by name only:', searchName);
        }
        
        // Get all users and filter client-side
        const q = query(usersRef, limit(100));
        const snapshot = await getDocs(q);
        
        const results = [];
        snapshot.forEach(doc => {
          const userData = doc.data();
          const displayName = (userData.displayName || '').toLowerCase();
          const username = (userData.username || '').toLowerCase(); // Username field (Cookie#2200)
          const email = (userData.email || '').toLowerCase();
          const userTag = (userData.userTag || '').toLowerCase(); // userTag field (2200)
          
          let matches = false;
          
          if (searchName && searchTag) {
            // Both name and tag provided (Cookie#2200)
            matches = displayName.includes(searchName) && userTag.includes(searchTag);
          } else if (searchTag) {
            // Tag only (#2200)
            matches = userTag.includes(searchTag);
          } else if (searchName) {
            // Name only (Cookie) - search in displayName, username, or email
            matches = displayName.includes(searchName) || 
                     username.includes(searchName) || 
                     email.includes(searchName);
          }
          
          // Don't include current user in search results
          if (matches && doc.id !== auth.currentUser?.uid) {
            results.push({
              uid: doc.id,
              displayName: userData.displayName || 'Unknown',
              username: userData.username || '',
              email: userData.email || '',
              photoURL: userData.photoURL || userData.avatar || null,
              userTag: userData.userTag || '' // Include userTag in results
            });
          }
        });
        
        console.log('✅ Firebase search results:', results.length, 'users found');
        console.log('📋 Results:', results);
        setSearchResults(results);
      } catch (err) {
        console.error('❌ Firebase search error:', err);
        setError('Không thể tìm kiếm người dùng từ Firebase');
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
      
      // Close modal immediately
      onClose();
      
      // Show notification in top-right corner
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-purple-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Đã gửi lời mời đến ${selectedUsers.length} người dùng</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Thêm thành viên
            </h2>
            <p className="text-sm text-gray-500 mt-1">vào nhóm <span className="font-medium text-gray-700">"{groupName}"</span></p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 pt-5 pb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc tag (VD: Name#1234)"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm placeholder:text-gray-400"
            />
            {isSearching && (
              <Loader className="absolute right-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500 animate-spin" />
            )}
          </div>
          
          {/* Hint */}
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <span className="text-yellow-500">💡</span>
            Mẹo: Tìm chính xác hơn với tên và tag đầy đủ (VD: Name#1234)
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-4">
              <div className="space-y-2">
                {searchResults.map(user => {
                  const isSelected = selectedUsers.find(u => u.uid === user.uid);
                  
                  return (
                    <div
                      key={user.uid}
                      onClick={() => handleToggleUser(user)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
                          {user.photoURL ? (
                            <img 
                              src={user.photoURL} 
                              alt={user.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{user.displayName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        
                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 text-sm truncate">{user.displayName}</p>
                            {user.userTag && (
                              <span className="text-xs text-gray-500 font-mono flex-shrink-0">#{user.userTag}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* Select Button */}
                      <div className="flex-shrink-0 ml-3">
                        {isSelected ? (
                          <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full border-2 border-gray-300 flex items-center justify-center">
                            <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                          </div>
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
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Không tìm thấy người dùng</p>
              <p className="text-sm text-gray-400 mt-1">Thử tìm kiếm với tag khác</p>
            </div>
          )}

          {/* Empty State */}
          {searchQuery.length < 2 && searchResults.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-gray-600 font-medium">Nhập tên hoặc tag để tìm kiếm</p>
              <p className="text-sm text-gray-400 mt-1">Ví dụ: NhanTrong#1234</p>
            </div>
          )}

          {/* Selected Users Summary */}
          {selectedUsers.length > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-green-50/50 rounded-2xl border border-green-100">
              <h3 className="text-xs font-semibold text-green-700 mb-2.5 uppercase tracking-wide">
                Đã chọn {selectedUsers.length} người
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <span
                    key={user.uid}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm text-gray-700 border border-green-200 shadow-sm"
                  >
                    <span className="font-medium">{user.displayName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleUser(user);
                      }}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-0.5 transition-colors"
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
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-5 py-2 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSendInvitations}
            disabled={selectedUsers.length === 0 || isSending}
            className="px-5 py-2 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {isSending ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Gửi lời mời ({selectedUsers.length})</span>
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
