const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const FileController = require('../controllers/fileController');
const { storage } = require('../config/cloudinary');

// Multer configuration với Cloudinary storage

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/zip',
    'application/x-rar-compressed',
    'application/json',
    'text/markdown'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage: storage, // Cloudinary storage
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Middleware authentication cho tất cả routes
router.use(auth);

/**
 * File Management Routes
 */

// Upload file mới
router.post('/upload', upload.single('file'), FileController.uploadFile);

// Tìm kiếm files
router.get('/search', FileController.searchFiles);

// Lấy files được download nhiều nhất
router.get('/popular', FileController.getPopularFiles);

// Lấy files recent của user
router.get('/recent', FileController.getRecentFiles);

// Lấy files theo MIME type
router.get('/by-type/:mimeType', FileController.getFilesByType);

// Lấy thông tin file theo ID
router.get('/:fileId', FileController.getFileById);

// Download file
router.get('/:fileId/download', FileController.downloadFile);

// Xóa file
router.delete('/:fileId', FileController.deleteFile);

// Cập nhật tags của file
router.put('/:fileId/tags', FileController.updateFileTags);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed'
    });
  }
  
  next(error);
});

module.exports = router;