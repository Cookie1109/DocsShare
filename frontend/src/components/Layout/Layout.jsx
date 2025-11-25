import React from 'react';
import Header from './Header';
import Footer from './Footer';
import ChatbotButton from '../Chatbot/ChatbotButton';

const Layout = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} onLogout={onLogout} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      
      {/* Chatbot Button - chỉ hiển thị khi user đã đăng nhập */}
      {user && <ChatbotButton />}
    </div>
  );
};

export default Layout;
