import { useState } from 'react';
import { Trash2, LogOut, AlertTriangle, Shield } from 'lucide-react';

const GroupSettings = ({ group, currentUser, isAdmin, onGroupDelete, onClose }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleDeleteGroup = () => {
    if (deleteInput === group.name) {
      onGroupDelete?.(group.id);
      onClose();
    }
  };

  const handleLeaveGroup = () => {
    // TODO: Implement leave group functionality
    console.log('Leave group:', group.id);
    setShowLeaveConfirm(false);
    onClose();
  };

  return (
    <div className="p-4 space-y-6">
      {/* Group Permissions */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Quyền hạn
        </h4>
        
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Vai trò của bạn</span>
            <span className="text-sm font-medium text-gray-900">
              {isAdmin ? 'Trưởng nhóm' : 'Thành viên'}
            </span>
          </div>
          
          {isAdmin && (
            <div className="text-xs text-gray-500">
              Bạn có thể chỉnh sửa thông tin nhóm, quản lý thành viên và xóa nhóm
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Vùng nguy hiểm
        </h4>

        {/* Leave Group */}
        <div className="space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <LogOut className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h5 className="text-sm font-medium text-yellow-800">
                  Rời khỏi nhóm
                </h5>
                <p className="text-xs text-yellow-700 mt-1">
                  Bạn sẽ không còn thấy tin nhắn và file trong nhóm này
                </p>
              </div>
            </div>
            
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
              >
                Rời nhóm
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-yellow-800">
                  Bạn có chắc muốn rời khỏi nhóm "{group.name}"?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLeaveGroup}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Xác nhận rời
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Group (Trưởng nhóm Only) */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-red-800">
                    Xóa nhóm vĩnh viễn
                  </h5>
                  <p className="text-xs text-red-700 mt-1">
                    Tất cả tin nhắn, file và thành viên sẽ bị xóa. Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                >
                  Xóa nhóm
                </button>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm text-red-800 mb-2">
                      Nhập tên nhóm "<strong>{group.name}</strong>" để xác nhận:
                    </p>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={group.name}
                      className="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteGroup}
                      disabled={deleteInput !== group.name}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Xóa vĩnh viễn
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteInput('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        <p>Nhóm được tạo ngày {new Date(group.createdAt).toLocaleDateString('vi-VN')}</p>
        <p>ID nhóm: {group.id}</p>
      </div>
    </div>
  );
};

export default GroupSettings;