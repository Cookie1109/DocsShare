const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/firebaseAuth');
const User = require('../models/User');
const admin = require('../config/firebaseAdmin');

/**
 * GET /api/profile/status
 * Check if user has completed profile (has display_name and tag in MySQL)
 */
router.get('/status', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.json({
        success: true,
        completed: false,
        message: 'User not found in database'
      });
    }
    
    // Check if user has both display_name and tag
    const completed = user.display_name && user.tag;
    
    res.json({
      success: true,
      completed,
      user: completed ? {
        display_name: user.display_name,
        tag: user.tag,
        username: `${user.display_name}#${user.tag}`,
        avatar_url: user.avatar_url || null
      } : null
    });
  } catch (error) {
    console.error('Error checking profile status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check profile status'
    });
  }
});

/**
 * GET /api/profile/check-tag/:tag
 * Check if a tag is available (not used by another user with same display_name)
 * Query params: displayName (required)
 */
router.get('/check-tag/:tag', verifyFirebaseToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const { displayName } = req.query;
    
    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: 'displayName query parameter is required'
      });
    }
    
    // Validate tag format (4-6 digits)
    if (!/^\d{4,6}$/.test(tag)) {
      return res.status(400).json({
        success: false,
        error: 'Tag phải là 4-6 chữ số'
      });
    }
    
    const exists = await User.checkNameTagExists(displayName, tag);
    
    res.json({
      success: true,
      available: !exists,
      message: exists ? 'Tên và tag đã được sử dụng' : 'Tên và tag khả dụng'
    });
  } catch (error) {
    console.error('Error checking tag availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check tag availability'
    });
  }
});

/**
 * POST /api/profile/complete
 * Complete user profile by setting display_name and tag
 * Body: { displayName, tag }
 */
router.post('/complete', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { displayName, tag } = req.body;
    
    // Validate input
    if (!displayName || !tag) {
      return res.status(400).json({
        success: false,
        error: 'displayName và tag là bắt buộc'
      });
    }
    
    // Validate displayName format
    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Tên hiển thị phải có từ 2-50 ký tự'
      });
    }
    
    // Validate tag format (4-6 digits)
    if (!/^\d{4,6}$/.test(tag)) {
      return res.status(400).json({
        success: false,
        error: 'Tag phải là 4-6 chữ số'
      });
    }
    
    // Check if name#tag combination already exists
    const exists = await User.checkNameTagExists(displayName, tag);
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'Tên và tag đã được sử dụng'
      });
    }
    
    // Get Firebase user info
    const firebaseUser = await admin.auth().getUser(userId);
    const email = firebaseUser.email;
    const avatar_url = firebaseUser.photoURL || null; // Chỉ dùng cho Firebase
    
    // Check if user exists in MySQL
    let user = await User.findById(userId);
    
    if (!user) {
      // Create new user in MySQL (không lưu avatar - chỉ lưu trong Firebase)
      const result = await User.create({
        id: userId,
        email,
        display_name: displayName,
        tag
      });
      
      if (!result.success) {
        return res.status(500).json(result);
      }
    } else {
      // Update existing user (không update avatar - chỉ lưu trong Firebase)
      const result = await User.updateProfile(userId, {
        display_name: displayName,
        tag
      });
      
      if (!result.success) {
        return res.status(500).json(result);
      }
    }
    
    // Update Firebase displayName to include tag
    const username = `${displayName}#${tag}`;
    await admin.auth().updateUser(userId, {
      displayName: username
    });
    
    // Update Firestore user document
    const db = admin.firestore();
    await db.collection('users').doc(userId).set({
      uid: userId,
      email,
      displayName,
      userTag: tag,
      username,
      avatar: avatar_url,
      role: 'member',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        display_name: displayName,
        tag,
        username,
        avatar_url
      }
    });
  } catch (error) {
    console.error('Error completing profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete profile'
    });
  }
});

/**
 * POST /api/profile/auto-generate-tag
 * Generate a unique tag for the current user
 * Body: { displayName }
 */
router.post('/auto-generate-tag', verifyFirebaseToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: 'displayName is required'
      });
    }
    
    // Generate random tag until we find an available one
    let tag = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!tag && attempts < maxAttempts) {
      const randomTag = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
      const exists = await User.checkNameTagExists(displayName, randomTag);
      
      if (!exists) {
        tag = randomTag;
        break;
      }
      
      attempts++;
    }
    
    if (!tag) {
      return res.status(500).json({
        success: false,
        error: 'Could not generate unique tag. Please try again.'
      });
    }
    
    res.json({
      success: true,
      tag
    });
  } catch (error) {
    console.error('Error generating tag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tag'
    });
  }
});

module.exports = router;
