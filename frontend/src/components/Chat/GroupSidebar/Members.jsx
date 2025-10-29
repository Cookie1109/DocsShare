import { useState } from 'react';
import { Search, Crown, UserX, MoreVertical, User } from 'lucide-react';
import PendingMembers from './PendingMembers';

const Members = ({ group, currentUser, isAdmin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberMenu, setShowMemberMenu] = useState(null);
  const [showKickConfirm, setShowKickConfirm] = useState(null);

  // Mock data - trong thực tế sẽ lấy từ API
  const mockMembers = [
    {
      id: group.createdBy || currentUser?.id || 'admin-user',
      name: group.createdBy === currentUser?.id ? currentUser?.name || 'Bạn' : 'Trưởng nhóm',
      avatar: null,
      role: 'admin',
      joinedAt: group.createdAt,
      status: 'online'
    },
    {
      id: 'member2',
      name: 'Nguyễn Văn A',
      avatar: null,
      role: 'member',
      joinedAt: new Date().toISOString(),
      status: 'offline'
    },
    {
      id: 'member3',
      name: 'Trần Thị B',
      avatar: null,
      role: 'member',
      joinedAt: new Date().toISOString(),
      status: 'online'
    }
  ];

  const filteredMembers = mockMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKickMember = (memberId, memberName) => {
    setShowMemberMenu(null);
    setShowKickConfirm({ id: memberId, name: memberName });
  };

  const confirmKickMember = () => {
    // TODO: Implement actual kick member API call
    console.log('Kicked member:', showKickConfirm.id);
    // Remove member from mock data (in real app, this would be API call)
    setShowKickConfirm(null);
  };

  const handleMakeAdmin = (memberId) => {
    // TODO: Implement make admin functionality
    console.log('Make admin:', memberId);
    setShowMemberMenu(null);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Pending Members Section (Admin Only) */}
      {isAdmin && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Chờ phê duyệt
          </h4>
          <PendingMembers groupId={group.id} isAdmin={isAdmin} />
        </div>
      )}

      {/* Search Members */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm thành viên..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
        />
      </div>

      {/* Members List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Thành viên ({filteredMembers.length})
          </h4>
        </div>

        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
                  {member.avatar ? (
                    <img 
                      src={member.avatar} 
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-white" />
                  )}
                </div>
                
                {/* Online Status */}
                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                  member.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.name}
                    {member.id === currentUser?.id && (
                      <span className="text-xs text-gray-500 ml-1">(Bạn)</span>
                    )}
                  </p>
                  {(member.role === 'admin' || member.id === group.createdBy) && (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {member.role === 'admin' || member.id === group.createdBy ? 'Trưởng nhóm' : 'Thành viên'} • 
                  Tham gia {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              {/* Actions Menu */}
              {isAdmin && member.id !== currentUser?.id && member.id !== group.createdBy && (
                <div className="relative">
                  <button
                    onClick={() => setShowMemberMenu(showMemberMenu === member.id ? null : member.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {showMemberMenu === member.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-32">
                      {member.role !== 'admin' && (
                        <button
                          onClick={() => handleMakeAdmin(member.id)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Làm trưởng nhóm
                          </div>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleKickMember(member.id, member.name)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4" />
                          Mời khỏi nhóm
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Members Button */}
      {isAdmin && (
        <div className="pt-4 border-t border-gray-200">
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium">
            Thêm thành viên
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredMembers.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Không tìm thấy thành viên nào</p>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMemberMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowMemberMenu(null)}
        />
      )}

      {/* Kick Member Confirmation Modal */}
      {showKickConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Mời khỏi nhóm
            </h3>
            <p className="text-gray-600 mb-4">
              Bạn có chắc muốn mời <strong>{showKickConfirm.name}</strong> khỏi nhóm không?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Thành viên này sẽ không thể xem tin nhắn và file trong nhóm nữa.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowKickConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmKickMember}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Mời khỏi nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;