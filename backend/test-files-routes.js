// Test server with files routes only
const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors({ origin: true }));
app.use(express.json());

console.log('🧪 Testing server with files routes...');

try {
  // Test importing files routes
  console.log('📦 Importing files routes...');
  const filesRoutes = require('./src/routes/files');
  
  console.log('✅ Files routes imported successfully');
  
  // Use files routes  
  app.use('/api/files', filesRoutes);
  
  console.log('✅ Files routes mounted successfully');
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Start server
  const server = app.listen(5000, () => {
    console.log('🚀 Files routes test server running on port 5000');
    console.log('🔗 Health: http://localhost:5000/api/health'); 
    console.log('🔗 Files: http://localhost:5000/api/files');
    
    // Heartbeat to verify server stays alive
    setInterval(() => {
      console.log(`⏰ Files routes server heartbeat: ${new Date().toISOString()}`);
    }, 5000);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🔄 Shutting down files routes test server...');
    server.close(() => {
      process.exit(0);
    });
  });
  
} catch (error) {
  console.error('❌ Error in files routes test:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('📝 Files routes test script completed');