import React, { useState } from 'react';
import { 
  X, Users, Crown, MoreVertical, Settings, UserX, Camera, 
  Search, Filter, FileText, Hash, Edit2, Trash2, LogOut,
  UserPlus, Shield, Eye, Download, Calendar, Tag, File,
  FileImage, FileSpreadsheet, FileCode, Archive, Paperclip
} from 'lucide-react';

const GroupSidebar = ({ group, user, onClose }) => {
  const [activeTab, setActiveTab] = useState('members');
  const [showKickModal, setShowKickModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  
  // Files tab state
  const [searchFiles, setSearchFiles] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  
  // Animation effect
  React.useEffect(() => {
    setIsAnimatingIn(true);
  }, []);

  // Mock data
  const members = [
    { id: 1, name: 'Nguyen Van A', role: 'admin', isCreator: true, avatar: null },
    { id: 2, name: 'Tran Thi B', role: 'member', isCreator: false, avatar: null },
    { id: 3, name: 'Le Van C', role: 'member', isCreator: false, avatar: null },
  ];

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
    { id: 'members', label: 'Thành viên', icon: Users, count: members.length },
    { id: 'files', label: 'File', icon: FileText, count: groupFiles.length },
    { id: 'settings', label: 'Cài đặt', icon: Settings, count: null }
  ];

  const getCurrentUserRole = () => 'admin'; // Mock

  const isCurrentUserAdmin = () => {
    return getCurrentUserRole() === 'admin';
  };

  // Kick member functions
  const handleKickMember = (member) => {
    setSelectedMember(member);
    setShowKickModal(true);
  };

  const confirmKickMember = () => {
    console.log('Kicking member:', selectedMember);
    // In real app, this would call API to kick member
    alert(`Đã kick thành viên: ${selectedMember.name}`);
    setShowKickModal(false);
    setSelectedMember(null);
  };

  // Invite member functions
  const handleInviteMember = () => {
    if (inviteEmail.trim()) {
      console.log('Inviting member:', inviteEmail);
      // In real app, this would call API to send invitation
      alert(`Đã gửi lời mời đến: ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteModal(false);
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
                {group?.avatar ? (
                  <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-xl">
                    {group?.name?.charAt(0).toUpperCase() || 'G'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-lg font-bold text-white truncate">{group?.name || 'Tên nhóm'}</h4>
              </div>
              <p className="text-emerald-100 text-sm">
                {members.length} thành viên
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
                <h3 className="font-semibold text-gray-900">Thành viên ({members.length})</h3>
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
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-emerald-600 font-semibold text-lg">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.name}
                          </p>
                          {member.isCreator && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 capitalize">
                          {member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Kick button - only for admin and not creator */}
                    {isCurrentUserAdmin() && !member.isCreator && (
                      <button
                        onClick={() => handleKickMember(member)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Kick thành viên"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
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
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Xóa nhóm</span>
                    </button>
                  )}
                  
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors text-left">
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
                Bạn có chắc chắn muốn kick <strong>{selectedMember?.name}</strong> khỏi nhóm không?
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
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Mời thành viên mới</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email người dùng
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Nhập email để mời..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                    autoFocus
                  />
                </div>
                
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-sm text-emerald-700">
                    💡 Lời mời sẽ được gửi qua email. Người dùng có thể tham gia nhóm sau khi xác nhận.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleInviteMember}
                  disabled={!inviteEmail.trim()}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Gửi lời mời
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