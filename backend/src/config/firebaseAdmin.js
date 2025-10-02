const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Use the service account JSON file directly
    const serviceAccountPath = require('path').join(__dirname, '../../docsshare-35adb-firebase-adminsdk-fbsvc-5409f13b9a.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId: 'docsshare-35adb'
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
}

module.exports = admin;