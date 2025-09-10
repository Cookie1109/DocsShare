import React from 'react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} onLogout={onLogout} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
