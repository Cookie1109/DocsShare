// Test server with database only
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Test database connection
const { executeQuery } = require('./src/config/db');

console.log('🧪 Testing server with database...');

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await executeQuery('SELECT 1 as test');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Database test server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 DB Test: http://localhost:${PORT}/api/test-db`);
});

// Heartbeat
setInterval(() => {
  console.log(`⏰ DB Server heartbeat: ${new Date().toISOString()}`);
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down DB test server...');
  server.close(() => {
    process.exit(0);
  });
});