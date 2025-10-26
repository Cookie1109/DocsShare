const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const TagController = require('../controllers/tagController');
const ActivityController = require('../controllers/activityController');
const FileController = require('../controllers/fileController');

// Middleware authentication cho tất cả routes
router.use(auth);

/**
 * Group Management Routes
 */

// Tạo nhóm mới
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body; // Bỏ group_photo_url - chỉ lưu trong Firebase
    const creator_id = req.user.id;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Group name is required'
      });
    }
    
    const result = await Group.create({
      name: name.trim(),
      description: description?.trim(),
      creator_id
    });
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Lấy danh sách nhóm của user
router.get('/my-groups', async (req, res) => {
  try {
    const userId = req.user.id;
    const { role, include_member_count = false } = req.query;
    
    const groups = await Group.getUserGroups(userId, {
      role,
      include_member_count: include_member_count === 'true'
    });
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Bỏ public groups vì schema không có is_public field

// Tìm kiếm nhóm
router.get('/search', async (req, res) => {
  try {
    const { q: searchTerm, limit = 20 } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }
    
    const groups = await Group.search(searchTerm, parseInt(limit));
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Search groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Lấy thông tin nhóm theo ID
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(parseInt(groupId));
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cập nhật thông tin nhóm
router.put('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body; // Bỏ group_photo_url - chỉ lưu trong Firebase
    const updatedBy = req.user.id;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    
    const result = await Group.update(parseInt(groupId), updateData, updatedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Xóa nhóm
router.delete('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const deletedBy = req.user.id;
    
    const result = await Group.delete(parseInt(groupId), deletedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Group Member Management Routes
 */

// Lấy danh sách members của nhóm
router.get('/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { role, include_stats = false } = req.query;
    
    const members = await Group.getMembers(parseInt(groupId), {
      role,
      include_stats: include_stats === 'true'
    });
    
    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Thêm member vào nhóm
router.post('/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { user_id, role = 'member' } = req.body;
    const addedBy = req.user.id;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const result = await Group.addMember(parseInt(groupId), user_id, role, addedBy);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cập nhật role của member
router.put('/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    const updatedBy = req.user.id;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required'
      });
    }
    
    const result = await Group.updateMemberRole(parseInt(groupId), userId, role, updatedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Xóa member khỏi nhóm
router.delete('/:groupId/members/:userId', async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const removedBy = req.user.id;
    
    const result = await Group.removeMember(parseInt(groupId), userId, removedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Join nhóm (self-join cho public groups)
router.post('/:groupId/join', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    const result = await Group.addMember(parseInt(groupId), userId, 'member', userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Leave nhóm
router.post('/:groupId/leave', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    const result = await Group.removeMember(parseInt(groupId), userId, userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Group Tag Management Routes
 */

// Lấy danh sách tags của nhóm
router.get('/:groupId/tags', TagController.getGroupTags);

// Tìm kiếm tags trong nhóm
router.get('/:groupId/tags/search', TagController.searchTags);

// Lấy thống kê tags của nhóm
router.get('/:groupId/tags/stats', TagController.getTagStats);

// Lấy top tags của nhóm
router.get('/:groupId/tags/top', TagController.getTopTags);

// Batch tạo tags
router.post('/:groupId/tags/batch', TagController.batchCreateTags);

/**
 * Group File Management Routes
 */

// Lấy files của nhóm
router.get('/:groupId/files', FileController.getGroupFiles);

// Lấy thống kê files của nhóm
router.get('/:groupId/files/stats', FileController.getGroupFileStats);

/**
 * Group Activity Routes
 */

// Lấy log hoạt động của nhóm
router.get('/:groupId/activities', ActivityController.getGroupLogs);

/**
 * Group Statistics Routes
 */

// Lấy thống kê nhóm
router.get('/:groupId/stats', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const stats = await Group.getStats(parseInt(groupId));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get group stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;