import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithCredentials, 
  signInWithGoogle, 
  signUpWithEmail, 
  signOutUser, 
  onAuthStateChange,
  getUserData,
  checkUsernameExists
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
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
        }
      }
      
      return { success: false, error: result.error || 'Đăng nhập thất bại' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Email hoặc mật khẩu không đúng' };
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
