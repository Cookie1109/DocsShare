import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Github } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-8 w-8 bg-green-400 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DS</span>
              </div>
              <span className="text-xl font-bold text-green-400">DocsShare</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              Nền tảng chia sẻ tài liệu học tập hàng đầu, giúp sinh viên dễ dàng tìm kiếm và chia sẻ kiến thức.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-green-400 transition-colors duration-200">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-400 transition-colors duration-200">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-400 transition-colors duration-200">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-400 transition-colors duration-200">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-400">Liên kết nhanh</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/documents" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Tài liệu
                </Link>
              </li>
              <li>
                <Link to="/upload" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Tải lên tài liệu
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Danh mục
                </Link>
              </li>
              <li>
                <Link to="/search" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Tìm kiếm
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-400">Hỗ trợ</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/help" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Trung tâm trợ giúp
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Liên hệ
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Chính sách bảo mật
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm">
                  Điều khoản sử dụng
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-400">Thông tin liên hệ</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">support@docsshare.com</span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">+84 123 456 789</span>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">Hà Nội, Việt Nam</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} DocsShare. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Bảo mật
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Điều khoản
              </Link>
              <Link to="/sitemap" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Sơ đồ trang
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
