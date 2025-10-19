import React, { useState } from 'react';
import { 
  X, Users, Crown, MoreVertical, Settings, UserX, Camera, 
  Search, Filter, FileText, Hash, Edit2, Trash2, LogOut,
  UserPlus, Shield, Eye, Download, Calendar, Tag, File,
  FileImage, FileSpreadsheet, FileCode, Archive, Paperclip,
  Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CreateGroupModal from './CreateGroupModal';
import AddMemberModal from './AddMemberModal';

const GroupSidebar = ({ group, onClose }) => {
  const [activeTab, setActiveTab] = useState('members');
  const [showKickModal, setShowKickModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  
  const { userGroups, selectedGroup, groupMembers, selectGroup, addMemberToGroup, removeMemberFromGroup, updateMemberRoleInGroup, checkUserRole, deleteGroup, leaveGroup, user } = useAuth();

  // Get current group data - prioritize selectedGroup from context
  const currentGroup = userGroups.find(g => g.id === selectedGroup) || group;
  
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

  // Load group members when group changes
  React.useEffect(() => {
    if (currentGroup?.id && selectGroup) {
      selectGroup(currentGroup.id);
    }
  }, [currentGroup?.id, selectGroup]);


  
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
        alert(`Đã xóa ${selectedMember.user.displayName} khỏi nhóm`);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Có lỗi xảy ra khi xóa thành viên');
    } finally {
      setShowKickModal(false);
      setSelectedMember(null);
    }
  };

  const handleChangeRole = async (member) => {
    if (!selectedGroup) return;
    
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const confirm = window.confirm(
      `Bạn có chắc muốn ${newRole === 'admin' ? 'thăng chức' : 'giáng chức'} ${member.user.displayName}?`
    );
    
    if (confirm) {
      try {
        const result = await updateMemberRoleInGroup(member.membershipId, newRole, selectedGroup);
        if (result.success) {
          alert(`Đã ${newRole === 'admin' ? 'thăng chức' : 'giáng chức'} ${member.user.displayName}`);
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      } catch (error) {
        console.error('Error updating member role:', error);
        alert('Có lỗi xảy ra khi cập nhật quyền');
      }
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
    <div 
      className="w-96 bg-white h-full shadow-2xl flex flex-col border-l border-gray-200"
      style={{
        transform: isAnimatingIn ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        opacity: isAnimatingIn ? 1 : 0
      }}
    >
      {/* Header */}
      <div className="bg-emerald-500 text-white flex-shrink-0">
        <div className="flex items-center justify-between p-4 border-b border-emerald-400">
          <h3 className="text-lg font-semibold">Thông tin nhóm</h3>
        </div>
        
        {/* Group Info */}
        <div className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
                {currentGroup?.groupPhotoUrl ? (
                  <img src={currentGroup.groupPhotoUrl} alt={currentGroup.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-xl">
                    {currentGroup?.name?.charAt(0).toUpperCase() || 'G'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-lg font-bold text-white truncate">{currentGroup?.name || 'Tên nhóm'}</h4>
                {isGroupCreator() && (
                  <Crown className="h-4 w-4 text-yellow-300" />
                )}
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
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white border-b-2 border-white'
                    : 'text-emerald-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== null && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'members' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Thành viên ({groupMembers?.length || 0})</h3>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  Mời thành viên
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
              <div className="p-4 space-y-3">
                {groupMembers?.map((member) => (
                  <div key={member.membershipId} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden">
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
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
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

        {activeTab === 'files' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Files ({groupFiles.length})</h3>
              </div>
              
              {/* Search & Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên file hoặc mô tả..."
                    value={searchFiles}
                    onChange={(e) => setSearchFiles(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none bg-white"
                  >
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag === 'Tất cả' ? 'all' : tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">
                    {filteredFiles.length}/{groupFiles.length} file
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3">
                {filteredFiles.length > 0 ? (
                  filteredFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                          {getFileIcon(file.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {file.size} • {file.uploadedBy} • {file.uploadDate}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {file.description}
                          </p>
                          {/* Tags */}
                          {file.tags && file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {file.tags.slice(0, 3).map((tag) => (
                                <span 
                                  key={tag}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700"
                                >
                                  <Hash className="h-2 w-2 mr-0.5" />
                                  {tag}
                                </span>
                              ))}
                              {file.tags.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{file.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Download button */}
                      <button
                        onClick={() => handleDownloadFile(file)}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Tải xuống file"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {searchFiles ? 'Không tìm thấy file nào' : 'Chưa có file nào'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {searchFiles ? 'Thử tìm kiếm với từ khóa khác' : 'File được chia sẻ sẽ hiển thị ở đây'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-emerald-500" />
                  Cài đặt chung
                </h5>
                
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  {isCurrentUserAdmin() && (
                    <button 
                      onClick={() => setShowDeleteGroupModal(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Xóa nhóm</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setShowLeaveGroupModal(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-orange-600">Rời nhóm</span>
                  </button>
                </div>
              </div>
            </div>
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
    </div>
  );
};

export default GroupSidebar;