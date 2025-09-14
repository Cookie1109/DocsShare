import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  Users, 
  Shield, 
  Zap,
  ArrowRight,
  FileText,
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Hash
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    displayName: '',
    userTag: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    // Mock login - in real app, validate with backend
    const success = await login(loginData.email, loginData.password);
    if (success) {
      setShowLoginModal(false);
      navigate('/chat');
    }
  };

  const handleGoogleLogin = async () => {
    // Mock Google login - in real app, integrate with Google OAuth
    console.log('Google login clicked');
    // For demo, just redirect to chat
    setShowLoginModal(false);
    navigate('/chat');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      alert('Mật khẩu không khớp!');
      return;
    }
    if (!registerData.displayName.trim() || !registerData.userTag.trim()) {
      alert('Vui lòng nhập đầy đủ tên hiển thị và tag!');
      return;
    }
    // Create full username
    const fullUsername = `${registerData.displayName}#${registerData.userTag}`;
    const userData = { ...registerData, username: fullUsername };
    
    // Mock register - in real app, call backend API
    console.log('Registering user:', userData);
    setShowRegisterModal(false);
    setShowLoginModal(true);
  };

  const handleGoogleRegister = async () => {
    // Mock Google register - in real app, integrate with Google OAuth
    console.log('Google register clicked');
    // For demo, just redirect to chat
    setShowRegisterModal(false);
    navigate('/chat');
  };

  const features = [
    {
      icon: <Upload className="h-8 w-8 text-emerald-500" />,
      title: "Chia Sẻ File Dễ Dàng",
      description: "Upload và chia sẻ tài liệu học tập trong nhóm một cách nhanh chóng và tiện lợi."
    },
    {
      icon: <Users className="h-8 w-8 text-emerald-600" />,
      title: "Chat Nhóm Thông Minh", 
      description: "Trao đổi và thảo luận về tài liệu trực tiếp trong nhóm học tập."
    },
    {
      icon: <Shield className="h-8 w-8 text-orange-500" />,
      title: "Bảo Mật Tuyệt Đối",
      description: "Dữ liệu được bảo vệ an toàn, chỉ thành viên nhóm mới có thể truy cập."
    },
    {
      icon: <Zap className="h-8 w-8 text-emerald-500" />,
      title: "Tốc Độ Cao",
      description: "Tải lên và tải xuống file với tốc độ nhanh, giao diện mượt mà."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm fixed w-full top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img src="/Logo.png" alt="DocsShare" className="w-10 h-10" />
              <span className="text-2xl font-bold text-gray-800">DocsShare</span>
            </div>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 text-gray-600 hover:text-emerald-600 transition-colors"
              >
                Đăng nhập
              </button>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
              >
                Đăng ký
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 lg:pt-28 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-800 mb-6">
              Chia sẻ tài liệu 
              <span className="text-emerald-500"> học tập</span>
              <br />
              <span className="text-emerald-600">thông minh</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Nền tảng chia sẻ tài liệu và chat nhóm dành riêng cho sinh viên. 
              Tạo nhóm học tập, upload file và trao đổi kiến thức một cách dễ dàng.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
              >
                Bắt đầu miễn phí
                <ArrowRight className="inline-block ml-2 h-5 w-5" />
              </button>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-8 py-4 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-xl font-semibold transition-all"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
              Tại sao chọn DocsShare?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Được thiết kế đặc biệt cho sinh viên với những tính năng thông minh và tiện lợi
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition-all transform hover:scale-105">
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center mb-6">
              <img src="/Logo.png" alt="DocsShare" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Đăng nhập</h2>
              <p className="text-gray-600">Chào mừng bạn trở lại!</p>
            </div>

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Đăng nhập với Google
            </button>

            <div className="flex items-center justify-center mb-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-500">hoặc</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Tài khoản"
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mật khẩu"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
              >
                Đăng nhập
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-gray-600">
                Chưa có tài khoản?{' '}
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                  className="text-emerald-500 hover:text-emerald-600 font-semibold"
                >
                  Đăng ký ngay
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center mb-6">
              <img src="/Logo.png" alt="DocsShare" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Đăng ký</h2>
              <p className="text-gray-600">Tạo tài khoản mới để bắt đầu</p>
            </div>

            {/* Google Register Button */}
            <button
              onClick={handleGoogleRegister}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Đăng ký với Google
            </button>

            <div className="flex items-center justify-center mb-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-500">hoặc</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Username với format Name#Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tên hiển thị"
                    value={registerData.displayName}
                    onChange={(e) => setRegisterData({...registerData, displayName: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="1109"
                    value={registerData.userTag}
                    onChange={(e) => setRegisterData({...registerData, userTag: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Preview Username */}
              {(registerData.displayName || registerData.userTag) && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-700">
                    <span className="font-semibold">Username: </span>
                    {registerData.displayName || 'Tên'}#{registerData.userTag || 'Tag'}
                  </p>
                </div>
              )}

              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Tài khoản"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>



              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mật khẩu"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Xác nhận mật khẩu"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
              >
                Đăng ký
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-gray-600">
                Đã có tài khoản?{' '}
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    setShowLoginModal(true);
                  }}
                  className="text-emerald-500 hover:text-emerald-600 font-semibold"
                >
                  Đăng nhập ngay
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;