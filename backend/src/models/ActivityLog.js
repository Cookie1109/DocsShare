const { executeQuery, executeTransaction } = require('../config/db');

/**
 * ActivityLog Model - Quản lý log hoạt động trong hệ thống
 * 
 * Schema: activity_logs(id, user_id, action_type, target_id, details, created_at)
 * 
 * Mục đích:
 * - Theo dõi mọi hoạt động quan trọng (upload, delete, join group, etc.)
 * - Hỗ trợ audit trail và debugging
 * - Tạo timeline hoạt động cho users/groups
 * - Phân tích usage analytics
 */

class ActivityLog {
  /**
   * Ghi log hoạt động
   * @param {Object} logData - Dữ liệu log
   * @param {string} logData.user_id - Firebase UID của user
   * @param {string} logData.action_type - Loại hành động
   * @param {string} logData.target_id - ID của đối tượng được tác động
   * @param {Object} logData.details - Chi tiết hoạt động (JSON)
   * @returns {Promise<Object>} Kết quả ghi log
   */
  static async create(logData) {
    try {
      const { user_id, action_type, target_id, details = {} } = logData;
      
      if (!user_id || !action_type) {
        throw new Error('Missing required fields: user_id, action_type');
      }
      
      const query = `
        INSERT INTO activity_logs (user_id, action_type, target_id, details, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;
      
      const result = await executeQuery(query, [
        user_id,
        action_type,
        target_id || null,
        JSON.stringify(details)
      ]);
      
      return {
        success: true,
        message: 'Activity logged successfully',
        data: {
          id: result.insertId,
          user_id,
          action_type,
          target_id,
          details
        }
      };
    } catch (error) {
      console.error('Error creating activity log:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Lấy log hoạt động theo user
   * @param {string} userId - Firebase UID
   * @param {Object} options - Tùy chọn filter và phân trang
   * @param {Array} options.action_types - Lọc theo loại hành động
   * @param {Date} options.from_date - Từ ngày
   * @param {Date} options.to_date - Đến ngày
   * @param {number} options.limit - Số lượng tối đa
   * @param {number} options.offset - Vị trí bắt đầu
   * @returns {Promise<Array>} Danh sách log
   */
  static async getUserLogs(userId, options = {}) {
    try {
      const { 
        action_types = [], 
        from_date, 
        to_date, 
        limit = 50, 
        offset = 0 
      } = options;
      
      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.action_type,
          al.target_id,
          al.details,
          al.created_at,
          u.display_name,
          u.tag as user_tag
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.user_id = ?
      `;
      
      const params = [userId];
      
      // Filter theo action types
      if (action_types.length > 0) {
        query += ` AND al.action_type IN (${action_types.map(() => '?').join(',')})`;
        params.push(...action_types);
      }
      
      // Filter theo thời gian
      if (from_date) {
        query += ` AND al.created_at >= ?`;
        params.push(from_date);
      }
      
      if (to_date) {
        query += ` AND al.created_at <= ?`;
        params.push(to_date);
      }
      
      query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const logs = await executeQuery(query, params);
      
      // Parse JSON details
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      }));
    } catch (error) {
      console.error('Error getting user logs:', error);
      throw error;
    }
  }
  
  /**
   * Lấy log hoạt động của nhóm (từ tất cả members)
   * @param {number} groupId - ID nhóm
   * @param {Object} options - Tùy chọn filter và phân trang
   * @returns {Promise<Array>} Danh sách log
   */
  static async getGroupLogs(groupId, options = {}) {
    try {
      const { 
        action_types = [], 
        from_date, 
        to_date, 
        limit = 50, 
        offset = 0 
      } = options;
      
      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.action_type,
          al.target_id,
          al.details,
          al.created_at,
          u.display_name,
          u.tag as user_tag
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        JOIN group_members gm ON al.user_id = gm.user_id
        WHERE gm.group_id = ?
      `;
      
      const params = [groupId];
      
      // Filter theo action types
      if (action_types.length > 0) {
        query += ` AND al.action_type IN (${action_types.map(() => '?').join(',')})`;
        params.push(...action_types);
      }
      
      // Filter theo thời gian
      if (from_date) {
        query += ` AND al.created_at >= ?`;
        params.push(from_date);
      }
      
      if (to_date) {
        query += ` AND al.created_at <= ?`;
        params.push(to_date);
      }
      
      query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const logs = await executeQuery(query, params);
      
      // Parse JSON details
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      }));
    } catch (error) {
      console.error('Error getting group logs:', error);
      throw error;
    }
  }
  
  /**
   * Lấy log hoạt động theo loại hành động
   * @param {string} actionType - Loại hành động
   * @param {Object} options - Tùy chọn filter
   * @returns {Promise<Array>} Danh sách log
   */
  static async getLogsByAction(actionType, options = {}) {
    try {
      const { from_date, to_date, limit = 100, offset = 0 } = options;
      
      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.action_type,
          al.target_id,
          al.details,
          al.created_at,
          u.display_name,
          u.tag as user_tag
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.action_type = ?
      `;
      
      const params = [actionType];
      
      // Filter theo thời gian
      if (from_date) {
        query += ` AND al.created_at >= ?`;
        params.push(from_date);
      }
      
      if (to_date) {
        query += ` AND al.created_at <= ?`;
        params.push(to_date);
      }
      
      query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const logs = await executeQuery(query, params);
      
      // Parse JSON details
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      }));
    } catch (error) {
      console.error('Error getting logs by action:', error);
      throw error;
    }
  }
  
  /**
   * Lấy thống kê hoạt động theo thời gian
   * @param {Object} options - Tùy chọn filter
   * @param {string} options.group_by - Nhóm theo ('hour', 'day', 'week', 'month')
   * @param {Date} options.from_date - Từ ngày
   * @param {Date} options.to_date - Đến ngày
   * @param {Array} options.action_types - Lọc theo loại hành động
   * @returns {Promise<Array>} Thống kê hoạt động
   */
  static async getActivityStats(options = {}) {
    try {
      const { 
        group_by = 'day', 
        from_date, 
        to_date, 
        action_types = [] 
      } = options;
      
      // Xác định format thời gian
      let dateFormat;
      switch (group_by) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00:00';
          break;
        case 'week':
          dateFormat = '%Y-%u';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        default: // day
          dateFormat = '%Y-%m-%d';
      }
      
      let query = `
        SELECT 
          DATE_FORMAT(created_at, '${dateFormat}') as time_period,
          action_type,
          COUNT(*) as count
        FROM activity_logs
        WHERE 1=1
      `;
      
      const params = [];
      
      // Filter theo thời gian
      if (from_date) {
        query += ` AND created_at >= ?`;
        params.push(from_date);
      }
      
      if (to_date) {
        query += ` AND created_at <= ?`;
        params.push(to_date);
      }
      
      // Filter theo action types
      if (action_types.length > 0) {
        query += ` AND action_type IN (${action_types.map(() => '?').join(',')})`;
        params.push(...action_types);
      }
      
      query += ` GROUP BY time_period, action_type ORDER BY time_period DESC`;
      
      return await executeQuery(query, params);
    } catch (error) {
      console.error('Error getting activity stats:', error);
      throw error;
    }
  }
  
  /**
   * Lấy top users có hoạt động nhiều nhất
   * @param {Object} options - Tùy chọn filter
   * @param {Date} options.from_date - Từ ngày
   * @param {Date} options.to_date - Đến ngày
   * @param {number} options.limit - Số lượng user
   * @returns {Promise<Array>} Top active users
   */
  static async getTopActiveUsers(options = {}) {
    try {
      const { from_date, to_date, limit = 10 } = options;
      
      let query = `
        SELECT 
          al.user_id,
          u.display_name,
          u.tag as user_tag,
          COUNT(*) as activity_count,
          COUNT(DISTINCT al.action_type) as unique_actions,
          MAX(al.created_at) as last_activity
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      
      // Filter theo thời gian
      if (from_date) {
        query += ` AND al.created_at >= ?`;
        params.push(from_date);
      }
      
      if (to_date) {
        query += ` AND al.created_at <= ?`;
        params.push(to_date);
      }
      
      query += `
        GROUP BY al.user_id, u.display_name, u.tag
        ORDER BY activity_count DESC
        LIMIT ?
      `;
      params.push(limit);
      
      return await executeQuery(query, params);
    } catch (error) {
      console.error('Error getting top active users:', error);
      throw error;
    }
  }
  
  /**
   * Xóa log cũ (cleanup)
   * @param {number} daysOld - Số ngày cũ
   * @param {number} batchSize - Kích thước batch để xóa
   * @returns {Promise<Object>} Kết quả cleanup
   */
  static async cleanup(daysOld = 90, batchSize = 1000) {
    try {
      return await executeTransaction(async (connection) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        // Đếm số log sẽ bị xóa
        const [countResult] = await connection.execute(
          `SELECT COUNT(*) as count FROM activity_logs WHERE created_at < ?`,
          [cutoffDate]
        );
        
        const totalToDelete = countResult[0].count;
        let deletedCount = 0;
        
        // Xóa theo batch để tránh lock table quá lâu
        while (deletedCount < totalToDelete) {
          const [deleteResult] = await connection.execute(
            `DELETE FROM activity_logs WHERE created_at < ? LIMIT ?`,
            [cutoffDate, batchSize]
          );
          
          const batchDeleted = deleteResult.affectedRows;
          deletedCount += batchDeleted;
          
          // Nếu không còn gì để xóa, thoát loop
          if (batchDeleted === 0) break;
        }
        
        return {
          success: true,
          message: 'Activity logs cleaned up successfully',
          data: {
            total_deleted: deletedCount,
            cutoff_date: cutoffDate,
            days_old: daysOld
          }
        };
      });
    } catch (error) {
      console.error('Error cleaning up activity logs:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Lấy thống kê tổng quan hệ thống
   * @param {Object} options - Tùy chọn filter
   * @returns {Promise<Object>} System overview stats
   */
  static async getSystemOverview(options = {}) {
    try {
      const { from_date, to_date } = options;
      
      let baseWhere = 'WHERE 1=1';
      const params = [];
      
      if (from_date) {
        baseWhere += ' AND created_at >= ?';
        params.push(from_date);
      }
      
      if (to_date) {
        baseWhere += ' AND created_at <= ?';
        params.push(to_date);
      }
      
      // Tổng số hoạt động
      const totalQuery = `SELECT COUNT(*) as total_activities FROM activity_logs ${baseWhere}`;
      const totalResult = await executeQuery(totalQuery, params);
      
      // Hoạt động theo loại
      const actionQuery = `
        SELECT action_type, COUNT(*) as count
        FROM activity_logs ${baseWhere}
        GROUP BY action_type
        ORDER BY count DESC
      `;
      const actionStats = await executeQuery(actionQuery, params);
      
      // Số user hoạt động
      const activeUsersQuery = `
        SELECT COUNT(DISTINCT user_id) as active_users
        FROM activity_logs ${baseWhere}
      `;
      const activeUsersResult = await executeQuery(activeUsersQuery, params);
      
      // Hoạt động trong 24h qua
      const recentQuery = `
        SELECT COUNT(*) as recent_activities
        FROM activity_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      const recentResult = await executeQuery(recentQuery, []);
      
      return {
        total_activities: totalResult[0].total_activities,
        active_users: activeUsersResult[0].active_users,
        recent_activities: recentResult[0].recent_activities,
        action_breakdown: actionStats
      };
    } catch (error) {
      console.error('Error getting system overview:', error);
      throw error;
    }
  }
  
  /**
   * Tìm log theo target_id (ví dụ: tất cả hoạt động liên quan đến một file)
   * @param {string} targetId - ID của đối tượng
   * @param {Object} options - Tùy chọn filter
   * @returns {Promise<Array>} Danh sách log
   */
  static async getLogsByTarget(targetId, options = {}) {
    try {
      const { action_types = [], limit = 50, offset = 0 } = options;
      
      let query = `
        SELECT 
          al.id,
          al.user_id,
          al.action_type,
          al.target_id,
          al.details,
          al.created_at,
          u.display_name,
          u.tag as user_tag
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.target_id = ?
      `;
      
      const params = [targetId];
      
      // Filter theo action types
      if (action_types.length > 0) {
        query += ` AND al.action_type IN (${action_types.map(() => '?').join(',')})`;
        params.push(...action_types);
      }
      
      query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const logs = await executeQuery(query, params);
      
      // Parse JSON details
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
      }));
    } catch (error) {
      console.error('Error getting logs by target:', error);
      throw error;
    }
  }
}

module.exports = ActivityLog;