import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to chat if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  return !user ? children : <Navigate to="/chat" replace />;
};

// App Content Component
const AppContent = () => {
  const { user, logout } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />

        {/* Landing Page */}
        <Route path="/" element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        } />

        {/* Routes with Layout */}
        <Route path="/home" element={
          <Layout user={user} onLogout={logout}>
            <HomePage />
          </Layout>
        } />

        {/* Chat Route - Main feature */}
        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />

        {/* Protected Routes - will be added later */}
        <Route path="/documents" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={logout}>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Trang Tài liệu</h1>
                  <p className="text-gray-600">Tính năng đang được phát triển...</p>
                </div>
              </div>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/upload" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={logout}>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Tải lên Tài liệu</h1>
                  <p className="text-gray-600">Tính năng đang được phát triển...</p>
                </div>
              </div>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/my-documents" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={logout}>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Tài liệu của tôi</h1>
                  <p className="text-gray-600">Tính năng đang được phát triển...</p>
                </div>
              </div>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout user={user} onLogout={logout}>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Hồ sơ cá nhân</h1>
                  <p className="text-gray-600">Tính năng đang được phát triển...</p>
                </div>
              </div>
            </Layout>
          </ProtectedRoute>
        } />

        {/* 404 Route */}
        <Route path="*" element={
          <Layout user={user} onLogout={logout}>
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600 mb-8">Trang không tồn tại</p>
                <a href="/" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                  Về trang chủ
                </a>
              </div>
            </div>
          </Layout>
        } />
      </Routes>
    </Router>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
