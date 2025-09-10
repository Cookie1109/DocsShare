import React from 'react';
import { Link } from 'react-router-dom';

const SimpleHomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            DocsShare - Chia sẻ Tài liệu Học tập
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Nền tảng chia sẻ tài liệu học tập tốt nhất cho sinh viên
          </p>
          <div className="space-x-4">
            <Link 
              to="/login" 
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition duration-200"
            >
              Đăng nhập
            </Link>
            <Link 
              to="/register" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleHomePage;
