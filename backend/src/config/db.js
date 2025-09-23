const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * MySQL Database Connection Configuration
 * 
 * Dựa trên schema docsshare_db.sql với các bảng chính:
 * - users: Lưu thông tin người dùng từ Firebase Auth (id=UID, email, display_name, tag)
 * - groups: Thông tin nhóm (id, name, description, creator_id, group_photo_url)
 * - group_members: Quan hệ nhiều-nhiều Users-Groups (group_id, user_id, role)
 * - files: Metadata file (id, name, storage_path, group_id, uploader_id, tags)
 * - tags: Tags cục bộ theo nhóm (id, name, group_id, creator_id)
 * - file_tags: Quan hệ nhiều-nhiều Files-Tags (file_id, tag_id)
 * - activity_logs: Lịch sử hoạt động (user_id, action_type, target_id, details)
 */

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all database credentials are provided.');
  process.exit(1);
}

// Database configuration object
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  // Connection pool settings for better performance
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  // Enable multiple statements for complex queries
  multipleStatements: false,
  // Timezone setting
  timezone: '+07:00',     // Vietnam timezone
  // Character set
  charset: 'utf8mb4'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    console.log(`📊 Connected to database: ${process.env.DB_NAME}`);
    console.log(`🏠 Host: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    connection.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Please check your MySQL server and credentials in .env file');
    return false;
  }
};

/**
 * Execute a query with automatic connection handling
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Query execution error:', error.message);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
};

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - Function containing transaction logic
 * @returns {Promise<any>} Transaction result
 */
const executeTransaction = async (callback) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('❌ Transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get database statistics for monitoring
 * @returns {Promise<Object>} Database statistics
 */
const getDatabaseStats = async () => {
  try {
    const stats = await executeQuery(`
      SELECT 
        'users' as table_name, COUNT(*) as count FROM users
      UNION ALL
      SELECT 
        'groups' as table_name, COUNT(*) as count FROM \`groups\`
      UNION ALL
      SELECT 
        'group_members' as table_name, COUNT(*) as count FROM group_members
      UNION ALL
      SELECT 
        'files' as table_name, COUNT(*) as count FROM files
      UNION ALL
      SELECT 
        'tags' as table_name, COUNT(*) as count FROM tags
      UNION ALL
      SELECT 
        'activity_logs' as table_name, COUNT(*) as count FROM activity_logs
    `);
    
    const statsObject = {};
    stats.forEach(row => {
      statsObject[row.table_name] = row.count;
    });
    
    return statsObject;
  } catch (error) {
    console.error('❌ Failed to get database statistics:', error.message);
    throw error;
  }
};

/**
 * Gracefully close database connections
 */
const closeDatabase = async () => {
  try {
    await pool.end();
    console.log('✅ Database connections closed successfully');
  } catch (error) {
    console.error('❌ Error closing database connections:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🔄 Gracefully shutting down database connections...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Gracefully shutting down database connections...');
  await closeDatabase();
  process.exit(0);
});

// Export database utilities
module.exports = {
  pool,
  testConnection,
  executeQuery,
  executeTransaction,
  getDatabaseStats,
  closeDatabase,
  
  // Database configuration (for debugging, without sensitive data)
  getDbConfig: () => ({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectionLimit: dbConfig.connectionLimit,
    timezone: dbConfig.timezone,
    charset: dbConfig.charset
  })
};