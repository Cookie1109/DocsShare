import axios from 'axios';
import { auth } from '../config/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Chatbot Service - Giao tiếp với AI chatbot backend
 */
class ChatbotService {
  /**
   * Lấy Firebase ID Token để xác thực
   */
  static async getAuthToken() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Gửi tin nhắn đến chatbot
   * @param {string} message - Tin nhắn của user
   * @param {Array} conversationHistory - Lịch sử hội thoại (optional)
   * @returns {Promise<Object>} Response từ chatbot
   */
  static async sendMessage(message, conversationHistory = []) {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios.post(
        `${API_URL}/chatbot/chat`,
        {
          message,
          conversationHistory
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Chatbot service error:', error);
      throw new Error(
        error.response?.data?.error || 
        'Không thể kết nối với trợ lý AI'
      );
    }
  }

  /**
   * Lấy thống kê files của user
   * @returns {Promise<Object>} Thống kê files
   */
  static async getStats() {
    try {
      const token = await this.getAuthToken();
      
      const response = await axios.get(
        `${API_URL}/chatbot/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get stats error:', error);
      throw new Error('Không thể lấy thống kê');
    }
  }
}

export default ChatbotService;
