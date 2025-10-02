// Test server with Firebase
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Test Firebase Admin SDK
const admin = require('./src/config/firebaseAdmin');

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    firebase: 'initialized'
  });
});

app.get('/api/test-firebase', async (req, res) => {
  try {
    // Test Firestore connection
    const testDoc = await admin.firestore().collection('test').doc('health').get();
    res.json({ 
      success: true, 
      firebase: 'connected',
      testDoc: testDoc.exists
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log('🧪 Testing server with Firebase...');
  console.log(`🚀 Firebase test server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Firebase Test: http://localhost:${PORT}/api/test-firebase`);
});

// Heartbeat to keep server alive
const heartbeat = setInterval(() => {
  console.log('⏰ Firebase Server heartbeat:', new Date().toISOString());
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down Firebase test server...');
  clearInterval(heartbeat);
  server.close(() => {
    process.exit(0);
  });
});

// Add error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception (Firebase test):', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at (Firebase test):', promise, 'reason:', reason);
  process.exit(1);
});