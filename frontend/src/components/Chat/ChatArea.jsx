import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  File, 
  Download, 
  Eye, 
  Users, 
  Settings, 
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  Archive,
  MoreVertical,
  Search,
  Bell,
  ChevronDown,
  Plus,
  Send,
  Clock
} from 'lucide-react';

const ChatArea = ({ selectedGroup, user }) => {
  const [documents, setDocuments] = useState([
    {
      id: '1',
      name: 'LeagueClient.exe',
      size: '28.4 MB',
      type: 'exe',
      uploadedBy: 'Người dùng Demo',
      uploadedAt: '2025-09-11T09:00:00Z', // Sáng sớm
      downloads: 0,
      views: 0,
      isOwn: false // File của người khác
    },
    {
      id: '2', 
      name: 'React Hooks Guide.pdf',
      size: '2.5 MB',
      type: 'pdf',
      uploadedBy: 'Nguyễn Văn A',
      uploadedAt: '2025-09-11T10:30:00Z', // 10h30
      downloads: 12,
      views: 25,
      isOwn: false // File của người khác
    },
    {
      id: '3',
      name: 'Component Architecture.pptx',
      size: '3.8 MB',
      type: 'pptx',
      uploadedBy: 'Bạn',
      uploadedAt: '2025-09-11T11:45:00Z', // 11h45
      downloads: 8,
      views: 18,
      isOwn: true // File của mình
    },
    {
      id: '4',
      name: 'Code Examples.zip',
      size: '12.3 MB',
      type: 'zip',
      uploadedBy: 'Lê Văn C',
      uploadedAt: '2025-09-11T13:10:00Z', // 13h10
      downloads: 15,
      views: 22,
      isOwn: false // File của người khác
    },
    {
      id: '5',
      name: 'Database Schema.sql',
      size: '1.2 MB',
      type: 'sql',
      uploadedBy: 'Bạn',
      uploadedAt: '2025-09-11T14:20:00Z', // 14h20 - File mới nhất
      downloads: 3,
      views: 8,
      isOwn: true // File của mình
    }
  ]);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const chatAreaRef = useRef(null); // Ref cho scroll auto

  // Auto scroll to bottom when new message/file is added
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [documents, uploading]); // Scroll khi documents thay đổi hoặc đang upload

  // Get file icon based on type
  const getFileIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'exe':
      case 'application':
        return <File className="h-8 w-8 text-blue-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-8 w-8 text-blue-500" />;
      case 'ppt':
      case 'pptx':
        return <FileSpreadsheet className="h-8 w-8 text-orange-500" />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
      case 'sql':
      case 'code':
        return <FileCode className="h-8 w-8 text-green-600" />;
      case 'zip':
      case 'rar':
        return <Archive className="h-8 w-8 text-purple-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="h-8 w-8 text-blue-400" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Vừa xong';
    } else if (diffInHours < 24) {
      return `${diffInHours} giờ trước`;
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    // Simulate file upload
    setTimeout(() => {
      const newDocuments = Array.from(files).map((file, index) => ({
        id: Date.now() + index,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        type: file.name.split('.').pop() || 'file',
        uploadedBy: user?.name || 'Bạn',
        uploadedAt: new Date().toISOString(),
        downloads: 0,
        views: 0,
        isOwn: true // QUAN TRỌNG: File mình upload luôn là của mình
      }));
      
      setDocuments(prev => [...prev, ...newDocuments]); // Thêm file mới vào cuối (dưới cùng)
      setUploading(false);
    }, 2000);
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  // Handle download
  const handleDownload = (doc) => {
    // Simulate download
    console.log('Downloading:', doc.name);
    setDocuments(prev => 
      prev.map(d => 
        d.id === doc.id 
          ? { ...d, downloads: d.downloads + 1 }
          : d
      )
    );
  };

  // Handle view
  const handleView = (doc) => {
    // Simulate view
    console.log('Viewing:', doc.name);
    setDocuments(prev => 
      prev.map(d => 
        d.id === doc.id 
          ? { ...d, views: d.views + 1 }
          : d
      )
    );
  };

  // If no group is selected
  if (!selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-32 w-32 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-16 w-16 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Chọn một nhóm để bắt đầu
          </h2>
          <p className="text-gray-500">
            Chọn một nhóm từ danh sách bên trái để xem và chia sẻ tài liệu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header - Zalo style - Fixed */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Group Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {selectedGroup?.name?.charAt(0).toUpperCase() || 'G'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{selectedGroup?.name || 'Nhóm Chat'}</h3>
              <p className="text-sm text-gray-500">{selectedGroup?.memberCount || 0} thành viên</p>
            </div>
          </div>
          
          {/* Right Side - Search and Menu */}
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages Area - Zalo style - Scrollable */}
      <div 
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File Messages */}
        {documents.map((doc) => (
          <div key={doc.id} className={`flex ${doc.isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md ${doc.isOwn ? 'mr-4' : 'ml-4'}`}>
              {/* Sender Name - chỉ hiện cho tin nhắn người khác */}
              {!doc.isOwn && (
                <p className="text-xs text-gray-500 mb-1 ml-2">{doc.uploadedBy}</p>
              )}
              
              {/* File Message Bubble */}
              <div className={`rounded-2xl p-4 shadow-sm relative ${
                doc.isOwn 
                  ? 'bg-green-500 text-white ml-8' 
                  : 'bg-gray-100 text-gray-900 border border-gray-200 mr-8'
              }`}>
                {/* Chat bubble tail */}
                <div className={`absolute top-4 w-3 h-3 ${
                  doc.isOwn 
                    ? '-right-1 bg-green-500 transform rotate-45' 
                    : '-left-1 bg-gray-100 border-l border-b border-gray-200 transform rotate-45'
                }`}></div>
                
                <div className="flex items-center space-x-3">
                  <div className={`flex-shrink-0 ${doc.isOwn ? 'text-green-100' : 'text-gray-600'}`}>
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${doc.isOwn ? 'text-white' : 'text-gray-900'}`}>
                      {doc.name}
                    </p>
                    <p className={`text-xs ${doc.isOwn ? 'text-green-100' : 'text-gray-600'}`}>
                      {doc.size}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleView(doc)}
                      className={`p-1.5 rounded-full transition-colors ${
                        doc.isOwn 
                          ? 'hover:bg-green-600 text-green-100 hover:text-white' 
                          : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                      }`}
                      title="Xem file"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className={`p-1.5 rounded-full transition-colors ${
                        doc.isOwn 
                          ? 'hover:bg-green-600 text-green-100 hover:text-white' 
                          : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                      }`}
                      title="Tải xuống"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* File Stats */}
                <div className={`mt-3 text-xs flex items-center space-x-3 ${
                  doc.isOwn ? 'text-green-100' : 'text-gray-500'
                }`}>
                  <span className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {doc.views} lượt xem
                  </span>
                  <span className="flex items-center">
                    <Download className="h-3 w-3 mr-1" />
                    {doc.downloads} tải
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(doc.uploadedAt)}
                  </span>
                </div>
              </div>
              
              {/* Timestamp for own messages */}
              {doc.isOwn && (
                <p className="text-xs text-gray-500 mt-1 text-right mr-2">
                  {formatDate(doc.uploadedAt)}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Upload Loading State */}
        {uploading && (
          <div className="flex justify-end">
            <div className="max-w-xs lg:max-w-md mr-4">
              <div className="bg-green-500 text-white rounded-2xl p-4 shadow-sm relative ml-8">
                {/* Chat bubble tail */}
                <div className="absolute top-4 -right-1 w-3 h-3 bg-green-500 transform rotate-45"></div>
                
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="text-sm">Đang tải lên...</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right mr-2">
                Vừa xong
              </p>
            </div>
          </div>
        )}

        {/* Drag Drop Overlay */}
        {dragOver && (
          <div className="fixed inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center z-10">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-dashed border-green-500">
              <Upload className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 text-center">
                Thả file vào đây để chia sẻ
              </p>
              <p className="text-sm text-gray-500 text-center mt-2">
                Hỗ trợ tất cả định dạng file
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Zalo style - Fixed */}
      <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-10 h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors group"
            title="Chia sẻ file"
          >
            <Paperclip className="h-5 w-5 text-white group-hover:scale-110 transition-transform" />
          </button>
          
          {/* File Upload Area */}
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
            <p className="text-gray-500 text-sm">
              Nhấn vào icon 📎 để chia sẻ file hoặc kéo thả file vào đây
            </p>
          </div>
          
          {/* Send Button (Disabled - for aesthetic) */}
          <button
            disabled
            className="flex-shrink-0 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center cursor-not-allowed"
            title="Chỉ hỗ trợ gửi file"
          >
            <Send className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center justify-center space-x-6 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-green-600 hover:text-green-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Tài liệu</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <FileImage className="h-4 w-4" />
            <span className="text-sm font-medium">Hình ảnh</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <Archive className="h-4 w-4" />
            <span className="text-sm font-medium">File nén</span>
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFileUpload(e.target.files);
          }
        }}
      />
    </div>
  );
};

export default ChatArea;
