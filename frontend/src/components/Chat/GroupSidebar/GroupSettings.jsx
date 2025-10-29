import { useState, useEffect } from 'react';
import { Trash2, LogOut, AlertTriangle, Shield, UserCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { auth } from '../../../config/firebase';

const GroupSettings = ({ group, currentUser, isAdmin, onClose }) => {
  const { deleteGroup, leaveGroup } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isTogglingApproval, setIsTogglingApproval] = useState(false);

  // Real-time listener for approval setting
  useEffect(() => {
    if (!group?.id) return;

    const db = getFirestore();
    const groupRef = doc(db, 'groups', group.id);

    const unsubscribe = onSnapshot(groupRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRequireApproval(data.requireMemberApproval || false);
      }
    });

    return () => unsubscribe();
  }, [group?.id]);

  const handleToggleApproval = async () => {
    if (!isAdmin || isTogglingApproval) return;

    setIsTogglingApproval(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const newValue = !requireApproval;

      const response = await fetch(
        `http://localhost:5000/api/groups/${group.id}/settings/approval`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requireApproval: newValue
          })
        }
      );

      if (!response.ok) throw new Error('Failed to update approval setting');

      // Show notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Đã ${newValue ? 'bật' : 'tắt'} chế độ phê duyệt thành viên</span>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);

    } catch (error) {
      console.error('Error toggling approval:', error);
      alert('Không thể cập nhật cài đặt');
    } finally {
      setIsTogglingApproval(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (deleteInput === group.name && !isDeleting) {
      setIsDeleting(true);
      try {
        const result = await deleteGroup(group.id);
        if (result.success) {
          onClose();
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      } catch (error) {
        alert(`Lỗi: ${error.message}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!isLeaving) {
      setIsLeaving(true);
      try {
        const result = await leaveGroup(group.id);
        if (result.success) {
          onClose();
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      } catch (error) {
        alert(`Lỗi: ${error.message}`);
      } finally {
        setIsLeaving(false);
      }
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Member Approval Settings (Admin Only) */}
      {isAdmin && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Phê duyệt thành viên
          </h4>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h5 className="text-sm font-medium text-blue-900">
                    Yêu cầu phê duyệt thành viên mới
                  </h5>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    requireApproval 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {requireApproval ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  {requireApproval 
                    ? 'Thành viên được mời bởi người thường cần admin phê duyệt mới vào được nhóm. Admin mời thì không cần phê duyệt.'
                    : 'Thành viên được mời sẽ tự động tham gia nhóm mà không cần phê duyệt.'
                  }
                </p>
              </div>
              
              {/* Toggle Switch */}
              <button
                onClick={handleToggleApproval}
                disabled={isTogglingApproval}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  requireApproval ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    requireApproval ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

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
                    disabled={isLeaving}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLeaving ? 'Đang rời...' : 'Xác nhận rời'}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    disabled={isLeaving}
                    className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
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
                      disabled={deleteInput !== group.name || isDeleting}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteInput('');
                      }}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
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
        <p>ID nhóm: {group.id}</p>
      </div>
    </div>
  );
};

export default GroupSettings;