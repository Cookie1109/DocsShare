const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/firebaseAuth');
const Group = require('../models/Group');
const TagController = require('../controllers/tagController');
const ActivityController = require('../controllers/activityController');
const FileController = require('../controllers/fileController');
const { executeQuery } = require('../config/db');

// Middleware authentication cho tất cả routes
router.use(verifyFirebaseToken);

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
    let { groupId } = req.params;
    const deletedBy = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // groupId is Firestore ID (string), need to convert to MySQL ID
      console.log(`🔄 Converting Firestore ID ${groupId} to MySQL ID...`);
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
      console.log(`✅ Mapped to MySQL group ${mysqlGroupId}`);
    } else {
      // groupId is MySQL ID, need to get Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Delete from MySQL (includes members, files, tags via CASCADE)
    const result = await Group.delete(mysqlGroupId, deletedBy);
    
    if (result.success) {
      // Delete from Firebase Firestore
      try {
        const admin = require('../config/firebaseAdmin');
        const db = admin.firestore();
        const batch = db.batch();
        
        console.log(`🗑️ Deleting Firebase data for group ${firestoreGroupId}...`);
        
        // 1. Delete all group files (subcollection: groups/{groupId}/files)
        const filesSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('files')
          .get();
        
        filesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 2. Delete all group tags (subcollection: groups/{groupId}/tags)
        const tagsSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('tags')
          .get();
        
        tagsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 3. Delete all group messages (subcollection: groups/{groupId}/messages)
        const messagesSnapshot = await db.collection('groups')
          .doc(firestoreGroupId)
          .collection('messages')
          .get();
        
        messagesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 4. Delete all group members
        const membersSnapshot = await db.collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .get();
        
        membersSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 5. Delete all pending members
        const pendingSnapshot = await db.collection('pending_members')
          .where('groupId', '==', firestoreGroupId)
          .get();
        
        pendingSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 6. Delete all group invitations
        const invitationsSnapshot = await db.collection('group_invitations')
          .where('group_id', '==', firestoreGroupId)
          .get();
        
        invitationsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 7. Delete group mapping
        const mappingSnapshot = await db.collection('group_mapping')
          .where('firestore_id', '==', firestoreGroupId)
          .get();
        
        mappingSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 8. Delete group document (LAST - after all subcollections)
        const groupRef = db.collection('groups').doc(firestoreGroupId);
        batch.delete(groupRef);
        
        // Commit all deletes
        await batch.commit();
        
        console.log(`✅ Deleted from Firebase: Group + ${membersSnapshot.size} members + ${pendingSnapshot.size} pending + ${invitationsSnapshot.size} invitations + ${filesSnapshot.size} files + ${tagsSnapshot.size} tags`);
      } catch (firebaseError) {
        console.error('❌ Failed to delete from Firebase:', firebaseError);
        // Don't fail the whole operation if Firebase deletion fails
      }
      
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
    let { groupId, userId } = req.params;
    const removedBy = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // groupId is Firestore ID (string), need to convert to MySQL ID
      console.log(`🔄 Converting Firestore ID ${groupId} to MySQL ID...`);
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
      console.log(`✅ Mapped to MySQL group ${mysqlGroupId}`);
    } else {
      // groupId is MySQL ID, need to get Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
        console.log(`✅ Found Firestore group ID: ${firestoreGroupId} for MySQL group ${mysqlGroupId}`);
      }
    }
    
    // Remove from Firebase Firestore FIRST (for real-time UI update)
    if (firestoreGroupId) {
      try {
        const admin = require('../config/firebaseAdmin');
        const db = admin.firestore();
        
        // Query to find the member document
        const memberSnapshot = await db.collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .where('userId', '==', userId)
          .get();
        
        if (!memberSnapshot.empty) {
          const batch = db.batch();
          memberSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          
          console.log(`✅ Removed user ${userId} from Firebase group ${firestoreGroupId} (${memberSnapshot.size} document(s))`);
        } else {
          console.log(`⚠️ No Firebase document found for user ${userId} in group ${firestoreGroupId}`);
        }
      } catch (firebaseError) {
        console.error('❌ Failed to remove from Firebase:', firebaseError);
        // Return error - don't proceed with MySQL if Firebase fails
        return res.status(500).json({
          success: false,
          error: 'Failed to remove member from real-time system'
        });
      }
    }
    
    // Remove from MySQL (after Firebase is successful)
    const result = await Group.removeMember(mysqlGroupId, userId, removedBy);
    
    if (result.success) {
      res.json(result);
    } else {
      console.error('❌ MySQL removal failed after Firebase success');
      // Return success anyway since Firebase (real-time) succeeded
      res.json({
        success: true,
        message: 'Member removed successfully (real-time updated)'
      });
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
    let { groupId } = req.params;
    const userId = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // groupId is Firestore ID (string), need to convert to MySQL ID
      console.log(`🔄 Converting Firestore ID ${groupId} to MySQL ID...`);
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
      console.log(`✅ Mapped to MySQL group ${mysqlGroupId}`);
    } else {
      // groupId is MySQL ID, need to get Firestore ID
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Remove from Firebase Firestore FIRST (for real-time UI update)
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      // Query to find the member document (since Firebase uses auto-generated IDs)
      const memberSnapshot = await db.collection('group_members')
        .where('groupId', '==', firestoreGroupId)
        .where('userId', '==', userId)
        .get();
      
      if (!memberSnapshot.empty) {
        // Delete all matching documents (should be only one)
        const batch = db.batch();
        memberSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        console.log(`✅ Removed user ${userId} from Firebase group ${firestoreGroupId} (${memberSnapshot.size} document(s))`);
      } else {
        console.log(`⚠️ No Firebase document found for user ${userId} in group ${firestoreGroupId}`);
      }
    } catch (firebaseError) {
      console.error('❌ Failed to remove from Firebase:', firebaseError);
      // Return error - don't proceed with MySQL if Firebase fails
      return res.status(500).json({
        success: false,
        error: 'Failed to remove member from real-time system'
      });
    }

    // Remove from MySQL (after Firebase is successful)
    const result = await Group.removeMember(mysqlGroupId, userId, userId);
    
    if (result.success) {
      res.json(result);
    } else {
      console.error('❌ MySQL removal failed after Firebase success');
      console.error('⚠️ DATA MISMATCH: Member removed from Firebase but still in MySQL!');
      // Return success anyway since Firebase (real-time) succeeded
      res.json({
        success: true,
        message: 'Left group successfully (real-time updated)'
      });
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

/**
 * Member Approval System Routes
 */

// Toggle member approval mode (chỉ admin)
router.put('/:groupId/settings/approval', async (req, res) => {
  try {
    let { groupId } = req.params;
    const { requireApproval } = req.body;
    const userId = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
    } else {
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Check if user is admin
    const membership = await executeQuery(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [mysqlGroupId, userId]
    );
    
    if (!membership || membership.length === 0 || membership[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can change approval settings'
      });
    }
    
    // Update Firebase first
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      await db.collection('groups').doc(firestoreGroupId).update({
        requireMemberApproval: requireApproval,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Updated approval mode in Firebase for group ${firestoreGroupId}`);
    } catch (firebaseError) {
      console.error('❌ Failed to update Firebase:', firebaseError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update approval settings'
      });
    }
    
    // Update MySQL
    await executeQuery(
      `UPDATE \`groups\` SET require_member_approval = ? WHERE id = ?`,
      [requireApproval ? 1 : 0, mysqlGroupId]
    );
    
    console.log(`✅ Updated approval mode in MySQL for group ${mysqlGroupId}`);
    
    // Create system message
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      const statusText = requireApproval ? 'bật' : 'tắt';
      await db.collection('groups').doc(firestoreGroupId).collection('messages').add({
        type: 'system',
        content: `Chế độ phê duyệt thành viên đã được ${statusText}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isSystemMessage: true
      });
    } catch (err) {
      console.error('Failed to create system message:', err);
    }
    
    res.json({
      success: true,
      message: 'Approval settings updated successfully',
      data: {
        requireApproval
      }
    });
    
  } catch (error) {
    console.error('Toggle approval mode error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get pending members (chỉ admin)
router.get('/:groupId/pending-members', async (req, res) => {
  try {
    let { groupId } = req.params;
    const userId = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      // Already Firestore ID
    } else {
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [parseInt(groupId)]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Get pending members from Firestore
    const admin = require('../config/firebaseAdmin');
    const db = admin.firestore();
    
    const pendingSnapshot = await db.collection('pending_members')
      .where('groupId', '==', firestoreGroupId)
      .where('status', '==', 'pending')
      .get();
    
    const pendingMembers = [];
    for (const doc of pendingSnapshot.docs) {
      const data = doc.data();
      
      // Get user info
      const userDoc = await db.collection('users').doc(data.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // Get inviter info
      const inviterDoc = await db.collection('users').doc(data.invitedBy).get();
      const inviterData = inviterDoc.exists ? inviterDoc.data() : {};
      
      pendingMembers.push({
        id: doc.id,
        userId: data.userId,
        user: {
          displayName: userData.displayName || 'Unknown',
          email: userData.email || '',
          photoURL: userData.photoURL || null,
          userTag: userData.userTag || ''
        },
        invitedBy: data.invitedBy,
        inviter: {
          displayName: inviterData.displayName || 'Unknown',
          email: inviterData.email || ''
        },
        invitedAt: data.invitedAt,
        status: data.status
      });
    }
    
    res.json({
      success: true,
      data: pendingMembers
    });
    
  } catch (error) {
    console.error('Get pending members error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Approve pending member (chỉ admin)
router.post('/:groupId/pending-members/:userId/approve', async (req, res) => {
  try {
    let { groupId, userId } = req.params;
    const adminId = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
    } else {
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Check if admin
    const membership = await executeQuery(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [mysqlGroupId, adminId]
    );
    
    if (!membership || membership.length === 0 || membership[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can approve members'
      });
    }
    
    const admin = require('../config/firebaseAdmin');
    const db = admin.firestore();
    
    // Get pending member info
    const pendingSnapshot = await db.collection('pending_members')
      .where('groupId', '==', firestoreGroupId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    if (pendingSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: 'Pending member not found'
      });
    }
    
    // Add to group_members in Firebase
    await db.collection('group_members').add({
      groupId: firestoreGroupId,
      userId: userId,
      role: 'member',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Add to MySQL
    await executeQuery(
      `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')
       ON DUPLICATE KEY UPDATE role = role`,
      [mysqlGroupId, userId]
    );
    
    // Delete pending member
    const pendingDoc = pendingSnapshot.docs[0];
    await pendingDoc.ref.delete();
    
    // Get user name for system message
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.exists ? (userDoc.data().displayName || 'Người dùng') : 'Người dùng';
    
    // Create system message
    await db.collection('groups').doc(firestoreGroupId).collection('messages').add({
      type: 'system',
      content: `${userName} đã được phê duyệt và tham gia nhóm`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: userId,
      userName: userName,
      isSystemMessage: true
    });
    
    res.json({
      success: true,
      message: 'Member approved successfully'
    });
    
  } catch (error) {
    console.error('Approve member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Reject pending member (chỉ admin)
router.post('/:groupId/pending-members/:userId/reject', async (req, res) => {
  try {
    let { groupId, userId } = req.params;
    const adminId = req.user.id;
    
    // Convert Firestore ID to MySQL ID if needed
    let mysqlGroupId;
    let firestoreGroupId = groupId;
    
    if (isNaN(groupId)) {
      const mapping = await executeQuery(
        `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
        [groupId]
      );
      
      if (!mapping || mapping.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }
      
      mysqlGroupId = mapping[0].mysql_id;
    } else {
      mysqlGroupId = parseInt(groupId);
      const mapping = await executeQuery(
        `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
        [mysqlGroupId]
      );
      
      if (mapping && mapping.length > 0) {
        firestoreGroupId = mapping[0].firestore_id;
      }
    }
    
    // Check if admin
    const membership = await executeQuery(
      `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
      [mysqlGroupId, adminId]
    );
    
    if (!membership || membership.length === 0 || membership[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can reject members'
      });
    }
    
    const admin = require('../config/firebaseAdmin');
    const db = admin.firestore();
    
    // Delete pending member
    const pendingSnapshot = await db.collection('pending_members')
      .where('groupId', '==', firestoreGroupId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    if (pendingSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: 'Pending member not found'
      });
    }
    
    await pendingSnapshot.docs[0].ref.delete();
    
    res.json({
      success: true,
      message: 'Member rejected successfully'
    });
    
  } catch (error) {
    console.error('Reject member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

