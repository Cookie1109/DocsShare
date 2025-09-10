import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Mock user data for demo
  useEffect(() => {
    // Simulate checking for saved login state
    const savedUser = localStorage.getItem('docsshare_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('docsshare_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      // Mock login - replace with actual Firebase auth
      if (email === 'demo@docsshare.com' && password === 'demo123') {
        const userData = {
          id: '1',
          name: 'Người dùng Demo',
          email: 'demo@docsshare.com',
          avatar: null,
          role: 'member',
          joinDate: new Date().toISOString(),
        };
        
        setUser(userData);
        localStorage.setItem('docsshare_user', JSON.stringify(userData));
        return { success: true };
      } else {
        return { 
          success: false, 
          error: 'Email hoặc mật khẩu không đúng' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Đã xảy ra lỗi khi đăng nhập' 
      };
    }
  };

  const register = async (userData) => {
    try {
      // Mock registration - replace with actual Firebase auth
      const newUser = {
        id: Date.now().toString(),
        name: userData.name,
        email: userData.email,
        avatar: null,
        role: 'member',
        joinDate: new Date().toISOString(),
      };
      
      setUser(newUser);
      localStorage.setItem('docsshare_user', JSON.stringify(newUser));
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Đã xảy ra lỗi khi đăng ký' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('docsshare_user');
  };

  const updateProfile = async (updatedData) => {
    try {
      const updatedUser = { ...user, ...updatedData };
      setUser(updatedUser);
      localStorage.setItem('docsshare_user', JSON.stringify(updatedUser));
      return { success: true };
    } catch (error) {
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
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
