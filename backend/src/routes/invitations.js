const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');
const admin = require('../config/firebaseAdmin');

// Apply Firebase auth middleware to all routes
router.use(verifyFirebaseToken);

/**
 * GET /api/invitations/pending
 * Get pending group invitations for current user
 */
router.get('/pending', async (req, res) => {
  try {
    const userId = req.user.uid;

    const invitations = await executeQuery(
      `SELECT 
        gi.id,
        gi.group_id,
        gi.inviter_id,
        gi.status,
        gi.created_at,
        g.name as group_name,
        g.description as group_description
      FROM group_invitations gi
      JOIN \`groups\` g ON gi.group_id = g.id
      WHERE gi.invitee_id = ? AND gi.status = 'pending'
      ORDER BY gi.created_at DESC`,
      [userId]
    );

    const result = Array.isArray(invitations[0]) ? invitations[0] : (Array.isArray(invitations) ? invitations : [invitations]);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting pending invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/invitations/:invitationId/accept
 * Accept a group invitation
 */
router.post('/:invitationId/accept', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.uid;

    // 1. Get invitation details
    const invitationResult = await executeQuery(
      `SELECT * FROM group_invitations WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
      [invitationId, userId]
    );

    const invitations = Array.isArray(invitationResult[0]) ? invitationResult[0] : (Array.isArray(invitationResult) ? invitationResult : [invitationResult]);

    if (invitations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or already processed'
      });
    }

    const invitation = invitations[0];

    // 2. Delete old invitations for this group and user
    await executeQuery(
      `DELETE FROM group_invitations WHERE group_id = ? AND invitee_id = ? AND status != 'pending'`,
      [invitation.group_id, userId]
    );

    // 3. Get Firestore group ID from mapping FIRST (before any updates)
    const mappingResult = await executeQuery(
      `SELECT firestore_id FROM group_mapping WHERE mysql_id = ?`,
      [invitation.group_id]
    );

    const mappings = Array.isArray(mappingResult[0]) ? mappingResult[0] : (Array.isArray(mappingResult) ? mappingResult : [mappingResult]);

    if (mappings.length === 0) {
      console.error(`❌ No Firestore mapping found for MySQL group ${invitation.group_id}`);
      return res.status(500).json({
        success: false,
        error: 'Group mapping not found'
      });
    }

    const firestoreGroupId = mappings[0].firestore_id;
    console.log(`✅ Found Firestore group ID: ${firestoreGroupId} for MySQL group ${invitation.group_id}`);

    // 4. Check group approval requirement and inviter role (read-only, before MySQL update)
    let requiresPendingApproval = false;
    let userName = 'Người dùng mới';
    
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      // Get user data for system message
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userName = userData.username || userData.displayName || userData.email || 'Người dùng mới';
      } else {
        const userRecord = await admin.auth().getUser(userId);
        userName = userRecord.displayName || userRecord.email || 'Người dùng mới';
      }
      
      // Check if group requires member approval
      const groupDoc = await db.collection('groups').doc(firestoreGroupId).get();
      const groupData = groupDoc.exists ? groupDoc.data() : {};
      const requireApproval = groupData.requireMemberApproval || false;
      
      // Check if inviter is admin
      const inviterRole = await db.collection('group_members')
        .where('groupId', '==', firestoreGroupId)
        .where('userId', '==', invitation.inviter_id)
        .get();
      
      const isInviterAdmin = !inviterRole.empty && inviterRole.docs[0].data().role === 'admin';
      
      // Set flag if approval required AND inviter is NOT admin
      requiresPendingApproval = requireApproval && !isInviterAdmin;
      
    } catch (readError) {
      console.warn('⚠️ Failed to check approval requirements (non-critical):', readError);
    }

    // 5. Update MySQL FIRST (source of truth)
    try {
      if (requiresPendingApproval) {
        console.log(`⏳ Group requires approval and inviter is not admin. Marking as pending in MySQL...`);
        // Just update invitation status to accepted (user will be in pending state)
        await executeQuery(
          `UPDATE group_invitations SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
          [invitationId]
        );
      } else {
        // Normal flow: Add user to group_members
        await executeQuery(
          `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')
           ON DUPLICATE KEY UPDATE role = role`,
          [invitation.group_id, userId]
        );
        console.log(`✅ Added user ${userId} to MySQL group ${invitation.group_id}`);

        // Update invitation status
        await executeQuery(
          `UPDATE group_invitations SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
          [invitationId]
        );
        console.log(`✅ Updated invitation ${invitationId} status to accepted`);
      }
    } catch (mysqlError) {
      console.error('❌ MySQL update failed:', mysqlError);
      return res.status(500).json({
        success: false,
        error: 'Failed to accept invitation'
      });
    }

    // 6. Sync to Firestore (for real-time UI update)
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      if (requiresPendingApproval) {
        // Add to pending_members collection
        await db.collection('pending_members').add({
          groupId: firestoreGroupId,
          userId: userId,
          invitedBy: invitation.inviter_id,
          invitedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        });
        console.log(`✅ Synced to Firestore: Added user ${userId} to pending_members`);
      } else {
        // Add to group_members
        const membershipQuery = await db.collection('group_members')
          .where('groupId', '==', firestoreGroupId)
          .where('userId', '==', userId)
          .get();
        
        if (membershipQuery.empty) {
          await db.collection('group_members').add({
            groupId: firestoreGroupId,
            userId: userId,
            role: 'member',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Synced to Firestore: Added user ${userId} to group_members`);
        }
        
        // Create system message
        await db.collection('groups').doc(firestoreGroupId).collection('messages').add({
          type: 'system',
          content: `${userName} đã tham gia nhóm`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: userId,
          userName: userName,
          isSystemMessage: true
        });
        console.log(`✅ Created system message for ${userName}`);
      }
      
      // Delete Firestore invitation document
      const invitationsSnapshot = await db.collection('group_invitations')
        .where('invitation_id', '==', parseInt(invitationId))
        .where('invitee_id', '==', userId)
        .get();
      
      const deletePromises = invitationsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      console.log(`✅ Deleted Firestore invitation documents`);
      
    } catch (firestoreError) {
      console.error('❌ Firestore sync failed (non-critical):', firestoreError);
      console.error('⚠️ DATA MISMATCH: Member in MySQL but not synced to Firestore!');
      // Don't fail request - MySQL is source of truth
    }

    // 7. Get group info for response
    const groupResult = await executeQuery(
      `SELECT id, name, description FROM \`groups\` WHERE id = ?`,
      [invitation.group_id]
    );

    const groups = Array.isArray(groupResult[0]) ? groupResult[0] : (Array.isArray(groupResult) ? groupResult : [groupResult]);

    if (requiresPendingApproval) {
      res.json({
        success: true,
        message: 'Invitation accepted. Waiting for admin approval.',
        pending: true,
        data: {
          group: groups[0],
          invitation: invitation
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        data: {
          group: groups[0],
          invitation: invitation
        }
      });
    }

  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/invitations/:invitationId/decline
 * Decline a group invitation
 */
router.post('/:invitationId/decline', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.uid;

    // Update invitation status
    const result = await executeQuery(
      `UPDATE group_invitations 
       SET status = 'declined', updated_at = NOW() 
       WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
      [invitationId, userId]
    );

    const updateResult = Array.isArray(result[0]) ? result[0] : result;

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or already processed'
      });
    }

    // Delete Firestore invitation for real-time update
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      const invitationsSnapshot = await db.collection('group_invitations')
        .where('invitation_id', '==', parseInt(invitationId))
        .where('invitee_id', '==', userId)
        .get();
      
      const deletePromises = invitationsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      console.log(`✅ Deleted Firestore invitation ${invitationId}`);
    } catch (firestoreError) {
      console.warn('Failed to delete Firestore invitation:', firestoreError);
    }

    res.json({
      success: true,
      message: 'Invitation declined successfully'
    });

  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
