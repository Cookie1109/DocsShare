import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Tag as TagIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UploadPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: []
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [errors, setErrors] = useState({});

  const { user } = useAuth();
  const navigate = useNavigate();

  const categories = [
    'Lập trình',
    'Toán học',
    'Vật lý',
    'Hóa học',
    'Tiếng Anh',
    'Kinh tế',
    'Khoa học máy tính',
    'Kỹ thuật',
    'Y học',
    'Luật',
    'Khác'
  ];

  const allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-rar-compressed'
  ];

  const maxFileSize = 25 * 1024 * 1024; // 25MB

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileSelect = (file) => {
    // Validate file type
    if (!allowedFileTypes.includes(file.type)) {
      setMessage({
        type: 'error',
        content: 'Loại file không được hỗ trợ. Chỉ chấp nhận: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, RAR'
      });
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setMessage({
        type: 'error',
        content: 'File quá lớn. Kích thước tối đa là 25MB'
      });
      return;
    }

    setSelectedFile(file);
    setMessage({ type: '', content: '' });

    // Auto-fill title if empty
    if (!formData.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      setFormData(prev => ({
        ...prev,
        title: fileName
      }));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Tiêu đề là bắt buộc';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Tiêu đề phải có ít nhất 5 ký tự';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Mô tả là bắt buộc';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Mô tả phải có ít nhất 10 ký tự';
    }

    if (!formData.category) {
      newErrors.category = 'Vui lòng chọn danh mục';
    }

    if (!selectedFile) {
      newErrors.file = 'Vui lòng chọn file để tải lên';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setUploading(true);
    setMessage({ type: '', content: '' });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful upload
      setMessage({
        type: 'success',
        content: 'Tải lên tài liệu thành công! Đang chuyển hướng...'
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        tags: []
      });
      setSelectedFile(null);

      // Redirect after delay
      setTimeout(() => {
        navigate('/my-documents');
      }, 2000);

    } catch (error) {
      setMessage({
        type: 'error',
        content: 'Đã xảy ra lỗi khi tải lên. Vui lòng thử lại.'
      });
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (file) => {
    if (!file) return File;
    
    const type = file.type;
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('presentation')) return '📊';
    if (type.includes('sheet')) return '📈';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📁';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tải lên tài liệu</h1>
          <p className="text-gray-600">Chia sẻ kiến thức của bạn với cộng đồng</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Message */}
          {message.content && (
            <div className={`rounded-lg p-4 flex items-center space-x-2 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{message.content}</span>
            </div>
          )}

          {/* File Upload */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Chọn file</h2>
            
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition duration-200 ${
                  dragOver 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">
                    Kéo thả file vào đây hoặc
                  </p>
                  <label className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 cursor-pointer transition duration-200">
                    <span>Chọn file</span>
                    <input
                      type="file"
                      onChange={handleFileInputChange}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Hỗ trợ: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, RAR (tối đa 25MB)
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{getFileIcon(selectedFile)}</div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            
            {errors.file && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.file}
              </p>
            )}
          </div>

          {/* Document Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin tài liệu</h2>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Nhập tiêu đề tài liệu"
                />
                {errors.title && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả *
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Mô tả nội dung tài liệu, đối tượng sử dụng, v.v..."
                />
                {errors.description && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Danh mục *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    errors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.category}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (từ khóa)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full"
                    >
                      <TagIcon className="h-3 w-3 mr-1" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Nhập tag và nhấn Enter"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition duration-200"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Thêm các từ khóa để người khác dễ tìm thấy tài liệu
                </p>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition duration-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang tải lên...
                </div>
              ) : (
                'Tải lên'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadPage;
