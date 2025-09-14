import React, { useState } from 'react';
import { 
  X, Users, Crown, MoreVertical, Settings, UserX, Camera, 
  Search, Filter, FileText, Hash, Edit2, Trash2, LogOut,
  UserPlus, Shield, Eye, Download, Calendar, Tag, File,
  FileImage, FileSpreadsheet, FileCode, Archive, Paperclip
} from 'lucide-react';

const GroupSidebar = ({ group, user, onClose }) => {
  const [activeTab, setActiveTab] = useState('members');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  
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

  const tabs = [
    { id: 'members', label: 'Thành viên', icon: Users, count: members.length },
    { id: 'files', label: 'File', icon: FileText, count: 5 },
    { id: 'settings', label: 'Cài đặt', icon: Settings, count: null }
  ];

  const getCurrentUserRole = () => 'admin'; // Mock

  const isCurrentUserAdmin = () => {
    return getCurrentUserRole() === 'admin';
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
            <div className="p-4 border-b border-gray-200">
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
                  </div>
                ))}
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
    </div>
  );
};

export default GroupSidebar;