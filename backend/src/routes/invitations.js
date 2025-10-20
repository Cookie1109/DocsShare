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

    // 2. Add user to group members
    await executeQuery(
      `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')
       ON DUPLICATE KEY UPDATE role = role`,
      [invitation.group_id, userId]
    );

    // 3. Update invitation status
    await executeQuery(
      `UPDATE group_invitations SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
      [invitationId]
    );

    // 4. Get Firestore group ID from mapping
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

    // 5. Add user to Firestore group_members and create system message
    try {
      const admin = require('../config/firebaseAdmin');
      const db = admin.firestore();
      
      // Get user data from Firestore users collection (not Auth)
      const userDoc = await db.collection('users').doc(userId).get();
      let userName = 'Người dùng mới';
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Use username field (Cookie#2200) if available, otherwise use displayName
        userName = userData.username || userData.displayName || userData.email || 'Người dùng mới';
        console.log(`✅ Got username from Firestore: ${userName}`);
      } else {
        // Fallback to Auth if user not found in Firestore
        const userRecord = await admin.auth().getUser(userId);
        userName = userRecord.displayName || userRecord.email || 'Người dùng mới';
        console.log(`⚠️ User not in Firestore, using Auth: ${userName}`);
      }
      
      // Add to Firestore group_members with correct Firestore group ID
      await db.collection('group_members').doc(`${userId}_${firestoreGroupId}`).set({
        groupId: firestoreGroupId,
        userId: userId,
        role: 'member',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Create system message in messages collection with correct Firestore group ID
      await db.collection('groups').doc(firestoreGroupId).collection('messages').add({
        type: 'system',
        content: `${userName} đã tham gia nhóm`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: userId,
        userName: userName,
        isSystemMessage: true
      });
      
      // Delete Firestore invitation document (for real-time update)
      const invitationsSnapshot = await db.collection('group_invitations')
        .where('invitation_id', '==', parseInt(invitationId))
        .where('invitee_id', '==', userId)
        .get();
      
      const deletePromises = invitationsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      console.log(`✅ Created system message for ${userName} joining Firestore group ${firestoreGroupId} (MySQL group ${invitation.group_id})`);
    } catch (firestoreError) {
      console.warn('Failed to update Firestore:', firestoreError);
      // Don't fail the request if Firestore update fails
    }

    // 6. Get group info for response
    const groupResult = await executeQuery(
      `SELECT id, name, description FROM \`groups\` WHERE id = ?`,
      [invitation.group_id]
    );

    const groups = Array.isArray(groupResult[0]) ? groupResult[0] : (Array.isArray(groupResult) ? groupResult : [groupResult]);

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        group: groups[0],
        invitation: invitation
      }
    });

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
