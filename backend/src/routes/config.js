const express = require('express');
const router = express.Router();

// @route   GET /api/config/firebase
// @desc    Get Firebase configuration for frontend
// @access  Public (but limited info)
router.get('/firebase', (req, res) => {
  try {
    // Only send safe configuration to frontend
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    // Validate that all required config is present
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration incomplete',
        missingFields: missingFields
      });
    }

    res.json({
      success: true,
      data: firebaseConfig
    });
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration'
    });
  }
});

module.exports = router;