const { executeQuery } = require('./src/config/db');

async function debugGroupMembership() {
  try {
    console.log('🔍 Debugging group membership...');
    
    // Check group_members table
    console.log('\n📋 Group members table:');
    const members = await executeQuery('SELECT * FROM group_members LIMIT 10');
    console.table(members);
    
    // Check specific user and group
    const userId = 'hoauy95@gmail.com'; // From console log
    const groupId = '1ceMBzGITBR853ZZRtM'; // From URL
    
    console.log(`\n🔍 Checking user ${userId} in group ${groupId}:`);
    const memberCheck = await executeQuery(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    console.table(memberCheck);
    
    // Check users table  
    console.log('\n👥 Users table:');
    const users = await executeQuery('SELECT id, email, display_name FROM users LIMIT 5');
    console.table(users);
    
    // Check group_mapping table
    console.log('\n🗺️ Group mapping table:');
    const groupMappings = await executeQuery('SELECT * FROM group_mapping LIMIT 5');
    console.table(groupMappings);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Debug error:', error);
    process.exit(1);
  }
}

debugGroupMembership();