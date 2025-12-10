import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Users, FileText, MoreVertical, Hash, Crown, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const ChatSidebar = ({ onGroupSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const groupsListRef = useRef(null);
  const groupRefs = useRef({});
  const selectedGroupRef = useRef(null);
  
  // Use real groups from AuthContext
  const { userGroups, selectGroup, selectedGroup, createNewGroup, user } = useAuth();
  const groups = userGroups;

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Track new file counts and latest timestamps for each group
  const [newFileCounts, setNewFileCounts] = useState({});
  const [latestFileTimestamps, setLatestFileTimestamps] = useState({});
  
  // Update ref when selectedGroup changes
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Real-time file monitoring for all user groups
  useEffect(() => {
    if (!user || groups.length === 0) return;

    const unsubscribes = groups.map((group) => {
      const filesQuery = collection(db, 'groups', group.id.toString(), 'files');
      
      return onSnapshot(filesQuery, (snapshot) => {
        // Check if user is currently viewing this group (use ref for latest value)
        const isCurrentlyViewing = selectedGroupRef.current?.id === group.id;
        
        // Get last seen timestamp from localStorage (user-specific)
        const lastSeenKey = `lastSeen_${user.uid}_${group.id}`;
        let lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0');
        
        // Initialize lastSeen to now if first time (to avoid counting all existing files)
        if (lastSeen === 0) {
          lastSeen = Date.now();
          localStorage.setItem(lastSeenKey, lastSeen.toString());
        }
        
        // If user is currently viewing this group, update lastSeen to now and don't count
        if (isCurrentlyViewing) {
          localStorage.setItem(lastSeenKey, Date.now().toString());
          setNewFileCounts(prev => ({ ...prev, [group.id]: 0 }));
          
          // Still update latest timestamp
          let latestTimestamp = null;
          snapshot.forEach((doc) => {
            const fileData = doc.data();
            const uploadedAt = fileData.uploadedAt?.toMillis() || 0;
            if (!latestTimestamp || uploadedAt > latestTimestamp) {
              latestTimestamp = uploadedAt;
            }
          });
          if (latestTimestamp) {
            setLatestFileTimestamps(prev => ({ ...prev, [group.id]: latestTimestamp }));
          }
          return;
        }
        
        // Count new files uploaded after last seen (only for groups not currently viewing)
        let newCount = 0;
        let latestTimestamp = null;
        
        snapshot.forEach((doc) => {
          const fileData = doc.data();
          const uploadedAt = fileData.uploadedAt?.toMillis() || 0;
          const uploaderId = fileData.uploaderId || fileData.uploadedBy || fileData.userId;
          
          // Only count files uploaded by OTHER users (not yourself)
          // Skip files without uploaderId info (old files before this feature)
          if (uploaderId && uploadedAt > lastSeen && uploaderId !== user.uid) {
            newCount++;
          }
          
          // Track latest file timestamp
          if (!latestTimestamp || uploadedAt > latestTimestamp) {
            latestTimestamp = uploadedAt;
          }
        });
        
        // Update state
        setNewFileCounts(prev => ({ ...prev, [group.id]: newCount }));
        if (latestTimestamp) {
          setLatestFileTimestamps(prev => ({ ...prev, [group.id]: latestTimestamp }));
        }
      });
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [groups, user]);
  
  // Auto-reset badge when group is selected
  useEffect(() => {
    if (selectedGroup && user) {
      const lastSeenKey = `lastSeen_${user.uid}_${selectedGroup.id}`;
      localStorage.setItem(lastSeenKey, Date.now().toString());
      setNewFileCounts(prev => ({ ...prev, [selectedGroup.id]: 0 }));
    }
  }, [selectedGroup, user]);
  
  // Format latest file date (smart formatting)
  const formatLatestFileDate = (groupId) => {
    const timestamp = latestFileTimestamps[groupId];
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Handle group selection
  const handleGroupSelect = async (group) => {
    // Reset badge immediately (before context updates)
    const lastSeenKey = `lastSeen_${user.uid}_${group.id}`;
    localStorage.setItem(lastSeenKey, Date.now().toString());
    setNewFileCounts(prev => ({ ...prev, [group.id]: 0 }));
    
    // Reset search query
    setSearchQuery('');
    
    // Select group in AuthContext (this will load members)
    await selectGroup(group.id);
    
    // Trigger mobile view change
    if (onGroupSelect) {
      onGroupSelect();
    }
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

  const handleCreateGroup = async () => {
    const groupName = newGroupName.trim() || `Nhóm của ${user?.displayName || user?.email || 'Bạn'}`;
    
    try {
      // Use createNewGroup from AuthContext
      const result = await createNewGroup(groupName, imagePreview);
      
      if (result.success) {
        // Reset form
        setNewGroupName('');
        setNewGroupImage(null);
        setImagePreview(null);
        setShowCreateGroup(false);
      } else {
        console.error('Failed to create group:', result.error);
        alert('Có lỗi xảy ra khi tạo nhóm: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Có lỗi xảy ra khi tạo nhóm');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Search và Create Group - Fixed */}
      <div className="p-4 border-b border-green-100 flex-shrink-0">
        {/* Search Bar - Always visible */}
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
        
        {/* Create Group Button - Always show full */}
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
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có nhóm nào</h3>
            <p className="text-gray-500 mb-4">
              Tạo nhóm đầu tiên để bắt đầu chia sẻ tài liệu
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Tạo nhóm mới
            </button>
          </div>
        ) : (
          (searchQuery ? filteredGroups : groups).map((group) => (
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
                      {group.groupPhotoUrl ? (
                        <img src={group.groupPhotoUrl} alt={group.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-semibold">
                          {group.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Group Info - Always visible */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {group.name}
                        </h3>
                        {newFileCounts[group.id] > 0 && selectedGroup?.id !== group.id && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {newFileCounts[group.id] > 99 ? '99+' : newFileCounts[group.id]}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {latestFileTimestamps[group.id] 
                          ? formatLatestFileDate(group.id)
                          : (group.createdAt 
                              ? new Date(group.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
                              : '')
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-2">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {group.userRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                        </span>
                        {group.creatorId === user?.uid && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
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
          ))
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
