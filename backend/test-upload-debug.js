// Test upload flow debugging
const admin = require('./src/config/firebaseAdmin');

async function testUploadFlow() {
  try {
    // 1. Test with hardcoded user để debug
    const testUser = {
      uid: 'hoangv882@gmail.com', // Firebase UID từ console log
      email: 'hoangv882@gmail.com'
    };
    
    console.log('🧪 Testing upload flow with user:', testUser);
    
    // 2. Test database connection
    const { executeQuery } = require('./src/config/db');
    
    // 3. Check users table structure first
    const [structure] = await executeQuery('DESCRIBE users');
    console.log('👤 Users table structure:', structure);
    
    // 4. Check user exists in database
    const [users] = await executeQuery('SELECT * FROM users LIMIT 5');
    console.log('👤 Users sample:', users);
    
    // 5. List all tables to understand schema
    const [tables] = await executeQuery('SHOW TABLES');
    console.log('📋 All tables:', tables);
    
    // 6. Check groups structure
    const [groupsStructure] = await executeQuery('DESCRIBE `groups`');
    console.log('🏠 Groups table structure:', groupsStructure);
    
    // 7. Check group_members structure  
    const [membersStructure] = await executeQuery('DESCRIBE `group_members`');
    console.log('👥 Group members table structure:', membersStructure);
    console.log('👥 All members (sample):', allMembers);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
  
  process.exit(0);
}

testUploadFlow();