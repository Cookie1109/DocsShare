import { useState, useEffect, useRef } from 'react';
import ChatbotService from '../../services/chatbotService';
import filesService from '../../services/filesService';

/**
 * ChatbotModal - Modal chat với AI assistant
 */
const ChatbotModal = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll to bottom khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input khi mở modal
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      loadStats();
      
      // Tin nhắn chào mừng
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: 'Xin chào! 👋 Tôi là trợ lý tìm kiếm tài liệu thông minh của DocsShare. Tôi có thể giúp bạn:\n\n📁 Tìm file theo tên\n👤 Tìm file do ai đó gửi\n📅 Tìm file theo thời gian\n🏷️ Tìm file theo tags\n📊 Tổng hợp tất cả file của bạn\n\nHãy nói cho tôi biết bạn cần gì nhé!',
          files: null,
          timestamp: new Date()
        }]);
      }
    }
  }, [isOpen]);

  // Load thống kê
  const loadStats = async () => {
    try {
      const response = await ChatbotService.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Thêm tin nhắn của user
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);

    setIsLoading(true);

    try {
      // Chuẩn bị conversation history cho API
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Gửi đến chatbot
      const response = await ChatbotService.sendMessage(userMessage, conversationHistory);

      if (response.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.data.message,
          files: response.data.files || [],
          suggestion: response.data.suggestion,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Đã xảy ra lỗi');
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `❌ Xin lỗi, tôi gặp lỗi: ${error.message}. Vui lòng thử lại sau.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Download file - Same implementation as GroupChat
  const handleDownloadFile = async (file) => {
    console.log('🔽 Downloading file:', file.name);
    
    try {
      // Track download in backend (async - không chờ để không làm chậm download)
      filesService.trackDownload(file.id).then(result => {
        if (result.success) {
          console.log(`✅ Download tracked: ${file.name} - Count: ${result.data.downloadCount}`);
        } else {
          console.warn('⚠️ Failed to track download:', result.error);
        }
      }).catch(err => {
        console.warn('⚠️ Track download error:', err);
      });

      // Fetch file as blob to bypass CORS download name restriction
      const response = await fetch(file.storage_path);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name; // This will work with blob URLs
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Download completed for:', file.name);
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Không thể tải xuống file. Vui lòng thử lại.');
    }
  };

  // Quick actions
  const quickActions = [
    { text: 'Tất cả file của tôi', icon: '📁' },
    { text: 'File gần đây nhất', icon: '🕒' },
    { text: 'File PDF', icon: '📄' },
    { text: 'File được tải nhiều nhất', icon: '⬇️' }
  ];

  const handleQuickAction = (action) => {
    setInputMessage(action.text);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold">Trợ lý tìm kiếm thông minh</h2>
              {stats && (
                <p className="text-sm text-green-100">
                  {stats.totalFiles} files trong {stats.totalGroups} nhóm
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white hover:bg-opacity-20 flex items-center justify-center transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="p-4 bg-gray-50 border-b">
            <p className="text-sm text-gray-600 mb-2">Gợi ý nhanh:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action)}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all text-sm flex items-center gap-2"
                >
                  <span>{action.icon}</span>
                  <span>{action.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-green-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 shadow-sm rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>

                {/* Files List */}
                {message.files && message.files.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {message.files.map((file) => (
                      <div
                        key={file.id}
                        className="bg-white rounded-xl p-4 shadow-sm border border-orange-200 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {/* File Icon */}
                          <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <svg className="w-7 h-7 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </div>

                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate mb-1">{file.name}</h4>
                            
                            {/* Metadata */}
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                              <span className="inline-flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                </svg>
                                {formatFileSize(file.size_bytes)}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {file.uploader_name}#{file.uploader_tag}
                              </span>
                            </div>

                            {/* Tags */}
                            {file.tags && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {file.tags.split(',').map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                                      idx % 4 === 0 ? 'bg-yellow-500' :
                                      idx % 4 === 1 ? 'bg-orange-500' :
                                      idx % 4 === 2 ? 'bg-purple-500' : 'bg-green-500'
                                    }`}
                                  >
                                    #{tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Download Button */}
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center shadow-sm"
                            title="Tải xuống"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion */}
                {message.suggestion && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    💡 {message.suggestion}
                  </div>
                )}

                {/* Timestamp */}
                <div className={`mt-1 text-xs text-gray-500 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Hỏi gì đó về tài liệu của bạn..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                isLoading || !inputMessage.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
              }`}
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span>Gửi</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatbotModal;
