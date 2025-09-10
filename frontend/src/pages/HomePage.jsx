import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageCircle, 
  Upload, 
  Download, 
  Users, 
  Shield, 
  Zap,
  ArrowRight,
  FileText
} from 'lucide-react';

const HomePage = () => {
  const features = [
    {
      icon: <MessageCircle className="h-8 w-8 text-green-500" />,
      title: "Chat Nhóm Thông Minh",
      description: "Giao tiếp và chia sẻ file trong các nhóm học tập một cách dễ dàng, giống như Zalo nhưng chuyên cho việc học."
    },
    {
      icon: <Upload className="h-8 w-8 text-blue-500" />,
      title: "Upload File Đa Dạng", 
      description: "Hỗ trợ tải lên nhiều định dạng file: PDF, DOC, PPT, hình ảnh và nhiều loại khác với dung lượng lớn."
    },
    {
      icon: <Shield className="h-8 w-8 text-purple-500" />,
      title: "Bảo Mật Cao",
      description: "Dữ liệu được mã hóa và bảo mật tuyệt đối. Chỉ thành viên nhóm mới có thể truy cập file được chia sẻ."
    },
    {
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      title: "Tốc Độ Nhanh",
      description: "Upload và download file với tốc độ cao. Giao diện mượt mà, responsive trên mọi thiết bị."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-green-600 via-green-500 to-blue-600 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-10 rounded-full animate-pulse delay-1000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
              <span className="bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">
                DocShare
              </span>
              <br />
              <span className="text-green-200 text-3xl md:text-4xl lg:text-5xl">
                Chia sẻ - Học tập - Phát triển
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-12 text-green-100 max-w-4xl mx-auto leading-relaxed">
              Nền tảng chia sẻ tài liệu học tập thông minh với giao diện chat nhóm hiện đại. 
              Kết nối sinh viên, giảng viên và cộng đồng học tập trên toàn quốc.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-16">
              <Link
                to="/chat"
                className="group inline-flex items-center px-8 py-4 bg-white text-green-600 rounded-full text-lg font-semibold hover:bg-green-50 transform hover:scale-105 transition-all duration-300 shadow-2xl"
              >
                <MessageCircle className="mr-3 h-6 w-6" />
                Bắt đầu chat nhóm
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                to="/register"
                className="group inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-full text-lg font-semibold hover:bg-white hover:text-green-600 transform hover:scale-105 transition-all duration-300"
              >
                <Users className="mr-3 h-6 w-6" />
                Tham gia ngay
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Tại sao chọn DocShare?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Chúng tôi mang đến trải nghiệm chia sẻ tài liệu học tập tốt nhất với các tính năng hiện đại và bảo mật cao.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 border border-gray-100">
                <div className="mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-r from-green-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Cách thức hoạt động
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Chỉ với 3 bước đơn giản, bạn đã có thể bắt đầu chia sẻ và học tập cùng cộng đồng.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Đăng ký tài khoản</h3>
              <p className="text-gray-600">
                Tạo tài khoản miễn phí và tham gia cộng đồng học tập DocShare
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Tạo hoặc tham gia nhóm</h3>
              <p className="text-gray-600">
                Tạo nhóm học tập của bạn hoặc tham gia các nhóm đã có sẵn
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Chia sẻ & học tập</h3>
              <p className="text-gray-600">
                Upload tài liệu, download từ thành viên khác và học tập hiệu quả
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Sẵn sàng bắt đầu học tập?
          </h2>
          <p className="text-xl mb-12 text-green-100">
            Tham gia cộng đồng DocShare ngay hôm nay và trải nghiệm cách chia sẻ tài liệu học tập hiện đại nhất!
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link
              to="/register"
              className="inline-flex items-center px-8 py-4 bg-white text-green-600 rounded-full text-lg font-semibold hover:bg-green-50 transform hover:scale-105 transition-all duration-300 shadow-2xl"
            >
              <Users className="mr-3 h-6 w-6" />
              Đăng ký miễn phí
            </Link>
            
            <Link
              to="/login"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-full text-lg font-semibold hover:bg-white hover:text-green-600 transform hover:scale-105 transition-all duration-300"
            >
              <MessageCircle className="mr-3 h-6 w-6" />
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
