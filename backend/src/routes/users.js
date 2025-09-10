const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/users
// @desc    Lấy danh sách users (chỉ admin)
// @access  Private (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.getAll();
    
    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Lấy thống kê users
// @access  Private (Admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await User.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Lấy thông tin user theo ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Chỉ cho phép xem thông tin của chính mình hoặc admin
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
});

// @route   PUT /api/users/:id/toggle-status
// @desc    Bật/tắt trạng thái user (chỉ admin)
// @access  Private (Admin only)
router.put('/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Không cho phép admin tự khóa chính mình
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể khóa chính mình'
      });
    }

    const updatedUser = await User.update(id, { 
      isActive: !user.isActive 
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: `${updatedUser.isActive ? 'Mở khóa' : 'Khóa'} tài khoản thành công`,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Xóa user (chỉ admin)
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Không cho phép admin xóa chính mình
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể xóa chính mình'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    await User.delete(id);

    res.json({
      success: true,
      message: 'Xóa người dùng thành công'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi server'
    });
  }
});

module.exports = router;
