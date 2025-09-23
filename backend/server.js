const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import database connection
const { testConnection, getDatabaseStats } = require('./src/config/db');

// Import routes
const authRoutes = require('./src/routes/auth');
const documentRoutes = require('./src/routes/documents');
const userRoutes = require('./src/routes/users');
const configRoutes = require('./src/routes/config');
const groupRoutes = require('./src/routes/groupsNew');
const tagRoutes = require('./src/routes/tags');
const activityRoutes = require('./src/routes/activities');
const fileRoutes = require('./src/routes/files');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/config', configRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/files', fileRoutes);

// Health check with database status
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    const stats = await getDatabaseStats();
    
    res.json({ 
      status: 'OK', 
      message: 'DocsShare API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: dbStatus,
        statistics: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'API running but database issues detected',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại'
  });
});

// Initialize server and database
const startServer = async () => {
  try {
    // Test database connection on startup
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('⚠️  Warning: Database connection failed, but server will continue running');
      console.error('⚠️  Some features may not work properly without database');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 DocsShare API đang chạy tại port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Database Status: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
