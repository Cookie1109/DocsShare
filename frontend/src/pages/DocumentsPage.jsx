import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  FileText, 
  Calendar,
  User,
  Tag,
  ArrowUpDown,
  Grid,
  List
} from 'lucide-react';

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data - sẽ được thay thế bằng API call
  const mockDocuments = [
    {
      id: '1',
      title: 'Giáo trình Lập trình Python cơ bản',
      description: 'Tài liệu hướng dẫn lập trình Python từ cơ bản đến nâng cao dành cho người mới bắt đầu.',
      category: 'Lập trình',
      tags: ['python', 'programming', 'beginner'],
      fileName: 'python-tutorial.pdf',
      fileType: 'pdf',
      fileSize: '2.5 MB',
      uploaderId: '1',
      uploaderName: 'Nguyễn Văn A',
      uploadDate: '2025-09-10',
      downloads: 234,
      views: 456
    },
    {
      id: '2',
      title: 'Bài tập Toán cao cấp A1',
      description: 'Tổng hợp các bài tập toán cao cấp A1 có lời giải chi tiết.',
      category: 'Toán học',
      tags: ['math', 'calculus', 'exercises'],
      fileName: 'math-exercises.pdf',
      fileType: 'pdf',
      fileSize: '1.8 MB',
      uploaderId: '2',
      uploaderName: 'Trần Thị B',
      uploadDate: '2025-09-09',
      downloads: 189,
      views: 298
    },
    {
      id: '3',
      title: 'Slide bài giảng Vật lý đại cương',
      description: 'Slide bài giảng vật lý đại cương đầy đủ cho sinh viên năm nhất.',
      category: 'Vật lý',
      tags: ['physics', 'slides', 'university'],
      fileName: 'physics-slides.pptx',
      fileType: 'pptx',
      fileSize: '4.2 MB',
      uploaderId: '3',
      uploaderName: 'Lê Văn C',
      uploadDate: '2025-09-08',
      downloads: 156,
      views: 234
    }
  ];

  const categories = [
    'Tất cả',
    'Lập trình',
    'Toán học', 
    'Vật lý',
    'Hóa học',
    'Tiếng Anh',
    'Kinh tế'
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setDocuments(mockDocuments);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === '' || selectedCategory === 'Tất cả' || doc.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.uploadDate) - new Date(a.uploadDate);
      case 'oldest':
        return new Date(a.uploadDate) - new Date(b.uploadDate);
      case 'mostDownloaded':
        return b.downloads - a.downloads;
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const getFileIcon = (fileType) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'ppt':
      case 'pptx':
        return '📊';
      case 'xls':
      case 'xlsx':
        return '📈';
      default:
        return '📁';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải tài liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thư viện tài liệu</h1>
          <p className="text-gray-600">Khám phá hàng nghìn tài liệu học tập chất lượng cao</p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {categories.map(category => (
                <option key={category} value={category === 'Tất cả' ? '' : category}>
                  {category}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="mostDownloaded">Nhiều lượt tải nhất</option>
              <option value="title">Tên A-Z</option>
            </select>

            {/* View Mode */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${
                  viewMode === 'grid' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${
                  viewMode === 'list' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Tìm thấy {sortedDocuments.length} tài liệu</span>
            <span>Hiển thị {Math.min(sortedDocuments.length, 12)} tài liệu đầu tiên</span>
          </div>
        </div>

        {/* Documents Grid/List */}
        {sortedDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Không tìm thấy tài liệu</h3>
            <p className="text-gray-600">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc</p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }>
            {sortedDocuments.map((document) => (
              <div
                key={document.id}
                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition duration-200 ${
                  viewMode === 'list' ? 'flex items-center p-4' : 'p-6'
                }`}
              >
                {viewMode === 'grid' ? (
                  <>
                    {/* Grid View */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getFileIcon(document.fileType)}</div>
                        <div>
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            {document.category}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{document.fileType.toUpperCase()}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{document.fileSize}</span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {document.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {document.description}
                    </p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {document.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <Eye className="h-4 w-4" />
                          <span>{document.views}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Download className="h-4 w-4" />
                          <span>{document.downloads}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(document.uploadDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        <span>{document.uploaderName}</span>
                      </div>
                      <Link
                        to={`/document/${document.id}`}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition duration-200"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    {/* List View */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-2xl">{getFileIcon(document.fileType)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {document.title}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {document.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            {document.category}
                          </span>
                          <span>{document.uploaderName}</span>
                          <span>{formatDate(document.uploadDate)}</span>
                          <span>{document.fileSize}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 ml-4">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Eye className="h-4 w-4" />
                          <span>{document.views}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Download className="h-4 w-4" />
                          <span>{document.downloads}</span>
                        </div>
                      </div>
                      <Link
                        to={`/document/${document.id}`}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition duration-200"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {sortedDocuments.length > 12 && (
          <div className="mt-8 flex items-center justify-center">
            <nav className="flex items-center space-x-2">
              <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Trước
              </button>
              <button className="px-3 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-md">
                1
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                2
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                3
              </button>
              <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Sau
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
