// Create test user and group for upload testing
const { executeQuery } = require('./src/config/db');

async function createTestData() {
  try {
    console.log('🧪 Creating test data for upload functionality...');
    
    // 1. Create test user
    const testUserId = 'hoangv882@gmail.com';
    const testEmail = 'hoangv882@gmail.com';
    
    console.log('👤 Creating test user...');
    try {
      await executeQuery(`
        INSERT INTO users (id, email, display_name, tag) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE email = VALUES(email)
      `, [testUserId, testEmail, 'Test User', '1234']);
      console.log('✅ Test user created/updated');
    } catch (error) {
      console.log('⚠️ User may already exist:', error.message);
    }
    
    // 2. Create test group
    console.log('🏠 Creating test group...');
    let groupId;
    try {
      const result = await executeQuery(`
        INSERT INTO \`groups\` (name, description, creator_id) 
        VALUES (?, ?, ?)
      `, ['Test Group', 'Group for testing upload functionality', testUserId]);
      groupId = result.insertId;
      console.log('✅ Test group created with ID:', groupId);
    } catch (error) {
      // Group may already exist, get its ID
      const [existingGroup] = await executeQuery(`
        SELECT id FROM \`groups\` WHERE creator_id = ? AND name = ?
      `, [testUserId, 'Test Group']);
      
      if (existingGroup.length > 0) {
        groupId = existingGroup[0].id;
        console.log('⚠️ Test group already exists with ID:', groupId);
      } else {
        throw error;
      }
    }
    
    // 3. Add user to group as member
    console.log('👥 Adding user to group...');
    try {
      await executeQuery(`
        INSERT INTO group_members (group_id, user_id, role) 
        VALUES (?, ?, 'admin')
        ON DUPLICATE KEY UPDATE role = VALUES(role)
      `, [groupId, testUserId]);
      console.log('✅ User added to group as admin');
    } catch (error) {
      console.log('⚠️ User may already be in group:', error.message);
    }
    
    // 4. Verify setup
    console.log('🔍 Verifying test setup...');
    const [memberCheck] = await executeQuery(`
      SELECT gm.*, u.email 
      FROM group_members gm 
      JOIN users u ON gm.user_id = u.id 
      WHERE gm.group_id = ? AND gm.user_id = ?
    `, [groupId, testUserId]);
    
    console.log('✅ Verification result:', memberCheck);
    
    console.log(`
🎉 Test data created successfully!
📊 User ID: ${testUserId}
📊 Group ID: ${groupId}
📊 Email: ${testEmail}

You can now test upload with these values.
    `);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
  
  process.exit(0);
}

createTestData();