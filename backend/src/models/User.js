const { executeQuery, executeTransaction } = require('../config/db');

/**
 * User Model - Quản lý người dùng
 * 
 * Schema: users(id, email, display_name, tag, avatar_url, created_at, last_login_at)
 * Constraints: 
 * - id: VARCHAR(128) PRIMARY KEY (Firebase UID)
 * - email: UNIQUE NOT NULL
 * - (display_name, tag): UNIQUE NOT NULL (business logic chính)
 */

class User {
  /**
   * Tạo người dùng mới
   * @param {Object} userData - Thông tin người dùng
   * @param {string} userData.id - Firebase UID
   * @param {string} userData.email - Email
   * @param {string} userData.display_name - Tên hiển thị
   * @param {string} userData.tag - Tag (4-6 số)
   * @param {string} userData.avatar_url - URL avatar (optional)
   * @returns {Promise<Object>} Kết quả tạo user
   */
  static async create(userData) {
    try {
      const { id, email, display_name, tag, avatar_url = null } = userData;
      
      // Validate required fields
      if (!id || !email || !display_name || !tag) {
        throw new Error('Missing required fields: id, email, display_name, tag');
      }
      
      const query = `
        INSERT INTO users (id, email, display_name, tag, avatar_url, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      await executeQuery(query, [id, email, display_name, tag, avatar_url]);
      
      return {
        success: true,
        message: 'User created successfully',
        data: { id, email, display_name, tag, avatar_url }
      };
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Handle specific MySQL errors
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('email')) {
          return { success: false, error: 'Email đã được sử dụng' };
        }
        if (error.message.includes('unique_name_tag')) {
          return { success: false, error: 'Tên và tag đã được sử dụng' };
        }
        return { success: false, error: 'Dữ liệu đã tồn tại' };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Tìm người dùng theo ID (Firebase UID)
   * @param {string} userId - Firebase UID
   * @returns {Promise<Object|null>} Thông tin người dùng
   */
  static async findById(userId) {
    try {
      const query = `
        SELECT id, email, display_name, tag, avatar_url, created_at, last_login_at
        FROM users 
        WHERE id = ?
      `;
      
      const users = await executeQuery(query, [userId]);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Tìm người dùng theo email
   * @param {string} email - Email
   * @returns {Promise<Object|null>} Thông tin người dùng
   */
  static async findByEmail(email) {
    try {
      const query = `
        SELECT id, email, display_name, tag, avatar_url, created_at, last_login_at
        FROM users 
        WHERE email = ?
      `;
      
      const users = await executeQuery(query, [email]);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem tên và tag đã tồn tại chưa
   * @param {string} displayName - Tên hiển thị
   * @param {string} tag - Tag
   * @returns {Promise<boolean>} True nếu đã tồn tại
   */
  static async checkNameTagExists(displayName, tag) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM users 
        WHERE display_name = ? AND tag = ?
      `;
      
      const result = await executeQuery(query, [displayName, tag]);
      return result[0].count > 0;
    } catch (error) {
      console.error('Error checking name/tag existence:', error);
      throw error;
    }
  }

  /**
   * Cập nhật thời gian đăng nhập cuối
   * @param {string} userId - Firebase UID
   * @returns {Promise<boolean>} Kết quả cập nhật
   */
  static async updateLastLogin(userId) {
    try {
      const query = `
        UPDATE users 
        SET last_login_at = NOW() 
        WHERE id = ?
      `;
      
      await executeQuery(query, [userId]);
      return true;
    } catch (error) {
      console.error('Error updating last login:', error);
      return false;
    }
  }

  /**
   * Lấy danh sách tất cả nhóm mà user tham gia
   * @param {string} userId - Firebase UID
   * @returns {Promise<Array>} Danh sách nhóm
   */
  static async getUserGroups(userId) {
    try {
      const query = `
        SELECT 
          g.id,
          g.name,
          g.description,
          g.group_photo_url,
          g.created_at,
          gm.role,
          gm.joined_at,
          u.display_name as creator_name,
          u.tag as creator_tag
        FROM \`groups\` g
        JOIN group_members gm ON g.id = gm.group_id
        JOIN users u ON g.creator_id = u.id
        WHERE gm.user_id = ?
        ORDER BY gm.joined_at DESC
      `;
      
      return await executeQuery(query, [userId]);
    } catch (error) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  }
}

module.exports = User;
