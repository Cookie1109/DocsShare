const express = require('express');
const { 
  createUploadSignature, 
  saveFileMetadata, 
  getGroupFiles
} = require('../controllers/filesController');

const router = express.Router();

/**
 * TEST Routes - Without Authentication for debugging
 */

// Test signature endpoint without auth
router.post('/test-signature', async (req, res) => {
  try {
    // Mock user data for testing
    req.user = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    
    await createUploadSignature(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test signature failed',
      error: error.message
    });
  }
});

// Test metadata endpoint without auth
router.post('/test-metadata', async (req, res) => {
  try {
    // Mock user data for testing
    req.user = {
      uid: 'test-user-123',
      email: 'test@example.com'
    };
    
    await saveFileMetadata(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test metadata failed',
      error: error.message
    });
  }
});

// Test endpoint to check route availability
router.get('/test-routes', (req, res) => {
  res.json({
    success: true,
    message: 'Test routes are available',
    routes: [
      'POST /api/files/test-signature',
      'POST /api/files/test-metadata',
      'GET /api/files/test-routes'
    ]
  });
});

module.exports = router;