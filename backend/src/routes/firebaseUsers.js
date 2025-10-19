const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');
const admin = require('../config/firebaseAdmin');

// Apply Firebase auth middleware to all routes
router.use(verifyFirebaseToken);

/**
 * GET /api/firebase-users/search?q=query
 * Search users by name or userTag (Name#Tag)
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.uid;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchQuery = q.trim();
    
    // Search in Firebase Auth users
    const listUsersResult = await admin.auth().listUsers(1000); // Max 1000 users
    
    console.log(`🔍 Searching for: "${searchQuery}"`);
    console.log(`👥 Total Firebase users: ${listUsersResult.users.length}`);
    
    let matchedUsers = listUsersResult.users.filter(user => {
      // Skip current user
      if (user.uid === currentUserId) return false;
      
      const displayName = user.displayName || '';
      const email = user.email || '';
      
      // Extract userTag from displayName (format: "Name#Tag")
      const tagMatch = displayName.match(/#(\w+)$/);
      const userTag = tagMatch ? tagMatch[1] : '';
      const nameWithoutTag = displayName.replace(/#\w+$/, '').trim();
      
      // Search logic
      const query = searchQuery.toLowerCase();
      
      // Match by full displayName
      if (displayName.toLowerCase().includes(query)) return true;
      
      // Match by name without tag
      if (nameWithoutTag.toLowerCase().includes(query)) return true;
      
      // Match by tag (with or without #)
      if (userTag) {
        if (query.startsWith('#')) {
          const tagQuery = query.substring(1);
          if (userTag.toLowerCase().includes(tagQuery)) return true;
        } else {
          if (userTag.toLowerCase().includes(query)) return true;
        }
      }
      
      // Match by email
      if (email.toLowerCase().includes(query)) return true;
      
      return false;
    });

    console.log(`✅ Matched ${matchedUsers.length} users`);
    if (matchedUsers.length > 0) {
      console.log('First few matches:', matchedUsers.slice(0, 3).map(u => ({
        displayName: u.displayName,
        email: u.email
      })));
    }

    // Limit to 20 results
    matchedUsers = matchedUsers.slice(0, 20);

    // Format response
    const users = matchedUsers.map(user => {
      const displayName = user.displayName || 'Unknown User';
      const tagMatch = displayName.match(/#(\w+)$/);
      
      return {
        uid: user.uid,
        displayName: displayName,
        userTag: tagMatch ? `#${tagMatch[1]}` : null, // Return null if no tag
        email: user.email || '',
        avatar: user.photoURL || null,
        emailVerified: user.emailVerified || false
      };
    });

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/firebase-users/invite
 * Send group invitation to users
 */
router.post('/invite', async (req, res) => {
  try {
    const { groupId, userIds } = req.body;
    const inviterId = req.user.uid;

    if (!groupId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'groupId and userIds array are required'
      });
    }

    // 1. Verify group exists and get MySQL group ID
    const groupMappingResult = await executeQuery(
      `SELECT mysql_id FROM group_mapping WHERE firestore_id = ?`,
      [groupId]
    );

    const groupMapping = Array.isArray(groupMappingResult[0]) ? groupMappingResult[0] : (Array.isArray(groupMappingResult) ? groupMappingResult : [groupMappingResult]);

    if (groupMapping.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    const mysqlGroupId = groupMapping[0].mysql_id;

    // 2. Check if inviter is member of the group
    const memberCheckResult = await executeQuery(
      `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`,
      [mysqlGroupId, inviterId]
    );

    const memberCheck = Array.isArray(memberCheckResult[0]) ? memberCheckResult[0] : (Array.isArray(memberCheckResult) ? memberCheckResult : [memberCheckResult]);

    if (memberCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // 3. Create invitations for each user
    const invitations = [];
    
    for (const userId of userIds) {
      // Check if user is already a member
      const existingMemberResult = await executeQuery(
        `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`,
        [mysqlGroupId, userId]
      );

      const existingMember = Array.isArray(existingMemberResult[0]) ? existingMemberResult[0] : (Array.isArray(existingMemberResult) ? existingMemberResult : [existingMemberResult]);

      if (existingMember.length > 0) {
        continue; // Skip if already member
      }

      // Check if invitation already exists
      const existingInvitationResult = await executeQuery(
        `SELECT * FROM group_invitations 
         WHERE group_id = ? AND invitee_id = ? AND status = 'pending'`,
        [mysqlGroupId, userId]
      );

      const existingInvitation = Array.isArray(existingInvitationResult[0]) ? existingInvitationResult[0] : (Array.isArray(existingInvitationResult) ? existingInvitationResult : [existingInvitationResult]);

      if (existingInvitation.length > 0) {
        continue; // Skip if already invited
      }

      // Create invitation
      const insertResult = await executeQuery(
        `INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status) 
         VALUES (?, ?, ?, 'pending')`,
        [mysqlGroupId, inviterId, userId]
      );

      const result = Array.isArray(insertResult[0]) ? insertResult[0] : insertResult;

      invitations.push({
        id: result.insertId,
        group_id: mysqlGroupId,
        inviter_id: inviterId,
        invitee_id: userId,
        status: 'pending'
      });
    }

    res.json({
      success: true,
      message: `Sent ${invitations.length} invitation(s)`,
      data: invitations
    });

  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
