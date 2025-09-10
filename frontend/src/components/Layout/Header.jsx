import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, User, Settings, LogOut, Menu, X } from 'lucide-react';

const Header = ({ user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-green-600 rounded-lg flex items-center justify-center p-1">
                <img src="/Logo.png" alt="DocsShare" className="h-full w-full object-contain" />
              </div>
              <span className="text-xl font-bold text-green-600">DocsShare</span>
            </Link>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm tài liệu..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150 ease-in-out"
                />
              </div>
            </form>
          </div>

          {/* Navigation & User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                {/* Navigation Links */}
                <nav className="flex space-x-6">
                  <Link 
                    to="/chat" 
                    className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                  >
                    Chat nhóm
                  </Link>
                  <Link 
                    to="/documents" 
                    className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                  >
                    Tài liệu
                  </Link>
                  <Link 
                    to="/upload" 
                    className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                  >
                    Tải lên
                  </Link>
                  <Link 
                    to="/my-documents" 
                    className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                  >
                    Của tôi
                  </Link>
                </nav>

                {/* Notifications */}
                <button className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 transition duration-150 ease-in-out">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center space-x-2 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-150 ease-in-out"
                  >
                    <img
                      className="h-8 w-8 rounded-full object-cover border-2 border-gray-200"
                      src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=22c55e&color=fff`}
                      alt={user?.name || 'User'}
                    />
                    <span className="text-gray-700 font-medium">{user?.name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition duration-150 ease-in-out"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Hồ sơ
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition duration-150 ease-in-out"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Cài đặt
                      </Link>
                      <button
                        onClick={() => {
                          onLogout();
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition duration-150 ease-in-out"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150 ease-in-out"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out"
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gray-200">
              {/* Mobile Search */}
              <div className="px-3 py-2">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm tài liệu..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </form>
              </div>

              {user ? (
                <>
                  <Link
                    to="/chat"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Chat nhóm
                  </Link>
                  <Link
                    to="/documents"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Tài liệu
                  </Link>
                  <Link
                    to="/upload"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Tải lên
                  </Link>
                  <Link
                    to="/my-documents"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Của tôi
                  </Link>
                  <Link
                    to="/profile"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Hồ sơ
                  </Link>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="block px-3 py-2 rounded-md text-base font-medium bg-green-600 text-white hover:bg-green-700 transition duration-150 ease-in-out"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
