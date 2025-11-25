import { useState } from 'react';
import ChatbotModal from './ChatbotModal';

/**
 * ChatbotButton - Nút floating ở góc dưới bên phải màn hình
 */
const ChatbotButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 z-40 group"
        aria-label="Mở trợ lý tìm kiếm thông minh"
      >
        {/* Button Circle */}
        <div className="relative">
          <div className={`
            w-16 h-16 rounded-full bg-green-600
            flex items-center justify-center shadow-lg
            transition-all duration-300 transform
            ${isHovered ? 'scale-110 shadow-2xl' : 'scale-100'}
            hover:bg-green-700
          `}>
            {/* Chatbot Icon */}
            <svg 
              className="w-8 h-8 text-white" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M17.753 14a2.25 2.25 0 0 1 2.25 2.25v.904A3.75 3.75 0 0 1 18.696 20c-1.565 1.344-3.806 2-6.696 2-2.89 0-5.128-.656-6.69-2a3.75 3.75 0 0 1-1.306-2.843v-.908a2.25 2.25 0 0 1 2.247-2.25H17.753zM12 2.003a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/>
            </svg>
            {/* Sparkle decoration */}
            <svg className="w-3 h-3 text-white absolute top-2 right-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
          </div>

          {/* Notification Badge (Optional - có thể dùng để hiển thị số tin nhắn mới) */}
          {/* <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">3</span>
          </div> */}
        </div>

        {/* Tooltip */}
        <div className={`
          absolute bottom-full right-0 mb-2 px-3 py-2 
          bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap
          transition-all duration-200
          ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
        `}>
          Trợ lý tìm kiếm thông minh
          <div className="absolute top-full right-6 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </button>

      {/* Chatbot Modal */}
      <ChatbotModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default ChatbotButton;
