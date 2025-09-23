const ActivityLog = require('../models/ActivityLog');

/**
 * Activity Controller - Xử lý API requests cho activity logs
 */

class ActivityController {
  /**
   * Lấy log hoạt động của user hiện tại
   * GET /api/activities/my-logs
   */
  static async getMyLogs(req, res) {
    try {
      const userId = req.user.id;
      const { 
        action_types, 
        from_date, 
        to_date, 
        limit = 50, 
        offset = 0 
      } = req.query;
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse action_types array
      if (action_types) {
        if (Array.isArray(action_types)) {
          options.action_types = action_types;
        } else {
          options.action_types = action_types.split(',');
        }
      }
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const logs = await ActivityLog.getUserLogs(userId, options);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Get my logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy log hoạt động của nhóm
   * GET /api/groups/:groupId/activities
   */
  static async getGroupLogs(req, res) {
    try {
      const { groupId } = req.params;
      const { 
        action_types, 
        from_date, 
        to_date, 
        limit = 50, 
        offset = 0 
      } = req.query;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse action_types array
      if (action_types) {
        if (Array.isArray(action_types)) {
          options.action_types = action_types;
        } else {
          options.action_types = action_types.split(',');
        }
      }
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const logs = await ActivityLog.getGroupLogs(parseInt(groupId), options);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Get group logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy log hoạt động theo loại hành động
   * GET /api/activities/by-action/:actionType
   */
  static async getLogsByAction(req, res) {
    try {
      const { actionType } = req.params;
      const { from_date, to_date, limit = 100, offset = 0 } = req.query;
      
      if (!actionType) {
        return res.status(400).json({
          success: false,
          error: 'Action type is required'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const logs = await ActivityLog.getLogsByAction(actionType, options);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Get logs by action error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy log hoạt động theo target ID
   * GET /api/activities/by-target/:targetId
   */
  static async getLogsByTarget(req, res) {
    try {
      const { targetId } = req.params;
      const { action_types, limit = 50, offset = 0 } = req.query;
      
      if (!targetId) {
        return res.status(400).json({
          success: false,
          error: 'Target ID is required'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Parse action_types array
      if (action_types) {
        if (Array.isArray(action_types)) {
          options.action_types = action_types;
        } else {
          options.action_types = action_types.split(',');
        }
      }
      
      const logs = await ActivityLog.getLogsByTarget(targetId, options);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Get logs by target error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy thống kê hoạt động theo thời gian
   * GET /api/activities/stats
   */
  static async getActivityStats(req, res) {
    try {
      const { 
        group_by = 'day', 
        from_date, 
        to_date, 
        action_types 
      } = req.query;
      
      const options = { group_by };
      
      // Parse action_types array
      if (action_types) {
        if (Array.isArray(action_types)) {
          options.action_types = action_types;
        } else {
          options.action_types = action_types.split(',');
        }
      }
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const stats = await ActivityLog.getActivityStats(options);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get activity stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy top users hoạt động nhiều nhất
   * GET /api/activities/top-users
   */
  static async getTopActiveUsers(req, res) {
    try {
      const { from_date, to_date, limit = 10 } = req.query;
      
      const options = {
        limit: parseInt(limit)
      };
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const topUsers = await ActivityLog.getTopActiveUsers(options);
      
      res.json({
        success: true,
        data: topUsers
      });
    } catch (error) {
      console.error('Get top active users error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy tổng quan hệ thống
   * GET /api/activities/overview
   */
  static async getSystemOverview(req, res) {
    try {
      const { from_date, to_date } = req.query;
      
      const options = {};
      
      // Parse dates
      if (from_date) {
        options.from_date = new Date(from_date);
      }
      if (to_date) {
        options.to_date = new Date(to_date);
      }
      
      const overview = await ActivityLog.getSystemOverview(options);
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('Get system overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Ghi log hoạt động thủ công (dành cho admin hoặc internal use)
   * POST /api/activities/log
   */
  static async createLog(req, res) {
    try {
      const { action_type, target_id, details } = req.body;
      const user_id = req.user.id;
      
      if (!action_type) {
        return res.status(400).json({
          success: false,
          error: 'Action type is required'
        });
      }
      
      const result = await ActivityLog.create({
        user_id,
        action_type,
        target_id,
        details
      });
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Create log error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Cleanup log cũ (dành cho admin)
   * DELETE /api/activities/cleanup
   */
  static async cleanupLogs(req, res) {
    try {
      const { days_old = 90, batch_size = 1000 } = req.body;
      
      // Kiểm tra quyền admin (có thể thêm middleware riêng)
      // if (!req.user.isAdmin) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'Admin access required'
      //   });
      // }
      
      const result = await ActivityLog.cleanup(
        parseInt(days_old),
        parseInt(batch_size)
      );
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Cleanup logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy danh sách các action types có sẵn
   * GET /api/activities/action-types
   */
  static async getActionTypes(req, res) {
    try {
      // Chỉ 6 action types theo SQL schema ENUM
      const actionTypes = [
        'upload',
        'download', 
        'delete_file',
        'create_group',
        'join_group',
        'create_tag'
      ];
      
      res.json({
        success: true,
        data: actionTypes
      });
    } catch (error) {
      console.error('Get action types error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = ActivityController;