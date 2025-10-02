require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple test endpoints
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Stable server is working',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DocsShare API is running (stable version)',
    timestamp: new Date().toISOString(),
    version: '1.0.0-stable'
  });
});

// Load both normal and test files routes
try {
  const fileRoutes = require('./src/routes/files');
  app.use('/api/files', fileRoutes);
  console.log('✅ File routes loaded');
} catch (error) {
  console.error('❌ Error loading file routes:', error.message);
}

try {
  const fileTestRoutes = require('./src/routes/files-test');
  app.use('/api/files', fileTestRoutes);
  console.log('✅ File test routes loaded');
} catch (error) {
  console.error('❌ Error loading file test routes:', error.message);
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Start server with proper error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Stable DocsShare API running on port ${PORT}`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Files API: http://localhost:${PORT}/api/files`);
  
  // Heartbeat every 15 seconds
  setInterval(() => {
    console.log(`💓 Stable server heartbeat - ${new Date().toLocaleTimeString()}`);
  }, 15000);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📥 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🔄 Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📥 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('🔄 Process terminated');
    process.exit(0);
  });
});

// Less aggressive error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('⚠️  Server continuing...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  console.error('⚠️  Server continuing...');
});

console.log('🔄 Stable server initialization complete');