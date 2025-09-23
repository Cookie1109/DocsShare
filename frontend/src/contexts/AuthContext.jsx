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
  deleteGroupFromFirestore
} from '../services/firebase';

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

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserData(firebaseUser.uid);
        if (userData.success) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            ...userData.data
          });
        }
      } else {
        setUser(null);
        setUserGroups([]);
        setSelectedGroup(null);
        setGroupMembers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user groups when user changes
  useEffect(() => {
    if (user?.uid) {
      loadUserGroups();
    }
  }, [user?.uid]);

  const login = async (email, password) => {
    try {
      const result = await signInWithCredentials(email, password);
      
      if (result.success) {
        const userData = await getUserData(result.user.uid);
        if (userData.success) {
          setUser({
            uid: result.user.uid,
            email: result.user.email,
            ...userData.data
          });
          return { success: true };
        } else {
          // User authenticated but no user data found
          return { success: false, error: 'Không thể lấy thông tin người dùng' };
        }
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
        const userDataResult = await getUserData(result.user.uid);
        if (userDataResult.success) {
          setUser({
            uid: result.user.uid,
            email: result.user.email,
            ...userDataResult.data
          });
          return { success: true };
        }
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
      
      if (result.success) {
        const userData = await getUserData(result.user.uid);
        if (userData.success) {
          setUser({
            uid: result.user.uid,
            email: result.user.email,
            ...userData.data
          });
          return { success: true };
        }
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
      
      const updatedUser = { ...user, ...updatedData };
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
