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
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

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

  // Load user groups when user changes
  useEffect(() => {
    if (user?.uid && !profileIncomplete) {
      loadUserGroups();
    }
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
      // Check if user is admin/creator
      const roleCheck = await checkUserRole(groupId, user.uid);
      if (!roleCheck.success || roleCheck.role !== 'admin') {
        return { success: false, error: 'Only admin can delete group' };
      }

      // Delete group from Firestore
      const result = await deleteGroupFromFirestore(groupId);
      if (result.success) {
        await loadUserGroups(); // Refresh groups list
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
      // Find user's membership
      const userMember = groupMembers.find(member => member.userId === user.uid);
      if (!userMember) {
        return { success: false, error: 'You are not a member of this group' };
      }

      // Check if this is the last member in the group
      if (groupMembers.length === 1) {
        // If only one member left, delete the entire group
        const deleteResult = await deleteGroupFromFirestore(groupId);
        if (deleteResult.success) {
          await loadUserGroups(); // Refresh groups list
          if (selectedGroup === groupId) {
            setSelectedGroup(null);
            setGroupMembers([]);
          }
        }
        return deleteResult;
      } else {
        // Remove user from group normally
        const result = await removeMemberFromGroup(userMember.membershipId, groupId);
        if (result.success) {
          await loadUserGroups(); // Refresh groups list
          if (selectedGroup === groupId) {
            setSelectedGroup(null);
            setGroupMembers([]);
          }
        }
        return result;
      }
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
