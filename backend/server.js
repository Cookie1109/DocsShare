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

// CORS Configuration - Đặt trước tất cả middleware khác
const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép requests từ các origins được định nghĩa
    const allowedOrigins = [
      'http://localhost:5173', // Vite dev server (port cũ)
      'http://localhost:5178', // Vite dev server (port mới)
      'http://127.0.0.1:5173', // Alternative localhost (port cũ)
      'http://127.0.0.1:5178', // Alternative localhost (port mới)
      'http://localhost:3000'  // React dev server (backup)
    ];
    
    // Cho phép requests không có origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true, // Cho phép cookies và authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override'
  ],
  optionsSuccessStatus: 200 // Support legacy browsers
};

// Apply CORS middleware FIRST - Simplified for development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes - with error handling for each route
console.log('📝 Loading routes...');

try {
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  app.use('/api/documents', documentRoutes);
  console.log('✅ Document routes loaded');
} catch (error) {
  console.error('❌ Error loading document routes:', error.message);
}

try {
  app.use('/api/users', userRoutes);
  console.log('✅ User routes loaded');
} catch (error) {
  console.error('❌ Error loading user routes:', error.message);
}

try {
  app.use('/api/config', configRoutes);
  console.log('✅ Config routes loaded');
} catch (error) {
  console.error('❌ Error loading config routes:', error.message);
}

try {
  app.use('/api/groups', groupRoutes);
  console.log('✅ Group routes loaded');
} catch (error) {
  console.error('❌ Error loading group routes:', error.message);
}

try {
  app.use('/api/tags', tagRoutes);
  console.log('✅ Tag routes loaded');
} catch (error) {
  console.error('❌ Error loading tag routes:', error.message);
}

try {
  app.use('/api/activities', activityRoutes);
  console.log('✅ Activity routes loaded');
} catch (error) {
  console.error('❌ Error loading activity routes:', error.message);
}

try {
  app.use('/api/files', fileRoutes);
  console.log('✅ File routes loaded');
} catch (error) {
  console.error('❌ Error loading file routes:', error.message);
}

console.log('📝 All routes loading completed');

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is working',
    timestamp: new Date().toISOString()
  });
});

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
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 DocsShare API đang chạy tại port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Database Status: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log('🔄 Server is now listening for requests...');
      
      // Add heartbeat to keep server alive and show it's working
      setInterval(() => {
        console.log(`💓 Server heartbeat - ${new Date().toLocaleTimeString()}`);
      }, 10000);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Global error handlers - Modified to be less aggressive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit immediately - log and continue
  console.error('⚠️  Server continuing despite uncaught exception...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit immediately - log and continue
  console.error('⚠️  Server continuing despite unhandled rejection...');
});

startServer();
