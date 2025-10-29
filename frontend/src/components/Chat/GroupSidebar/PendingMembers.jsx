import React, { useState, useEffect } from 'react';
import { Clock, Check, X, UserPlus, Loader } from 'lucide-react';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth } from '../../../config/firebase';

const PendingMembers = ({ groupId, isAdmin }) => {
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Real-time listener for pending members
  useEffect(() => {
    if (!groupId) return;

    const db = getFirestore();
    const pendingQuery = query(
      collection(db, 'pending_members'),
      where('groupId', '==', groupId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(pendingQuery, async (snapshot) => {
      const members = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Get user info
        const userDocRef = doc(db, 'users', data.userId);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.exists() ? userDoc.data() : {};
        
        // Get inviter info
        const inviterDocRef = doc(db, 'users', data.invitedBy);
        const inviterDoc = await getDoc(inviterDocRef);
        const inviterData = inviterDoc.exists() ? inviterDoc.data() : {};
        
        members.push({
          id: docSnapshot.id,
          userId: data.userId,
          user: {
            displayName: userData.displayName || 'Unknown',
            email: userData.email || '',
            photoURL: userData.photoURL || userData.avatar || null,
            userTag: userData.userTag || ''
          },
          invitedBy: data.invitedBy,
          inviter: {
            displayName: inviterData.displayName || 'Unknown'
          },
          invitedAt: data.invitedAt
        });
      }
      
      setPendingMembers(members);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleApprove = async (member) => {
    if (!isAdmin) return;
    
    setProcessingId(member.userId);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        `http://localhost:5000/api/groups/${groupId}/pending-members/${member.userId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to approve member');

      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Đã phê duyệt ${member.user.displayName}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
      
    } catch (error) {
      console.error('Error approving member:', error);
      alert('Không thể phê duyệt thành viên');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (member) => {
    if (!isAdmin) return;
    
    setSelectedMember(member);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedMember) return;
    
    setProcessingId(selectedMember.userId);
    setShowRejectModal(false);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        `http://localhost:5000/api/groups/${groupId}/pending-members/${selectedMember.userId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to reject member');

      // Show notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>Đã từ chối ${selectedMember.user.displayName}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
      
    } catch (error) {
      console.error('Error rejecting member:', error);
      alert('Không thể từ chối thành viên');
    } finally {
      setProcessingId(null);
      setSelectedMember(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (pendingMembers.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Không có thành viên chờ phê duyệt</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pendingMembers.map((member) => (
        <div
          key={member.userId}
          className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
              {member.user.photoURL ? (
                <img 
                  src={member.user.photoURL} 
                  alt={member.user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{member.user.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {member.user.displayName}
                </p>
                {member.user.userTag && (
                  <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                    #{member.user.userTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">
                Được mời bởi {member.inviter.displayName}
              </p>
            </div>
          </div>

          {/* Action Buttons (chỉ admin) */}
          {isAdmin && (
            <div className="flex items-center gap-2 ml-3">
              <button
                onClick={() => handleApprove(member)}
                disabled={processingId === member.userId}
                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Phê duyệt"
              >
                {processingId === member.userId ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
              
              <button
                onClick={() => handleReject(member)}
                disabled={processingId === member.userId}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Từ chối"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {/* Pending indicator (non-admin) */}
          {!isAdmin && (
            <div className="ml-3 flex items-center gap-1.5 text-yellow-600">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Chờ duyệt</span>
            </div>
          )}
        </div>
      ))}

      {/* Reject Confirmation Modal */}
      {showRejectModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Từ chối thành viên</h3>
                <p className="text-sm text-gray-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Bạn có chắc chắn muốn từ chối <span className="font-semibold text-gray-900">{selectedMember.user.displayName}</span> tham gia nhóm không?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedMember(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmReject}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingMembers;
