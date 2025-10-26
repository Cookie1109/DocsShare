const { executeQuery, executeTransaction } = require('../config/db');
const { syncUser } = require('../config/syncHelper');

/**
 * User Model - Quản lý người dùng
 * 
 * Schema: users(id, email, display_name, tag, created_at, last_login_at)
 * Note: avatar_url removed - avatars are now stored in Firebase only
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
   * @returns {Promise<Object>} Kết quả tạo user
   */
  static async create(userData) {
    try {
      const { id, email, display_name, tag } = userData;
      
      // Validate required fields
      if (!id || !email || !display_name || !tag) {
        throw new Error('Missing required fields: id, email, display_name, tag');
      }
      
      // Không lưu avatar_url vào MySQL - chỉ lưu trong Firebase
      const query = `
        INSERT INTO users (id, email, display_name, tag, created_at, last_login_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      
      await executeQuery(query, [id, email, display_name, tag]);
      
      // Sync to Firebase after successful MySQL insert
      await syncUser(id, 'created');
      
      return {
        success: true,
        message: 'User created successfully',
        data: { id, email, display_name, tag }
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
        SELECT id, email, display_name, tag, created_at, last_login_at
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
        SELECT id, email, display_name, tag, created_at, last_login_at
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
   * Cập nhật thông tin hồ sơ người dùng
   * @param {string} userId - Firebase UID
   * @param {Object} updates - Dữ liệu cập nhật
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  static async updateProfile(userId, updates) {
    try {
      // Bỏ avatar_url - không lưu trong MySQL, chỉ lưu trong Firebase
      const allowedFields = ['display_name', 'tag'];
      const fields = [];
      const values = [];
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });
      
      if (fields.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }
      
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = ?
      `;
      
      await executeQuery(query, values);
      
      // Sync to Firebase after successful MySQL update
      await syncUser(userId, 'updated');
      
      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('unique_name_tag')) {
          return { success: false, error: 'Tên và tag đã được sử dụng' };
        }
      }
      
      return { success: false, error: error.message };
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
