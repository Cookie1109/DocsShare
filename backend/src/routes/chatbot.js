const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/chatbotController');
const authenticateFirebaseToken = require('../middleware/firebaseAuth');

/**
 * @route POST /api/chatbot/chat
 * @desc Gửi tin nhắn đến chatbot và nhận kết quả tìm kiếm
 * @access Private
 */
router.post('/chat', authenticateFirebaseToken, ChatbotController.chat);

/**
 * @route GET /api/chatbot/stats
 * @desc Lấy thống kê files cho user
 * @access Private
 */
router.get('/stats', authenticateFirebaseToken, ChatbotController.getStats);

/**
 * @route GET /api/chatbot/test-models
 * @desc Test available Gemini models
 * @access Private
 */
router.get('/test-models', authenticateFirebaseToken, ChatbotController.testModels);

module.exports = router;
