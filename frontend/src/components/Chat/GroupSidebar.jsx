import React, { useState, useEffect } from 'react';
import { 
  X, Users, Crown, MoreVertical, Settings, UserX, Camera, 
  Search, Filter, FileText, Hash, Edit2, Trash2, LogOut,
  UserPlus, Shield, Eye, Download, Calendar, Tag, File,
  FileImage, FileSpreadsheet, FileCode, Archive, Paperclip,
  Plus, Image as ImageIcon, Check, Loader, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CreateGroupModal from './CreateGroupModal';
import AddMemberModal from './AddMemberModal';
import GroupSettings from './GroupSidebar/GroupSettings';
import PendingMembers from './GroupSidebar/PendingMembers';
import Files from './GroupSidebar/Files';
import { getFirestore, doc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import { auth } from '../../config/firebase';

const GroupSidebar = ({ group, onClose }) => {
  const [activeTab, setActiveTab] = useState('members');
  const [showKickModal, setShowKickModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [roleChangeData, setRoleChangeData] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  
  // Edit group state
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupPhoto, setEditGroupPhoto] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  
  // Real-time group data
  const [realtimeGroupData, setRealtimeGroupData] = useState(null);
  
  // Pending members count
  const [pendingMembersCount, setPendingMembersCount] = useState(0);
  
  const { userGroups, selectedGroup, groupMembers, selectGroup, addMemberToGroup, removeMemberFromGroup, updateMemberRoleInGroup, checkUserRole, deleteGroup, leaveGroup, user } = useAuth();

  // Get current group data - prioritize real-time data, then context, then prop
  const currentGroup = realtimeGroupData || userGroups.find(g => g.id === selectedGroup) || group;
  
  // 🔥 Real-time listener for group data
  useEffect(() => {
    if (!selectedGroup) {
      setRealtimeGroupData(null);
      return;
    }

    console.log('🔥 Setting up real-time listener for group:', selectedGroup);
    const db = getFirestore();
    const groupRef = doc(db, 'groups', selectedGroup);

    const unsubscribe = onSnapshot(groupRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('📥 Real-time group update:', data);
        
        // Chỉ update nếu data thay đổi
        setRealtimeGroupData((prev) => {
          const newData = {
            id: snapshot.id,
            name: data.name,
            groupPhotoUrl: data.photoURL || data.groupPhotoUrl,
            creatorId: data.creatorId,
            ...data
          };
          
          // Kiểm tra nếu data giống nhau thì không update
          if (prev && prev.name === newData.name && prev.groupPhotoUrl === newData.groupPhotoUrl) {
            return prev;
          }
          
          return newData;
        });
      }
    }, (error) => {
      console.error('❌ Error listening to group:', error);
    });

    return () => {
      console.log('🔌 Cleaning up group listener');
      unsubscribe();
    };
  }, [selectedGroup]);
  
  // Early return if no group data
  if (!currentGroup) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Thông tin nhóm</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Không tìm thấy thông tin nhóm</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Files tab state
  const [searchFiles, setSearchFiles] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  
  // Animation effect
  React.useEffect(() => {
    setIsAnimatingIn(true);
  }, []);

  // NOTE: Removed auto-selectGroup useEffect to prevent infinite loop
  // when switching groups with sidebar open. Group selection is handled
  // by ChatArea and AuthContext - no need to re-select here.

  
  // Helper functions
  const isUserAdmin = () => {
    if (!user?.uid || !groupMembers) return false;
    const userMembership = groupMembers.find(member => member.userId === user.uid);
    return userMembership?.role === 'admin';
  };

  const isGroupCreator = () => {
    return currentGroup?.creatorId === user?.uid;
  };

  const getCurrentUserRole = () => {
    if (!user?.uid || !groupMembers) return null;
    const userMembership = groupMembers.find(member => member.userId === user.uid);
    return userMembership?.role || null;
  };

  // 🔥 Real-time listener for pending members count
  useEffect(() => {
    if (!selectedGroup || !isUserAdmin()) {
      setPendingMembersCount(0);
      return;
    }

    const db = getFirestore();
    
    const pendingQuery = query(
      collection(db, 'pending_members'),
      where('groupId', '==', selectedGroup),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      setPendingMembersCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [selectedGroup, user?.uid, groupMembers]);

  const groupFiles = [
    { 
      id: 1, 
      name: 'React Hooks Guide.pdf', 
      size: '2.5 MB', 
      type: 'pdf', 
      uploadedBy: 'Nguyen Van A', 
      uploadDate: '2024-03-20',
      tags: ['Học tập', 'React'],
      description: 'Hướng dẫn chi tiết về React Hooks'
    },
    { 
      id: 2, 
      name: 'Database Design.pptx', 
      size: '4.1 MB', 
      type: 'pptx', 
      uploadedBy: 'Tran Thi B', 
      uploadDate: '2024-03-18',
      tags: ['Dự án', 'Database'],
      description: 'Thiết kế cơ sở dữ liệu cho dự án'
    },
    { 
      id: 3, 
      name: 'Assignment_1.docx', 
      size: '856 KB', 
      type: 'docx', 
      uploadedBy: 'Le Van C', 
      uploadDate: '2024-03-15',
      tags: ['Bài tập'],
      description: 'Bài tập số 1 môn lập trình'
    },
    { 
      id: 4, 
      name: 'UI_Design.fig', 
      size: '1.2 MB', 
      type: 'fig', 
      uploadedBy: 'Nguyen Van A', 
      uploadDate: '2024-03-12',
      tags: ['Thiết kế', 'UI/UX'],
      description: 'Mockup giao diện người dùng'
    },
    { 
      id: 5, 
      name: 'source_code.zip', 
      size: '15.8 MB', 
      type: 'zip', 
      uploadedBy: 'Tran Thi B', 
      uploadDate: '2024-03-10',
      tags: ['Source code', 'Dự án'],
      description: 'Source code hoàn chỉnh của dự án'
    },
  ];

  const availableTags = ['Tất cả', 'Học tập', 'Dự án', 'Bài tập', 'Thiết kế', 'UI/UX', 'Source code', 'Database', 'React'];

  const tabs = [
    { id: 'members', label: 'Thành viên', icon: Users, count: groupMembers?.length || 0 },
    ...(isUserAdmin() ? [{ id: 'pending', label: 'Chờ', icon: Clock, count: pendingMembersCount }] : []),
    { id: 'files', label: 'File', icon: FileText, count: groupFiles.length },
    { id: 'settings', label: 'Cài đặt', icon: Settings, count: null }
  ];



  const isCurrentUserAdmin = () => {
    return isUserAdmin();
  };

  // Member management functions
  const handleKickMember = (member) => {
    setSelectedMember(member);
    setShowKickModal(true);
  };

  const confirmKickMember = async () => {
    if (!selectedMember || !selectedGroup) return;
    
    try {
      const result = await removeMemberFromGroup(selectedMember.membershipId, selectedGroup);
      if (result.success) {
        // Show notification in top-right corner
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-purple-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
        notification.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Đã xóa ${selectedMember.user.displayName} khỏi nhóm</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
      } else {
        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
        notification.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <span>Lỗi: ${result.error}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      // Show error notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>Có lỗi xảy ra khi xóa thành viên</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } finally {
      setShowKickModal(false);
      setSelectedMember(null);
    }
  };

  const handleChangeRole = async (member) => {
    if (!selectedGroup) return;
    
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    
    // Show modal instead of confirm
    setRoleChangeData({ member, newRole });
    setShowRoleChangeModal(true);
  };

  const confirmRoleChange = async () => {
    if (!roleChangeData) return;
    
    const { member, newRole } = roleChangeData;
    const actionText = newRole === 'admin' ? 'thăng chức' : 'giáng chức';
    
    try {
      const result = await updateMemberRoleInGroup(member.membershipId, newRole, selectedGroup);
      if (result.success) {
        // Show success notification with color based on action
        const notification = document.createElement('div');
        const bgColor = newRole === 'admin' 
          ? 'bg-blue-500' 
          : 'bg-orange-500';
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in`;
        notification.innerHTML = `
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>Đã ${actionText} ${member.user.displayName} thành ${newRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      alert('Có lỗi xảy ra khi cập nhật quyền');
    } finally {
      setShowRoleChangeModal(false);
      setRoleChangeData(null);
    }
  };

  // ✏️ Edit Group Functions
  const handleEditGroupName = () => {
    setEditGroupName(currentGroup?.name || '');
    setShowEditGroupModal(true);
  };

  const handleEditGroupPhoto = () => {
    // Tạo input file ẩn để chọn ảnh
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        // Kiểm tra kích thước file (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('Kích thước ảnh không được vượt quá 5MB');
          return;
        }
        
        // Chuyển file thành base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Image = event.target.result;
          await updateGroupPhoto(base64Image);
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const updateGroupPhoto = async (photoUrl) => {
    if (!selectedGroup) return;

    setIsSavingGroup(true);
    try {
      const db = getFirestore();
      const groupRef = doc(db, 'groups', selectedGroup);
      
      await updateDoc(groupRef, {
        groupPhotoUrl: photoUrl || null,
        updatedAt: new Date().toISOString()
      });

      console.log('✅ Group photo updated successfully');
    } catch (error) {
      console.error('❌ Error updating group photo:', error);
      alert('Có lỗi xảy ra khi cập nhật ảnh nhóm');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleSaveGroupName = async () => {
    if (!selectedGroup || !editGroupName.trim()) {
      alert('Tên nhóm không được để trống');
      return;
    }

    setIsSavingGroup(true);
    try {
      const db = getFirestore();
      const groupRef = doc(db, 'groups', selectedGroup);
      
      await updateDoc(groupRef, {
        name: editGroupName.trim(),
        updatedAt: new Date().toISOString()
      });

      console.log('✅ Group name updated successfully');
      setShowEditGroupModal(false);
    } catch (error) {
      console.error('❌ Error updating group name:', error);
      alert('Có lỗi xảy ra khi cập nhật tên nhóm');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Invite member functions (simplified for now)
  const handleInviteMember = () => {
    // Open the AddMemberModal
    setShowInviteModal(true);
  };

  // Group management functions
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      const result = await deleteGroup(selectedGroup);
      if (result.success) {
        onClose(); // Close sidebar
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Có lỗi xảy ra khi xóa nhóm');
    } finally {
      setShowDeleteGroupModal(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      const result = await leaveGroup(selectedGroup);
      if (result.success) {
        onClose(); // Close sidebar
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Có lỗi xảy ra khi rời nhóm');
    } finally {
      setShowLeaveGroupModal(false);
    }
  };

  // File functions
  const filteredFiles = groupFiles.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchFiles.toLowerCase()) ||
      file.description.toLowerCase().includes(searchFiles.toLowerCase());
    const matchesFilter = fileFilter === 'all' || fileFilter === 'Tất cả' || file.tags.includes(fileFilter);
    return matchesSearch && matchesFilter;
  });

  const handleDownloadFile = (file) => {
    console.log('Downloading file:', file.name);
    // Mock download functionality
    alert(`Đang tải xuống: ${file.name}`);
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'pptx':
      case 'ppt':
        return <FileImage className="h-5 w-5 text-orange-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
      case 'zip':
      case 'rar':
        return <Archive className="h-5 w-5 text-purple-500" />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'java':
        return <FileCode className="h-5 w-5 text-indigo-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <>
      {/* Overlay for mobile/tablet */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        style={{
          opacity: isAnimatingIn ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: isAnimatingIn ? 'auto' : 'none'
        }}
      />
      
      {/* Sidebar */}
      <div 
        className="fixed lg:relative right-0 top-0 w-full sm:w-96 lg:w-80 xl:w-96 bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 z-50"
        style={{
          transform: isAnimatingIn ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          opacity: isAnimatingIn ? 1 : 0
        }}
      >
      {/* Header */}
      <div className="bg-emerald-500 text-white flex-shrink-0">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-emerald-400">
          <h3 className="text-base sm:text-lg font-semibold">Thông tin nhóm</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-emerald-600 rounded-full transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Group Info */}
        <div className="p-3 sm:p-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Group Photo with Camera Icon */}
            <div className="relative flex-shrink-0 group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-500 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
                {currentGroup?.groupPhotoUrl ? (
                  <img src={currentGroup.groupPhotoUrl} alt={currentGroup.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-xl">
                    {currentGroup?.name?.charAt(0).toUpperCase() || 'G'}
                  </span>
                )}
              </div>
              {/* Camera Icon Overlay - Click to change photo */}
              <button
                onClick={handleEditGroupPhoto}
                className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Đổi ảnh nhóm"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            
            {/* Group Name with Edit Icon */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-lg font-bold text-white truncate">{currentGroup?.name || 'Tên nhóm'}</h4>
                {isGroupCreator() && (
                  <Crown className="h-4 w-4 text-yellow-300" />
                )}
                <button
                  onClick={handleEditGroupName}
                  className="p-1 hover:bg-emerald-600 rounded transition-colors"
                  title="Sửa tên nhóm"
                >
                  <Edit2 className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
              <p className="text-emerald-100 text-sm">
                {groupMembers?.length || 0} thành viên
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-emerald-400">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isPendingTab = tab.id === 'pending';
            const showBadge = tab.count !== null && tab.count !== undefined;
            const hasPendingCount = isPendingTab && tab.count > 0;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white border-b-2 border-white'
                    : 'text-emerald-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {showBadge && (
                  <span className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-semibold ${
                    hasPendingCount 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/50' 
                      : 'bg-white/20 text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
        {activeTab === 'members' && (
          <div className="flex-1 flex flex-col">
            <div className="p-3 sm:p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">Thành viên ({groupMembers?.length || 0})</h3>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium whitespace-nowrap flex-shrink-0 shadow-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Mời thành viên</span>
                  <span className="sm:hidden">Mời</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm thành viên..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                {groupMembers?.map((member) => (
                  <div key={member.membershipId} className="flex items-center justify-between p-2 sm:p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                        {member.user.avatar ? (
                          <img src={member.user.avatar} alt={member.user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-emerald-600 font-semibold text-lg">
                            {member.user.displayName?.charAt(0).toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.user.displayName}#{member.user.userTag}
                          </p>
                          {member.userId === currentGroup?.creatorId && (
                            <Crown className="h-4 w-4 text-yellow-500" title="Người tạo nhóm" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 capitalize">
                          {member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    
                    {/* Action buttons - only for admin and not for group creator */}
                    {isUserAdmin() && member.userId !== currentGroup?.creatorId && member.userId !== user?.uid && (
                      <div className="flex items-center gap-1">
                        {/* Change role button */}
                        <button
                          onClick={() => handleChangeRole(member)}
                          className={`p-2 ${member.role === 'admin' ? 'text-orange-500 hover:bg-orange-50' : 'text-blue-500 hover:bg-blue-50'} rounded-lg transition-colors`}
                          title={member.role === 'admin' ? 'Giáng chức thành viên' : 'Thăng chức quản trị viên'}
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        
                        {/* Remove member button */}
                        <button
                          onClick={() => handleKickMember(member)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa khỏi nhóm"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Thành viên chờ phê duyệt
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Danh sách thành viên đang chờ bạn phê duyệt để tham gia nhóm
                </p>
              </div>
              
              <PendingMembers 
                groupId={currentGroup?.id} 
                isAdmin={isCurrentUserAdmin()} 
              />
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <Files groupId={currentGroup?.id} isAdmin={isCurrentUserAdmin()} />
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <GroupSettings 
              group={currentGroup} 
              currentUser={user} 
              isAdmin={isCurrentUserAdmin()} 
              onClose={onClose}
            />
          </div>
        )}
      </div>

      {/* Kick Member Confirmation Modal */}
      {showKickModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <UserX className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Kick thành viên</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa <strong>{selectedMember?.user?.displayName}#{selectedMember?.user?.userTag}</strong> khỏi nhóm không?
                Họ sẽ không thể truy cập nhóm này nữa.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowKickModal(false);
                    setSelectedMember(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmKickMember}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Kick thành viên
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <AddMemberModal
        isOpen={showInviteModal}
        groupId={currentGroup?.id}
        groupName={currentGroup?.name}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Xóa nhóm</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa nhóm <strong>{currentGroup?.name}</strong> không?
                Tất cả thành viên sẽ bị xóa khỏi nhóm và không thể khôi phục.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteGroupModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Xóa nhóm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Name Modal */}
      {showEditGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Edit2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Đổi tên nhóm</h3>
              </div>
              
              {/* Group Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên nhóm mới
                </label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm mới"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editGroupName.trim()) {
                      handleSaveGroupName();
                    }
                  }}
                />
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEditGroupModal(false)}
                  disabled={isSavingGroup}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveGroupName}
                  disabled={isSavingGroup || !editGroupName.trim()}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingGroup ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Lưu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {showLeaveGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Rời nhóm</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn rời khỏi nhóm <strong>{currentGroup?.name}</strong> không?
                Bạn sẽ không thể truy cập nhóm này nữa trừ khi được mời lại.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowLeaveGroupModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLeaveGroup}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Rời nhóm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleChangeModal && roleChangeData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${roleChangeData.newRole === 'admin' ? 'bg-blue-100' : 'bg-orange-100'} rounded-lg flex items-center justify-center`}>
                  <Shield className={`h-5 w-5 ${roleChangeData.newRole === 'admin' ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {roleChangeData.newRole === 'admin' ? 'Thăng chức' : 'Giáng chức'}
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn {roleChangeData.newRole === 'admin' ? 'thăng chức' : 'giáng chức'}{' '}
                <strong>{roleChangeData.member.user.displayName}</strong>{' '}
                thành <strong>{roleChangeData.newRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}</strong> không?
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRoleChangeModal(false);
                    setRoleChangeData(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmRoleChange}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    roleChangeData.newRole === 'admin'
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default GroupSidebar;