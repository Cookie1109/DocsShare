const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadDocument, handleMulterError } = require('../middleware/upload');
const {
  getAllDocuments,
  getDocumentById,
  uploadDocument: uploadDoc,
  downloadDocument,
  getMyDocuments,
  deleteDocument,
  getCategories,
  getPopularDocuments,
  getRecentDocuments,
  getStats,
  uploadValidation
} = require('../controllers/documentController');

// @route   GET /api/documents
// @desc    Lấy tất cả documents (có pagination và filter)
// @access  Public
router.get('/', getAllDocuments);

// @route   GET /api/documents/categories
// @desc    Lấy danh sách categories
// @access  Public
router.get('/categories', getCategories);

// @route   GET /api/documents/popular
// @desc    Lấy documents phổ biến
// @access  Public
router.get('/popular', getPopularDocuments);

// @route   GET /api/documents/recent
// @desc    Lấy documents mới nhất
// @access  Public
router.get('/recent', getRecentDocuments);

// @route   GET /api/documents/stats
// @desc    Lấy thống kê tổng quan
// @access  Public
router.get('/stats', getStats);

// @route   GET /api/documents/my-documents
// @desc    Lấy documents của user hiện tại
// @access  Private
router.get('/my-documents', authenticateToken, getMyDocuments);

// @route   POST /api/documents/upload
// @desc    Upload document mới
// @access  Private
router.post('/upload', 
  authenticateToken,
  uploadDocument.single('document'),
  handleMulterError,
  uploadValidation,
  uploadDoc
);

// @route   GET /api/documents/:id
// @desc    Lấy document theo ID
// @access  Public
router.get('/:id', getDocumentById);

// @route   GET /api/documents/:id/download
// @desc    Download document
// @access  Private (có thể thay đổi thành Public nếu cần)
router.get('/:id/download', authenticateToken, downloadDocument);

// @route   DELETE /api/documents/:id
// @desc    Xóa document
// @access  Private (chỉ owner hoặc admin)
router.delete('/:id', authenticateToken, deleteDocument);

module.exports = router;
