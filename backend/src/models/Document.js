// Mock database cho Document model
// Sẽ được thay thế bằng Firebase Firestore sau này

class Document {
  constructor() {
    this.documents = [
      {
        id: '1',
        title: 'Giáo trình Lập trình Python cơ bản',
        description: 'Tài liệu hướng dẫn lập trình Python từ cơ bản đến nâng cao dành cho người mới bắt đầu.',
        category: 'Lập trình',
        tags: ['python', 'programming', 'beginner'],
        fileName: 'python-tutorial.pdf',
        originalName: 'Giáo trình Python.pdf',
        filePath: '/uploads/documents/python-tutorial-1234567890.pdf',
        fileSize: 2621440, // 2.5MB
        fileType: 'pdf',
        mimeType: 'application/pdf',
        uploaderId: '1',
        uploaderName: 'Người dùng Demo',
        uploadDate: '2025-09-10T10:00:00Z',
        downloads: 234,
        views: 456,
        isPublic: true,
        isApproved: true,
        approvedBy: '2',
        approvedDate: '2025-09-10T11:00:00Z'
      },
      {
        id: '2',
        title: 'Bài tập Toán cao cấp A1',
        description: 'Tổng hợp các bài tập toán cao cấp A1 có lời giải chi tiết.',
        category: 'Toán học',
        tags: ['math', 'calculus', 'exercises'],
        fileName: 'math-exercises.pdf',
        originalName: 'Bài tập Toán A1.pdf',
        filePath: '/uploads/documents/math-exercises-1234567891.pdf',
        fileSize: 1887437, // 1.8MB
        fileType: 'pdf',
        mimeType: 'application/pdf',
        uploaderId: '1',
        uploaderName: 'Người dùng Demo',
        uploadDate: '2025-09-09T14:30:00Z',
        downloads: 189,
        views: 298,
        isPublic: true,
        isApproved: true,
        approvedBy: '2',
        approvedDate: '2025-09-09T15:00:00Z'
      },
      {
        id: '3',
        title: 'Slide bài giảng Vật lý đại cương',
        description: 'Slide bài giảng vật lý đại cương đầy đủ cho sinh viên năm nhất.',
        category: 'Vật lý',
        tags: ['physics', 'slides', 'university'],
        fileName: 'physics-slides.pptx',
        originalName: 'Vật lý đại cương.pptx',
        filePath: '/uploads/documents/physics-slides-1234567892.pptx',
        fileSize: 4398046, // 4.2MB
        fileType: 'pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        uploaderId: '1',
        uploaderName: 'Người dùng Demo',
        uploadDate: '2025-09-08T09:15:00Z',
        downloads: 156,
        views: 234,
        isPublic: true,
        isApproved: true,
        approvedBy: '2',
        approvedDate: '2025-09-08T10:00:00Z'
      }
    ];
    
    this.categories = [
      { name: 'Lập trình', count: 1, icon: '💻' },
      { name: 'Toán học', count: 1, icon: '📊' },
      { name: 'Vật lý', count: 1, icon: '⚛️' },
      { name: 'Hóa học', count: 0, icon: '🧪' },
      { name: 'Tiếng Anh', count: 0, icon: '🌍' },
      { name: 'Kinh tế', count: 0, icon: '💼' }
    ];
  }

  // Lấy tất cả documents
  async getAll(filters = {}) {
    let result = [...this.documents];
    
    // Filter by category
    if (filters.category) {
      result = result.filter(doc => doc.category === filters.category);
    }
    
    // Filter by uploader
    if (filters.uploaderId) {
      result = result.filter(doc => doc.uploaderId === filters.uploaderId);
    }
    
    // Search by title/description
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm) ||
        doc.description.toLowerCase().includes(searchTerm) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    // Filter by approval status
    if (filters.isApproved !== undefined) {
      result = result.filter(doc => doc.isApproved === filters.isApproved);
    }
    
    // Sort
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'newest':
          result.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
          break;
        case 'oldest':
          result.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
          break;
        case 'mostDownloaded':
          result.sort((a, b) => b.downloads - a.downloads);
          break;
        case 'title':
          result.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
    }
    
    return result;
  }

  // Lấy document theo ID
  async findById(id) {
    return this.documents.find(doc => doc.id === id);
  }

  // Tạo document mới
  async create(documentData) {
    const newDocument = {
      id: Date.now().toString(),
      ...documentData,
      uploadDate: new Date().toISOString(),
      downloads: 0,
      views: 0,
      isPublic: true,
      isApproved: false
    };
    
    this.documents.push(newDocument);
    
    // Update category count
    const category = this.categories.find(cat => cat.name === documentData.category);
    if (category) {
      category.count++;
    }
    
    return newDocument;
  }

  // Cập nhật document
  async update(id, updateData) {
    const docIndex = this.documents.findIndex(doc => doc.id === id);
    if (docIndex === -1) return null;
    
    this.documents[docIndex] = { ...this.documents[docIndex], ...updateData };
    return this.documents[docIndex];
  }

  // Xóa document
  async delete(id) {
    const docIndex = this.documents.findIndex(doc => doc.id === id);
    if (docIndex === -1) return false;
    
    const document = this.documents[docIndex];
    
    // Update category count
    const category = this.categories.find(cat => cat.name === document.category);
    if (category && category.count > 0) {
      category.count--;
    }
    
    this.documents.splice(docIndex, 1);
    return true;
  }

  // Tăng lượt view
  async incrementView(id) {
    const document = await this.findById(id);
    if (document) {
      document.views++;
      return document;
    }
    return null;
  }

  // Tăng lượt download
  async incrementDownload(id) {
    const document = await this.findById(id);
    if (document) {
      document.downloads++;
      return document;
    }
    return null;
  }

  // Lấy categories
  async getCategories() {
    return this.categories;
  }

  // Lấy thống kê
  async getStats() {
    return {
      total: this.documents.length,
      approved: this.documents.filter(doc => doc.isApproved).length,
      pending: this.documents.filter(doc => !doc.isApproved).length,
      totalDownloads: this.documents.reduce((sum, doc) => sum + doc.downloads, 0),
      totalViews: this.documents.reduce((sum, doc) => sum + doc.views, 0)
    };
  }

  // Lấy documents phổ biến
  async getPopular(limit = 10) {
    return this.documents
      .filter(doc => doc.isApproved)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }

  // Lấy documents mới nhất
  async getRecent(limit = 10) {
    return this.documents
      .filter(doc => doc.isApproved)
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
      .slice(0, limit);
  }
}

module.exports = new Document();
