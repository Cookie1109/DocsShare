const Tag = require('../models/Tag');

/**
 * Tag Controller - Xử lý API requests cho tags
 */

class TagController {
  /**
   * Tạo tag mới
   * POST /api/tags
   */
  static async createTag(req, res) {
    try {
      const { name, group_id } = req.body;
      const creator_id = req.user.id; // Từ auth middleware
      
      if (!name || !group_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, group_id'
        });
      }
      
      const result = await Tag.create({
        name: name.trim(),
        group_id: parseInt(group_id),
        creator_id
      });
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Create tag error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy danh sách tags của nhóm
   * GET /api/groups/:groupId/tags
   */
  static async getGroupTags(req, res) {
    try {
      const { groupId } = req.params;
      const { with_file_count } = req.query;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const tags = await Tag.getGroupTags(parseInt(groupId), {
        with_file_count: with_file_count === 'true'
      });
      
      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('Get group tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy thông tin tag theo ID
   * GET /api/tags/:tagId
   */
  static async getTagById(req, res) {
    try {
      const { tagId } = req.params;
      
      if (!tagId) {
        return res.status(400).json({
          success: false,
          error: 'Tag ID is required'
        });
      }
      
      const tag = await Tag.findById(parseInt(tagId));
      
      if (!tag) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      }
      
      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      console.error('Get tag by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy files của tag
   * GET /api/tags/:tagId/files
   */
  static async getTagFiles(req, res) {
    try {
      const { tagId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      if (!tagId) {
        return res.status(400).json({
          success: false,
          error: 'Tag ID is required'
        });
      }
      
      const files = await Tag.getTagFiles(parseInt(tagId), {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get tag files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Cập nhật tag
   * PUT /api/tags/:tagId
   */
  static async updateTag(req, res) {
    try {
      const { tagId } = req.params;
      const { name } = req.body;
      const updatedBy = req.user.id;
      
      if (!tagId || !name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: tagId, name'
        });
      }
      
      const result = await Tag.update(parseInt(tagId), name.trim(), updatedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Update tag error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Xóa tag
   * DELETE /api/tags/:tagId
   */
  static async deleteTag(req, res) {
    try {
      const { tagId } = req.params;
      const deletedBy = req.user.id;
      
      if (!tagId) {
        return res.status(400).json({
          success: false,
          error: 'Tag ID is required'
        });
      }
      
      const result = await Tag.delete(parseInt(tagId), deletedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Delete tag error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Tìm kiếm tags trong nhóm
   * GET /api/groups/:groupId/tags/search
   */
  static async searchTags(req, res) {
    try {
      const { groupId } = req.params;
      const { q: searchTerm, limit = 20 } = req.query;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: 'Search term is required'
        });
      }
      
      const tags = await Tag.search(parseInt(groupId), searchTerm, parseInt(limit));
      
      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      console.error('Search tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy thống kê tags của nhóm
   * GET /api/groups/:groupId/tags/stats
   */
  static async getTagStats(req, res) {
    try {
      const { groupId } = req.params;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const stats = await Tag.getGroupStats(parseInt(groupId));
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get tag stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Lấy top tags của nhóm
   * GET /api/groups/:groupId/tags/top
   */
  static async getTopTags(req, res) {
    try {
      const { groupId } = req.params;
      const { limit = 10 } = req.query;
      
      if (!groupId) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        });
      }
      
      const topTags = await Tag.getTopTags(parseInt(groupId), parseInt(limit));
      
      res.json({
        success: true,
        data: topTags
      });
    } catch (error) {
      console.error('Get top tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Batch tạo tags (tìm hoặc tạo mới)
   * POST /api/groups/:groupId/tags/batch
   */
  static async batchCreateTags(req, res) {
    try {
      const { groupId } = req.params;
      const { tag_names } = req.body; // Array of tag names
      const creator_id = req.user.id;
      
      if (!groupId || !Array.isArray(tag_names) || tag_names.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Group ID and tag_names array are required'
        });
      }
      
      const results = [];
      
      for (const tagName of tag_names) {
        if (typeof tagName === 'string' && tagName.trim()) {
          const result = await Tag.findOrCreate(
            tagName.trim(),
            parseInt(groupId),
            creator_id
          );
          results.push({
            name: tagName.trim(),
            ...result
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Batch tag creation completed',
        data: results
      });
    } catch (error) {
      console.error('Batch create tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = TagController;