// Check database groups and group members
const { executeQuery } = require('./src/config/db');

async function checkDatabase() {
  try {
    console.log('🔍 CHECKING DATABASE STATE...\n');
    
    // 1. Check groups
    console.log('📋 GROUPS:');
    const groups = await executeQuery('SELECT * FROM `groups`');
    if (groups.length === 0) {
      console.log('❌ NO GROUPS FOUND IN DATABASE!');
    } else {
      console.table(groups);
    }
    
    // 2. Check group members
    console.log('\n👥 GROUP MEMBERS:');
    const members = await executeQuery(`
      SELECT gm.*, u.email, g.name as group_name
      FROM group_members gm 
      LEFT JOIN users u ON gm.user_id = u.id
      LEFT JOIN \`groups\` g ON gm.group_id = g.id
    `);
    if (members.length === 0) {
      console.log('❌ NO GROUP MEMBERS FOUND!');
    } else {
      console.table(members);
    }
    
    // 3. Check users
    console.log('\n👤 USERS:');
    const users = await executeQuery('SELECT id, email, display_name FROM users');
    if (users.length === 0) {
      console.log('❌ NO USERS FOUND!');
    } else {
      console.table(users);
    }
    
    // 4. Analysis
    console.log('\n💡 ANALYSIS:');
    if (groups.length === 0) {
      console.log('🚨 PROBLEM: No groups exist! Users cannot upload files.');
      console.log('✅ SOLUTION: Create groups first or allow auto-creation.');
    } else if (members.length === 0) {
      console.log('🚨 PROBLEM: Groups exist but no memberships!');
      console.log('✅ SOLUTION: Add users to groups or allow auto-join.');
    } else {
      console.log('✅ Database has groups and memberships. Upload should work.');
    }
    
  } catch (error) {
    console.error('❌ Database check error:', error);
  }
  
  process.exit(0);
}

checkDatabase();