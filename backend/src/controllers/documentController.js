const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');

// Validation rules
const uploadValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Tiêu đề phải có từ 5-200 ký tự'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Mô tả phải có từ 10-1000 ký tự'),
  body('category')
    .notEmpty()
    .withMessage('Danh mục là bắt buộc'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags phải là một mảng')
];

// Lấy tất cả documents
const getAllDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sortBy = 'newest'
    } = req.query;

    const filters = {
      category,
      search,
      sortBy,
      isApproved: true // Chỉ hiển thị documents đã được duyệt
    };

    const documents = await Document.getAll(filters);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDocuments = documents.slice(startIndex, endIndex);

    const totalPages = Math.ceil(documents.length / limit);

    res.json({
      success: true,
      data: {
        documents: paginatedDocuments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: documents.length,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy document theo ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài liệu'
      });
    }

    // Tăng lượt view
    await Document.incrementView(id);

    res.json({
      success: true,
      data: document
    });

  } catch (error) {
    console.error('Get document by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Upload document
const uploadDocument = async (req, res) => {
  try {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Xóa file đã upload nếu có lỗi validation
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file để tải lên'
      });
    }

    const { title, description, category, tags } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Tạo document data
    const documentData = {
      title,
      description,
      category,
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      fileName: req.file.filename,
      originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      filePath: `/uploads/documents/${req.file.filename}`,
      fileSize: req.file.size,
      fileType: path.extname(req.file.originalname).substring(1).toLowerCase(),
      mimeType: req.file.mimetype,
      uploaderId: user.id,
      uploaderName: user.name
    };

    const newDocument = await Document.create(documentData);

    // Cập nhật số lượng documents đã upload của user
    await User.update(user.id, { 
      documentsUploaded: user.documentsUploaded + 1 
    });

    res.status(201).json({
      success: true,
      message: 'Tải lên tài liệu thành công',
      data: newDocument
    });

  } catch (error) {
    // Xóa file nếu có lỗi
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Download document
const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài liệu'
      });
    }

    const filePath = path.join(__dirname, '../..', document.filePath);
    
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File không tồn tại'
      });
    }

    // Tăng lượt download
    await Document.incrementDownload(id);

    // Cập nhật số lượng downloads của user
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user) {
        await User.update(user.id, { 
          documentsDownloaded: user.documentsDownloaded + 1 
        });
      }
    }

    // Set headers để download
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    res.setHeader('Content-Type', document.mimeType);

    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy documents của user hiện tại
const getMyDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;

    const filters = {
      uploaderId: req.user.id
    };

    const documents = await Document.getAll(filters);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDocuments = documents.slice(startIndex, endIndex);

    const totalPages = Math.ceil(documents.length / limit);

    res.json({
      success: true,
      data: {
        documents: paginatedDocuments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: documents.length,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get my documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Xóa document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài liệu'
      });
    }

    // Kiểm tra quyền xóa
    if (document.uploaderId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa tài liệu này'
      });
    }

    // Xóa file
    const filePath = path.join(__dirname, '../..', document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Xóa document khỏi database
    await Document.delete(id);

    // Cập nhật số lượng documents của user
    const user = await User.findById(document.uploaderId);
    if (user && user.documentsUploaded > 0) {
      await User.update(user.id, { 
        documentsUploaded: user.documentsUploaded - 1 
      });
    }

    res.json({
      success: true,
      message: 'Xóa tài liệu thành công'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy categories
const getCategories = async (req, res) => {
  try {
    const categories = await Document.getCategories();
    
    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy documents phổ biến
const getPopularDocuments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const documents = await Document.getPopular(parseInt(limit));
    
    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Get popular documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy documents mới nhất
const getRecentDocuments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const documents = await Document.getRecent(parseInt(limit));
    
    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Get recent documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

// Lấy thống kê
const getStats = async (req, res) => {
  try {
    const documentStats = await Document.getStats();
    const userStats = await User.getStats();
    
    res.json({
      success: true,
      data: {
        documents: documentStats,
        users: userStats
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  uploadDocument,
  downloadDocument,
  getMyDocuments,
  deleteDocument,
  getCategories,
  getPopularDocuments,
  getRecentDocuments,
  getStats,
  uploadValidation
};
