const admin = require('../config/firebaseAdmin');

/**
 * Middleware xác thực Firebase ID Token
 * Sử dụng Firebase Admin SDK để verify token từ frontend
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify Firebase ID token với Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Attach user info to request
    req.user = {
      id: decodedToken.uid,  // Alias for compatibility
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email || 'Unknown User',
      avatar: decodedToken.picture || null,
      emailVerified: decodedToken.email_verified || false
    };

    console.log(`✅ Authenticated user: ${req.user.email} (${req.user.uid})`);
    next();
    
  } catch (error) {
    console.error('❌ Firebase token verification error:', error.message);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        message: 'Token revoked. Please login again.'
      });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

module.exports = verifyFirebaseToken;