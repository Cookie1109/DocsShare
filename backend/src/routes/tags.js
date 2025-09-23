const express = require('express');
const router = express.Router();
const TagController = require('../controllers/tagController');
const auth = require('../middleware/auth');

// Middleware authentication cho tất cả routes
router.use(auth);

/**
 * Tag Routes
 * 
 * Tất cả các routes đều yêu cầu authentication
 * Phân quyền được kiểm tra trong controller hoặc model
 */

// Tạo tag mới
router.post('/', TagController.createTag);

// Lấy thông tin tag theo ID
router.get('/:tagId', TagController.getTagById);

// Lấy files của tag
router.get('/:tagId/files', TagController.getTagFiles);

// Cập nhật tag
router.put('/:tagId', TagController.updateTag);

// Xóa tag
router.delete('/:tagId', TagController.deleteTag);

module.exports = router;