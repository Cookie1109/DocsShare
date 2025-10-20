import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Users, Loader, Clock } from 'lucide-react';
import { auth } from '../../config/firebase';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const InvitationNotifications = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Load pending invitations from MySQL
  const loadInvitations = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch('http://localhost:5000/api/invitations/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load invitations');

      const data = await response.json();
      setInvitations(data.data || []);
    } catch (err) {
      console.error('Load invitations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Initial load from MySQL
    loadInvitations();
    
    // Set up real-time listener for Firestore (for instant notifications)
    const db = getFirestore();
    const invitationsRef = collection(db, 'group_invitations');
    const q = query(
      invitationsRef, 
      where('invitee_id', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
      // Removed orderBy to avoid needing Firestore index
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          console.log('🔔 New invitation received!', change.doc.data());
          // Reload from MySQL to get complete data with group info
          loadInvitations();
        }
        if (change.type === 'removed') {
          console.log('✅ Invitation processed', change.doc.id);
          loadInvitations();
        }
      });
    }, (error) => {
      console.warn('Firestore listener error:', error);
      // Fallback to polling if Firestore fails
      const interval = setInterval(loadInvitations, 30000);
      return () => clearInterval(interval);
    });

    return () => unsubscribe();
  }, []);

  const handleAccept = async (invitationId) => {
    setProcessingId(invitationId);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        `http://localhost:5000/api/invitations/${invitationId}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to accept invitation');

      const result = await response.json();
      
      // Remove from list immediately
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      // Show success with group name
      const groupName = result.data?.group?.name || 'nhóm';
      
      // Create a better notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-2 animate-slide-in';
      notification.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Đã tham gia nhóm "${groupName}"</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
        // Reload to show new group in sidebar
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error('Accept invitation error:', err);
      alert('Không thể chấp nhận lời mời');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId) => {
    setProcessingId(invitationId);
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(
        `http://localhost:5000/api/invitations/${invitationId}/decline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to decline invitation');

      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
    } catch (err) {
      console.error('Decline invitation error:', err);
      alert('Không thể từ chối lời mời');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-emerald-50 rounded-lg transition-colors"
        title="Lời mời vào nhóm"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {invitations.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {invitations.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-emerald-200 z-50">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-emerald-50 to-green-50">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Lời mời vào nhóm</h3>
            </div>
            {invitations.length > 0 && (
              <p className="text-sm text-emerald-600 mt-1 font-medium">{invitations.length} lời mời đang chờ</p>
            )}
          </div>

          {/* Invitations List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Đang tải...</p>
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Không có lời mời nào</p>
              </div>
            ) : (
              invitations.map(invitation => (
                <div
                  key={invitation.id}
                  className="p-3 border-b last:border-b-0 hover:bg-emerald-50 transition-colors"
                >
                  {/* Group Info */}
                  <div className="mb-3">
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{invitation.group_name}</h4>
                        {invitation.group_description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{invitation.group_description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(invitation.created_at).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAccept(invitation.id)}
                      disabled={processingId === invitation.id}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === invitation.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          Chấp nhận
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDecline(invitation.id)}
                      disabled={processingId === invitation.id}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === invitation.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1.5" />
                          Từ chối
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default InvitationNotifications;
