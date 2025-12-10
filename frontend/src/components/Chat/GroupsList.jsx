import React, { useState, useEffect } from 'react';
import { Users, Plus, Settings, Crown, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CreateGroupModal from './CreateGroupModal';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const GroupsList = ({ onClose, onSelectGroup }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberCounts, setMemberCounts] = useState({});
  const [newFileCounts, setNewFileCounts] = useState({});
  const [latestFileTimestamps, setLatestFileTimestamps] = useState({});
  const { userGroups, user, selectGroup, selectedGroup } = useAuth();

  const filteredGroups = userGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔥 Real-time listener for member counts
  useEffect(() => {
    if (userGroups.length === 0) return;

    const unsubscribes = userGroups.map((group) => {
      const memberQuery = query(
        collection(db, 'group_members'),
        where('groupId', '==', group.id)
      );

      return onSnapshot(memberQuery, (snapshot) => {
        setMemberCounts((prev) => ({
          ...prev,
          [group.id]: snapshot.size
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userGroups]);

  // 🔥 Real-time listener for files in each group (count new files + get latest file time)
  useEffect(() => {
    if (userGroups.length === 0) return;

    const unsubscribes = userGroups.map((group) => {
      const filesQuery = collection(db, 'groups', group.id.toString(), 'files');

      return onSnapshot(filesQuery, (snapshot) => {
        const files = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Find latest file timestamp
        let latestTimestamp = null;
        files.forEach(file => {
          const uploadedAt = file.uploadedAt?.toDate?.() || new Date(file.uploadedAt);
          if (!latestTimestamp || uploadedAt > latestTimestamp) {
            latestTimestamp = uploadedAt;
          }
        });

        if (latestTimestamp) {
          setLatestFileTimestamps(prev => ({
            ...prev,
            [group.id]: latestTimestamp
          }));
        }

        // Count new files (uploaded after last seen)
        const lastSeenKey = `lastSeen_${group.id}`;
        const lastSeenTimestamp = localStorage.getItem(lastSeenKey);

        let newCount = 0;
        if (lastSeenTimestamp) {
          const lastSeen = new Date(parseInt(lastSeenTimestamp));
          files.forEach(file => {
            const uploadedAt = file.uploadedAt?.toDate?.() || new Date(file.uploadedAt);
            
            // Don't count files uploaded by current user
            if (file.uploaderId === user?.uid) return;
            
            if (uploadedAt > lastSeen) {
              newCount++;
            }
          });
        }

        setNewFileCounts(prev => ({
          ...prev,
          [group.id]: newCount
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userGroups, user]);

  // Mark files as seen when a group is selected
  useEffect(() => {
    if (selectedGroup) {
      const lastSeenKey = `lastSeen_${selectedGroup}`;
      localStorage.setItem(lastSeenKey, Date.now().toString());
      
      // Reset new file count for selected group
      setNewFileCounts(prev => ({
        ...prev,
        [selectedGroup]: 0
      }));
    }
  }, [selectedGroup]);

  const handleGroupSelect = async (groupId) => {
    await selectGroup(groupId);
    if (onSelectGroup) {
      onSelectGroup(groupId);
    }
  };

  const getGroupMemberCount = (group) => {
    return memberCounts[group.id] || 0;
  };

  const isUserAdmin = (group) => {
    return group.userRole === 'admin';
  };

  const isGroupCreator = (group) => {
    return group.creatorId === user?.uid;
  };

  const formatLatestFileDate = (groupId) => {
    const timestamp = latestFileTimestamps[groupId];
    if (!timestamp) return '';

    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    
    return timestamp.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <>
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Nhóm của tôi
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhóm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Create Group Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tạo nhóm mới
          </button>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto">
          {filteredGroups.length === 0 ? (
            <div className="p-6 text-center">
              {userGroups.length === 0 ? (
                <div className="space-y-3">
                  <Users className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500">Bạn chưa có nhóm nào</p>
                  <p className="text-sm text-gray-400">
                    Tạo nhóm mới để bắt đầu chia sê tài liệu
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Search className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500">Không tìm thấy nhóm nào</p>
                  <p className="text-sm text-gray-400">
                    Thử từ khóa khác
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleGroupSelect(group.id)}
                  className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Group Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      {group.groupPhotoUrl ? (
                        <img
                          src={group.groupPhotoUrl}
                          alt={group.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-white" />
                      )}
                    </div>

                    {/* Group Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate flex-1">
                          {group.name}
                        </h3>
                        {/* New Files Badge - replaces "Chủ nhóm" */}
                        {newFileCounts[group.id] > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            {newFileCounts[group.id] > 99 ? '99+' : newFileCounts[group.id]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          {isGroupCreator(group) && (
                            <Crown className="w-3 h-3 text-yellow-500" title="Chủ nhóm" />
                          )}
                          {isUserAdmin(group) && !isGroupCreator(group) && (
                            <Settings className="w-3 h-3 text-blue-500" title="Quản trị viên" />
                          )}
                          {getGroupMemberCount(group)} thành viên
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatLatestFileDate(group.id) || (group.createdAt ? new Date(group.createdAt.seconds * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Tổng cộng {userGroups.length} nhóm
          </p>
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
};

export default GroupsList;