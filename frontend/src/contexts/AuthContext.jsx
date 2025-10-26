import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithCredentials, 
  signInWithGoogle, 
  signUpWithEmail, 
  signOutUser, 
  onAuthStateChange,
  getUserData,
  checkUsernameExists,
  createGroup,
  getUserGroups,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  getUserRoleInGroup,
  updateMemberRole,
  deleteGroupFromFirestore,
  updateUserProfile
} from '../services/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        // OPTIMISTIC UI: Set basic user immediately, load details in background
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Loading...',
          loading: true
        });
        setLoading(false);  // Allow app to render immediately
        
        // Load full data in background
        Promise.all([
          getUserData(firebaseUser.uid),
          checkProfileStatus(firebaseUser)
        ]).then(([userData]) => {
          if (userData.success) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userData.data,
              loading: false
            });
          }
        }).catch(error => {
          console.error('Error loading user data:', error);
          setUser(prev => ({...prev, loading: false}));
        });
      } else {
        setUser(null);
        setUserGroups([]);
        setSelectedGroup(null);
        setGroupMembers([]);
        setProfileIncomplete(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for user profile updates
  useEffect(() => {
    if (!user?.uid) return;

    console.log('🔥 Setting up real-time listener for user:', user.uid);
    
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const updatedData = docSnapshot.data();
        console.log('📡 Real-time update received:', updatedData);
        
        setUser(prev => {
          const newUser = {
            ...prev,
            ...updatedData,
            name: updatedData.username || prev?.name,
            avatar: updatedData.avatar,
            displayName: updatedData.displayName
          };
          
          // Update localStorage
          localStorage.setItem('docsshare_user', JSON.stringify(newUser));
          
          return newUser;
        });
      }
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
    });

    return () => {
      console.log('🔌 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [user?.uid]);

  // 🔥 Real-time listener for user groups
  useEffect(() => {
    if (!user?.uid || profileIncomplete) {
      setUserGroups([]);
      return;
    }

    console.log('🔥 Setting up real-time listener for user groups');
    
    const groupUnsubscribes = new Map(); // Track group listeners
    
    // Listen to group_members collection for this user
    const membershipQuery = query(
      collection(db, 'group_members'),
      where('userId', '==', user.uid)
    );

    const membershipUnsubscribe = onSnapshot(membershipQuery, (snapshot) => {
      console.log('📥 Group memberships updated');
      
      const currentGroupIds = new Set(snapshot.docs.map(doc => doc.data().groupId));
      
      // Detect removed groups (groups that were in groupUnsubscribes but not in currentGroupIds)
      const removedGroupIds = [];
      groupUnsubscribes.forEach((unsub, groupId) => {
        if (!currentGroupIds.has(groupId)) {
          console.log(`🗑️ Group ${groupId} membership removed, cleaning up`);
          removedGroupIds.push(groupId);
          unsub();
          groupUnsubscribes.delete(groupId);
        }
      });
      
      // Remove from UI immediately when membership is deleted
      if (removedGroupIds.length > 0) {
        setUserGroups((prev) => prev.filter(g => !removedGroupIds.includes(g.id)));
        
        // If selected group was removed, reset selection to show welcome screen
        setSelectedGroup((current) => {
          if (current && removedGroupIds.includes(current)) {
            console.log(`🔄 Selected group ${current} membership removed, resetting to null`);
            return null;
          }
          return current;
        });
      }
      
      if (currentGroupIds.size === 0) {
        // Cleanup all group listeners
        groupUnsubscribes.forEach(unsub => unsub());
        groupUnsubscribes.clear();
        setUserGroups([]);
        setSelectedGroup(null); // Reset selection when no groups left
        console.log('🔄 No groups left, reset selectedGroup to null');
        return;
      }

      // Remove listeners for groups user left (already handled above, but keep for safety)
      groupUnsubscribes.forEach((unsub, groupId) => {
        if (!currentGroupIds.has(groupId)) {
          unsub();
          groupUnsubscribes.delete(groupId);
        }
      });

      // Add listeners for new groups
      currentGroupIds.forEach((groupId) => {
        if (!groupUnsubscribes.has(groupId)) {
          // Get user role
          const membership = snapshot.docs.find(d => d.data().groupId === groupId);
          const userRole = membership?.data().role;
          
          // Setup real-time listener for this group
          const groupRef = doc(db, 'groups', groupId);
          const groupUnsub = onSnapshot(groupRef, (groupDoc) => {
            if (groupDoc.exists()) {
              setUserGroups((prev) => {
                const filtered = prev.filter(g => g.id !== groupId);
                return [...filtered, {
                  id: groupDoc.id,
                  ...groupDoc.data(),
                  userRole
                }].sort((a, b) => {
                  // Sort by createdAt descending
                  const aTime = a.createdAt?.seconds || 0;
                  const bTime = b.createdAt?.seconds || 0;
                  return bTime - aTime;
                });
              });
            } else {
              // Group deleted - remove from state and cleanup listener
              console.log(`🗑️ Group ${groupId} deleted, removing from UI`);
              setUserGroups((prev) => prev.filter(g => g.id !== groupId));
              
              // If this was the selected group, reset selection to show welcome screen
              setSelectedGroup((current) => {
                if (current === groupId) {
                  console.log(`🔄 Selected group ${groupId} was deleted, resetting to null`);
                  return null;
                }
                return current;
              });
              
              // Cleanup this group's listener
              const unsub = groupUnsubscribes.get(groupId);
              if (unsub) {
                unsub();
                groupUnsubscribes.delete(groupId);
              }
            }
          }, (error) => {
            console.error(`❌ Error listening to group ${groupId}:`, error);
            // If permission denied (group deleted), remove from state
            if (error.code === 'permission-denied') {
              console.log(`🗑️ Group ${groupId} access denied (deleted), removing from UI`);
              setUserGroups((prev) => prev.filter(g => g.id !== groupId));
              
              // If this was the selected group, reset selection to show welcome screen
              setSelectedGroup((current) => {
                if (current === groupId) {
                  console.log(`🔄 Selected group ${groupId} was deleted (permission-denied), resetting to null`);
                  return null;
                }
                return current;
              });
              
              // Cleanup this group's listener
              const unsub = groupUnsubscribes.get(groupId);
              if (unsub) {
                unsub();
                groupUnsubscribes.delete(groupId);
              }
            }
          });
          
          groupUnsubscribes.set(groupId, groupUnsub);
        }
      });
    }, (error) => {
      console.error('❌ Error listening to groups:', error);
    });

    return () => {
      console.log('🔌 Cleaning up groups listeners');
      membershipUnsubscribe();
      groupUnsubscribes.forEach(unsub => unsub());
      groupUnsubscribes.clear();
    };
  }, [user?.uid, profileIncomplete]);

  const checkProfileStatus = async (firebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('http://localhost:5000/api/profile/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && !data.completed) {
        setProfileIncomplete(true);
      } else {
        setProfileIncomplete(false);
      }
    } catch (error) {
      console.error('Error checking profile status:', error);
      setProfileIncomplete(false);
    }
  };

  const completeProfile = async () => {
    setProfileIncomplete(false);
    // Reload user data
    if (user?.uid) {
      const userData = await getUserData(user.uid);
      if (userData.success) {
        setUser({
          uid: user.uid,
          email: user.email,
          ...userData.data
        });
      }
    }
  };

  const login = async (email, password) => {
    try {
      const result = await signInWithCredentials(email, password);
      
      if (result.success) {
        // OPTIMISTIC UI: Set basic user info immediately and return success
        // This allows immediate navigation while data loads in background
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || 'Loading...',
          loading: true  // Flag to show skeleton in UI
        });
        
        // Load full user data and check profile in background
        Promise.all([
          getUserData(result.user.uid),
          checkProfileStatus(result.user)
        ]).then(([userData]) => {
          if (userData.success) {
            // Update with full user data
            setUser({
              uid: result.user.uid,
              email: result.user.email,
              ...userData.data,
              loading: false
            });
          }
        }).catch(error => {
          console.error('Error loading user data:', error);
          // Keep basic user info even if background load fails
          setUser(prev => ({...prev, loading: false}));
        });
        
        // Return success immediately for instant navigation
        return { success: true };
      }
      
      // Return specific error from Firebase service
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Đã xảy ra lỗi không mong muốn' };
    }
  };

  const register = async (userData) => {
    try {
      // Check if username already exists
      const usernameCheck = await checkUsernameExists(userData.displayName, userData.userTag);
      if (usernameCheck.success && usernameCheck.exists) {
        return { success: false, error: 'Tên người dùng đã tồn tại' };
      }
      
      const result = await signUpWithEmail(userData.email, userData.displayName, userData.userTag, userData.password);
      
      if (result.success) {
        // OPTIMISTIC UI: Set user data immediately for instant navigation
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          ...result.userData,
          loading: false  // Registration already has full data
        });
        
        // Profile is complete for email registration
        setProfileIncomplete(false);
        
        // Return success immediately
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Đăng ký thất bại' };
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Đăng xuất thất bại' };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithGoogle();
      
      // Check if user cancelled the popup
      if (result.cancelled) {
        return { success: false, cancelled: true };
      }
      
      if (result.success) {
        // OPTIMISTIC UI: Set user data immediately for instant navigation
        setUser({
          uid: result.user.uid,
          email: result.user.email,
          ...result.userData,
          loading: false  // Google login already has full data
        });
        
        // Check profile status in background - don't wait for it
        checkProfileStatus(result.user).catch(error => {
          console.error('Error checking profile status:', error);
        });
        
        // Return success immediately
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: 'Đăng nhập Google thất bại' };
    }
  };

  const updateProfile = async (updatedData) => {
    try {
      console.log('Updating profile with data:', updatedData);
      console.log('Current user:', user);
      
      if (!user?.uid) {
        return { success: false, error: 'Người dùng chưa đăng nhập' };
      }

      // Prepare data for Firestore
      const firestoreUpdates = {};
      
      if (updatedData.name) {
        firestoreUpdates.displayName = updatedData.name.split('#')[0];
        firestoreUpdates.username = updatedData.name;
        if (updatedData.name.includes('#')) {
          firestoreUpdates.userTag = updatedData.name.split('#')[1];
        }
      }
      
      if (updatedData.avatar !== undefined) {
        firestoreUpdates.avatar = updatedData.avatar;
      }

      console.log('Firestore updates:', firestoreUpdates);

      // Update in Firestore
      const result = await updateUserProfile(user.uid, firestoreUpdates);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Update local state (real-time listener sẽ tự động sync)
      const updatedUser = { 
        ...user, 
        ...firestoreUpdates,
        name: firestoreUpdates.username || user.name
      };
      console.log('Updated user:', updatedUser);
      
      setUser(updatedUser);
      localStorage.setItem('docsshare_user', JSON.stringify(updatedUser));
      
      return { success: true };
    } catch (error) {
      console.error('Error in updateProfile:', error);
      return { 
        success: false, 
        error: 'Đã xảy ra lỗi khi cập nhật hồ sơ' 
      };
    }
  };

  // Group management functions
  const loadUserGroups = async () => {
    if (!user?.uid) return;
    
    try {
      const result = await getUserGroups(user.uid);
      if (result.success) {
        setUserGroups(result.groups || []);
      }
    } catch (error) {
      console.error('Error loading user groups:', error);
    }
  };

  const createNewGroup = async (groupName, groupPhotoUrl = null) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };
    
    try {
      const result = await createGroup(groupName, user.uid, groupPhotoUrl);
      if (result.success) {
        await loadUserGroups(); // Refresh groups list
      }
      return result;
    } catch (error) {
      console.error('Error creating group:', error);
      return { success: false, error: error.message };
    }
  };

  const selectGroup = async (groupId) => {
    setSelectedGroup(groupId);
    if (groupId) {
      await loadGroupMembers(groupId);
    } else {
      setGroupMembers([]);
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const result = await getGroupMembers(groupId);
      if (result.success) {
        setGroupMembers(result.members || []);
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const addMemberToGroup = async (groupId, userId, role = 'member') => {
    try {
      const result = await addGroupMember(groupId, userId, role);
      if (result.success && selectedGroup === groupId) {
        await loadGroupMembers(groupId); // Refresh members list
      }
      return result;
    } catch (error) {
      console.error('Error adding member:', error);
      return { success: false, error: error.message };
    }
  };

  const removeMemberFromGroup = async (membershipId, groupId) => {
    try {
      const result = await removeGroupMember(membershipId);
      if (result.success && selectedGroup === groupId) {
        await loadGroupMembers(groupId); // Refresh members list
      }
      return result;
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }
  };

  const updateMemberRoleInGroup = async (membershipId, newRole, groupId) => {
    try {
      const result = await updateMemberRole(membershipId, newRole);
      if (result.success && selectedGroup === groupId) {
        await loadGroupMembers(groupId); // Refresh members list
      }
      return result;
    } catch (error) {
      console.error('Error updating member role:', error);
      return { success: false, error: error.message };
    }
  };

  const checkUserRole = async (groupId, userId) => {
    try {
      return await getUserRoleInGroup(groupId, userId);
    } catch (error) {
      console.error('Error checking user role:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteGroup = async (groupId) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };
    
    try {
      // Get token from Firebase Auth (works for both email/password and Google login)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'No authenticated user found' };
      }
      
      const token = await currentUser.getIdToken();
      
      // Call backend API to delete group (will delete from both MySQL and Firebase)
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh groups list
        await loadUserGroups();
        
        // Clear selected group if it was the deleted one
        if (selectedGroup === groupId) {
          setSelectedGroup(null);
          setGroupMembers([]);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting group:', error);
      return { success: false, error: error.message };
    }
  };

  const leaveGroup = async (groupId) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };
    
    try {
      // Get token from Firebase Auth (works for both email/password and Google login)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'No authenticated user found' };
      }
      
      const token = await currentUser.getIdToken();
      
      // Call backend API to leave group (will remove member from both MySQL and Firebase)
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh groups list
        await loadUserGroups();
        
        // Clear selected group if it was the one we left
        if (selectedGroup === groupId) {
          setSelectedGroup(null);
          setGroupMembers([]);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error leaving group:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    updateProfile,
    
    // Groups
    userGroups,
    selectedGroup,
    groupMembers,
    loadUserGroups,
    createNewGroup,
    selectGroup,
    loadGroupMembers,
    addMemberToGroup,
    removeMemberFromGroup,
    updateMemberRoleInGroup,
    checkUserRole,
    deleteGroup,
    leaveGroup
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
