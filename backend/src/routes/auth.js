const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  registerValidation,
  loginValidation
} = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Đăng ký tài khoản mới
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST /api/auth/login
// @desc    Đăng nhập
// @access  Public
router.post('/login', loginValidation, login);

// @route   GET /api/auth/profile
// @desc    Lấy thông tin profile hiện tại
// @access  Private
router.get('/profile', authenticateToken, getProfile);

// @route   PUT /api/auth/profile
// @desc    Cập nhật thông tin profile
// @access  Private
router.put('/profile', authenticateToken, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Đổi mật khẩu
// @access  Private
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
