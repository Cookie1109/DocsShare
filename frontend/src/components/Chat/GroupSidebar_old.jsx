import React, { useState } from 'react';
import { 
  X, Users, Crown, MoreVertical, Settings, UserX, Camera, 
  Search, Filter, FileText, Hash, Edit2, Trash2, LogOut,
  UserPlus, Shield, Eye, Download, Calendar, Tag, File,
  FileImage, FileSpreadsheet, FileCode, Archive, Paperclip
} from 'lucide-react';

const GroupSidebar = ({ group, user, onClose }) => {
  const [activeTab, setActiveTab] = useState('members'); // members, files, settings
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  
  // Animation effect
  React.useEffect(() => {
    setIsAnimatingIn(true);
  }, []);

  const [showMemberActions, setShowMemberActions] = useState({});
  const [showUploadAvatar, setShowUploadAvatar] = useState(false);
  const [showEditGroupName, setShowEditGroupName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [selectedFileFilter, setSelectedFileFilter] = useState('all');
  const [newGroupName, setNewGroupName] = useState(group?.name || '');
  const [groupAvatar, setGroupAvatar] = useState(group?.avatar || null);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [tempGroupName, setTempGroupName] = useState(group?.name || '');
  const [tempGroupAvatar, setTempGroupAvatar] = useState(group?.avatar || null);

  // Mock data
  const [members, setMembers] = useState([
    { 
      id: '1', 
      name: 'Admin Nguyễn', 
      role: 'admin', 
      avatar: null, 
      isOnline: true,
      joinedAt: '2025-09-01T10:00:00Z',
      isCreator: true
    },
    { 
      id: '2', 
      name: 'Trần Văn A', 
      role: 'member', 
      avatar: null, 
      isOnline: true,
      joinedAt: '2025-09-05T14:30:00Z',
      isCreator: false
    },
    { 
      id: '3', 
      name: 'Nguyễn Thị B', 
      role: 'member', 
      avatar: null, 
      isOnline: false,
      joinedAt: '2025-09-08T09:15:00Z',
      isCreator: false
    },
    { 
      id: '4', 
      name: 'Lê Văn C', 
      role: 'moderator', 
      avatar: null, 
      isOnline: true,
      joinedAt: '2025-09-10T16:45:00Z',
      isCreator: false
    }
  ]);

  const [groupFiles] = useState([
    {
      id: '1',
      name: 'React Hooks Guide.pdf',
      size: '2.5 MB',
      type: 'pdf',
      uploadedBy: 'Nguyễn Văn A',
      uploadedAt: '2025-09-11T10:30:00Z',
      downloads: 12,
      views: 25,
      tags: ['Học tập', 'Tài liệu tham khảo']
    },
    {
      id: '2',
      name: 'Component Architecture.pptx',
      size: '5.1 MB',
      type: 'pptx',
      uploadedBy: 'Bạn',
      uploadedAt: '2025-09-11T11:45:00Z',
      downloads: 8,
      views: 15,
      tags: ['Dự án', 'Học tập']
    },
    {
      id: '3',
      name: 'Database Schema.sql',
      size: '1.2 MB',
      type: 'sql',
      uploadedBy: 'Lê Văn C',
      uploadedAt: '2025-09-11T14:20:00Z',
      downloads: 3,
      views: 8,
      tags: ['Source code', 'Công việc']
    }
  ]);

  const availableTags = ['Học tập', 'Công việc', 'Tài liệu tham khảo', 'Source code', 'Bài tập', 'Dự án', 'Thảo luận'];

  const getCurrentUserRole = () => {
    // For demo purposes, assume current user is always admin
    // In real app, this should check actual user permissions
    return 'admin';
  };

  const isCurrentUserAdmin = () => {
    return getCurrentUserRole() === 'admin';
  };

  const canKickMember = (targetMember) => {
    const currentUserRole = getCurrentUserRole();
    if (currentUserRole === 'admin') return !targetMember.isCreator; // Admin không thể kick creator
    if (currentUserRole === 'moderator' && targetMember.role === 'member') return true;
    return false;
  };

  const handleKickMember = (memberId) => {
    if (window.confirm('Bạn có chắc muốn kick thành viên này khỏi nhóm?')) {
      setMembers(prev => prev.filter(member => member.id !== memberId));
      setShowMemberActions({});
    }
  };

  const handleUpdateGroupName = () => {
    if (newGroupName.trim() && newGroupName !== group?.name) {
      // Update group name logic here
      console.log('Updating group name to:', newGroupName);
      setShowEditGroupName(false);
    }
  };

  const handleDeleteGroup = () => {
    if (window.confirm('Bạn có chắc muốn xóa nhóm này? Hành động này không thể hoàn tác.')) {
      console.log('Deleting group...');
      onClose();
    }
  };

  const handleLeaveGroup = () => {
    if (window.confirm('Bạn có chắc muốn rời khỏi nhóm này?')) {
      console.log('Leaving group...');
      onClose();
    }
  };

  // Handle group avatar change
  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempGroupAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle save group changes
  const handleSaveGroupChanges = () => {
    if (!tempGroupName.trim()) {
      alert('Tên nhóm không được để trống!');
      return;
    }

    // Update group data (in real app, this would call an API)
    console.log('Saving group changes:', {
      name: tempGroupName,
      avatar: tempGroupAvatar
    });

    // Update local state
    setNewGroupName(tempGroupName);
    setGroupAvatar(tempGroupAvatar);

    // Close modal
    setShowEditGroupModal(false);
    
    alert('Thông tin nhóm đã được cập nhật thành công!');
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    setTempGroupName(group?.name || '');
    setTempGroupAvatar(group?.avatar || null);
    setShowEditGroupModal(false);
  };

  const getRoleDisplay = (role, isCreator) => {
    if (isCreator) return { text: 'Trưởng nhóm', color: 'text-yellow-600', icon: Crown };
    switch (role) {
      case 'admin': return { text: 'Quản trị viên', color: 'text-red-600', icon: Shield };
      case 'moderator': return { text: 'Điều hành viên', color: 'text-orange-600', icon: Settings };
      default: return { text: 'Thành viên', color: 'text-emerald-600', icon: Users };
    }
  };

  const getFileIcon = (type) => {
    const iconProps = { className: "h-4 w-4" };
    switch (type?.toLowerCase()) {
      case 'pdf': case 'doc': case 'docx': return <FileText {...iconProps} />;
      case 'xls': case 'xlsx': return <FileSpreadsheet {...iconProps} />;
      case 'ppt': case 'pptx': return <FileImage {...iconProps} />;
      case 'zip': case 'rar': case '7z': return <Archive {...iconProps} />;
      case 'js': case 'jsx': case 'ts': case 'tsx': case 'sql': return <FileCode {...iconProps} />;
      case 'jpg': case 'jpeg': case 'png': case 'gif': return <FileImage {...iconProps} />;
      default: return <File {...iconProps} />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.abs(now - date) / 36e5;
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  // Filter members by search query
  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  // Filter files by search query and tag
  const filteredFiles = groupFiles.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
                         file.uploadedBy.toLowerCase().includes(fileSearchQuery.toLowerCase());
    const matchesFilter = selectedFileFilter === 'all' || 
                         file.tags?.includes(selectedFileFilter);
    return matchesSearch && matchesFilter;
  });

  const tabs = [
    { id: 'members', label: 'Thành viên', icon: Users, count: members.length },
    { id: 'files', label: 'File', icon: FileText, count: groupFiles.length },
    { id: 'settings', label: 'Cài đặt', icon: Settings, count: null }
  ];

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
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 border-b border-emerald-400">
            <h3 className="text-lg font-semibold">Thông tin nhóm</h3>
            <button
              onClick={onClose}
              className="text-emerald-100 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Group Info */}
          <div className="p-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
                  {groupAvatar || group?.avatar ? (
                    <img src={groupAvatar || group.avatar} alt={newGroupName || group.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-xl">
                      {(newGroupName || group?.name)?.charAt(0).toUpperCase() || 'G'}
                    </span>
                  )}
                </div>
                {isCurrentUserAdmin() && (
                  <button
                    onClick={() => {
                      console.log('Opening edit group modal...');
                      setTempGroupName(group?.name || '');
                      setTempGroupAvatar(group?.avatar || null);
                      setShowEditGroupModal(true);
                    }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
                  >
                    <Camera className="h-3 w-3 text-gray-600" />
                  </button>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-bold text-white truncate">{newGroupName || group?.name || 'Tên nhóm'}</h4>
                  {isCurrentUserAdmin() && (
                    <button
                      onClick={() => {
                        console.log('Opening edit group modal via name edit...');
                        setTempGroupName(group?.name || '');
                        setTempGroupAvatar(group?.avatar || null);
                        setShowEditGroupModal(true);
                      }}
                      className="text-emerald-100 hover:text-white p-1 rounded transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-emerald-100 text-sm">
                  {members.length} thành viên
                </p>
                <p className="text-emerald-200 text-xs">
                  Tạo {formatDate(group?.createdAt || Date.now())}
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
              {/* Search Members */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm thành viên..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Add Member Button */}
              {isCurrentUserAdmin() && (
                <div className="px-4 pb-3">
                  <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 text-emerald-600 rounded-xl border-2 border-dashed border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all font-medium">
                    <UserPlus className="h-5 w-5" />
                    Thêm thành viên
                  </button>
                </div>
              )}

              {/* Members List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {filteredMembers.map((member) => {
                    const roleInfo = getRoleDisplay(member.role, member.isCreator);
                    const RoleIcon = roleInfo.icon;
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="relative">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden">
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-emerald-600 font-semibold">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            {/* Online indicator */}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${member.isOnline ? 'bg-lime-400' : 'bg-gray-400'} rounded-full border-2 border-white`}></div>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 truncate">{member.name}</p>
                              {member.isCreator && (
                                <Crown className="h-4 w-4 text-yellow-500" title="Trưởng nhóm" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-3 w-3" />
                              <span className={`text-xs font-medium ${roleInfo.color}`}>
                                {roleInfo.text}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-500">
                                {formatDate(member.joinedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        {canKickMember(member) && (
                          <div className="relative">
                            <button
                              onClick={() => setShowMemberActions(prev => ({
                                ...prev,
                                [member.id]: !prev[member.id]
                              }))}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            
                            {showMemberActions[member.id] && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setShowMemberActions({})}
                                />
                                <div className="absolute right-0 top-10 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 min-w-40">
                                  <button
                                    onClick={() => handleKickMember(member.id)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <UserX className="h-4 w-4" />
                                    Kick khỏi nhóm
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Không tìm thấy thành viên nào</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col">
              {/* Search & Filter Files */}
              <div className="p-4 border-b border-gray-200 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm file..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                  />
                </div>

                {/* Filter by Tag */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={selectedFileFilter}
                    onChange={(e) => setSelectedFileFilter(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-sm"
                  >
                    <option value="all">Tất cả tag</option>
                    {availableTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Files List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {filteredFiles.map((file) => (
                    <div key={file.id} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate mb-1">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <span>{file.uploadedBy}</span>
                            <span>•</span>
                            <span>{file.size}</span>
                            <span>•</span>
                            <span>{formatTime(file.uploadedAt)}</span>
                          </div>
                          
                          {/* Tags */}
                          {file.tags && file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {file.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                                >
                                  <Hash className="h-2.5 w-2.5 mr-0.5" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {file.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {file.downloads}
                            </span>
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredFiles.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Không tìm thấy file nào</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">

                {/* General Settings */}
                <div className="space-y-3">
                  <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-500" />
                    Cài đặt chung
                  </h5>
                  

                  
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    {/* Delete Group - Admin only */}
                    {isCurrentUserAdmin() && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">Xóa nhóm</span>
                      </button>
                    )}
                    
                    {/* Leave Group */}
                    <button
                      onClick={handleLeaveGroup}
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

      </div>
    </div>
  );
};

export default GroupSidebar;
