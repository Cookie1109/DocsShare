const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');
const verifyFirebaseToken = require('../middleware/firebaseAuth');

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

    // 4. Create system message in Firestore
    try {
      const userRecord = await admin.auth().getUser(userId);
      const userName = userRecord.displayName || userRecord.email || 'Someone';
      
      const groupRef = admin.firestore().collection('groups').doc(invitation.group_id.toString());
      
      await groupRef.collection('files').add({
        type: 'system',
        content: `${userName} đã tham gia nhóm`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: userId
      });
    } catch (firestoreError) {
      console.warn('Failed to create system message in Firestore:', firestoreError);
      // Don't fail the request if Firestore update fails
    }

    // 5. Get group info for response
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
