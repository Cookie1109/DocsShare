const express = require('express');
const router = express.Router();
const ActivityController = require('../controllers/activityController');
const auth = require('../middleware/auth');

// Middleware authentication cho tất cả routes
router.use(auth);

/**
 * Activity Log Routes
 * 
 * Tất cả các routes đều yêu cầu authentication
 * Một số routes có thể yêu cầu quyền admin
 */

// Lấy log hoạt động của user hiện tại
router.get('/my-logs', ActivityController.getMyLogs);

// Lấy log hoạt động theo loại hành động
router.get('/by-action/:actionType', ActivityController.getLogsByAction);

// Lấy log hoạt động theo target ID
router.get('/by-target/:targetId', ActivityController.getLogsByTarget);

// Lấy thống kê hoạt động theo thời gian
router.get('/stats', ActivityController.getActivityStats);

// Lấy top users hoạt động nhiều nhất
router.get('/top-users', ActivityController.getTopActiveUsers);

// Lấy tổng quan hệ thống
router.get('/overview', ActivityController.getSystemOverview);

// Lấy danh sách action types
router.get('/action-types', ActivityController.getActionTypes);

// Ghi log hoạt động thủ công (internal use)
router.post('/log', ActivityController.createLog);

// Cleanup log cũ (admin only)
router.delete('/cleanup', ActivityController.cleanupLogs);

module.exports = router;